import type { Edge, Node } from "@xyflow/react"
import { Prisma } from "@prisma/client"
import { buildExecutionPhases, validateDAG } from "./dag-utils"
import type { WorkflowNodeData } from "@/components/workflow-canvas/types"
import { runLlmTask } from "@/trigger/llm-task"
import { runCropImageTask } from "@/trigger/crop-image-task"
import { runExtractFrameTask } from "@/trigger/extract-frame-task"
import { db } from "./db"

export type ServerExecutionInput = {
  runId: string
  workflowId: string
  userId: string
  nodes: Node[]
  edges: Edge[]
  mode: "full" | "selected" | "single"
  selectedNodeIds?: string[]
}

export async function executeWorkflowServer(input: ServerExecutionInput) {
  const start = performance.now()
  const nodesById = new Map(input.nodes.map((n) => [n.id, n]))

  // Validate DAG
  const validation = validateDAG(input.nodes, input.edges)
  if (!validation.valid) {
    await db.workflowRun.update({
      where: { id: input.runId },
      data: {
        status: "failed",
        error: "Workflow contains a cycle",
        completedAt: new Date(),
      },
    })
    return { success: false, error: "Workflow contains a cycle" }
  }

  try {
    // Build execution phases
    const restricted = buildRestrictedSet(input.mode, input.nodes, input.edges, input.selectedNodeIds)
    const phases = buildExecutionPhases(input.nodes, input.edges, restricted)
    const outputs: Record<string, unknown> = {}

    // Execute phase by phase, but run independent nodes in each phase concurrently.
    for (const phase of phases) {
      await Promise.all(
        phase.map(async (nodeId) => {
          const node = nodesById.get(nodeId)
          if (!node || !restricted.has(nodeId)) return

          const t0 = performance.now()
          const nodeData = (node.data ?? {}) as WorkflowNodeData
          const inputs = collectInputs(node, nodesById, input.edges, outputs)

          const nodeRun = await db.nodeRun.create({
            data: {
              runId: input.runId,
              nodeId,
              nodeType: node.type || "unknown",
              nodeName: getNodeName(node.type),
              status: "running",
              input: inputs as Prisma.InputJsonValue,
            },
          })

          try {
            let result: any = null

            if (node.type === "text") {
              result = nodeData.kind === "text" ? nodeData.text : ""
            } else if (node.type === "uploadImage") {
              result = nodeData.kind === "uploadImage" ? nodeData.imageUrl : ""
            } else if (node.type === "uploadVideo") {
              result = nodeData.kind === "uploadVideo" ? nodeData.videoUrl : ""
            } else if (node.type === "llm") {
              const llmData = nodeData.kind === "llm" ? nodeData : null
              result = await runLlmTask({
                model: String(inputs.model ?? llmData?.modelId ?? "gemini-2.5-flash-lite"),
                systemPrompt: inputs.system_prompt != null ? String(inputs.system_prompt) : llmData?.systemPrompt,
                userMessage: String(inputs.user_message ?? llmData?.userMessage ?? ""),
                images: Array.isArray(inputs.images)
                  ? inputs.images.filter(Boolean).map((image) => String(image))
                  : llmData?.imageUrls || [],
              })
            } else if (node.type === "cropImage") {
              const cropData = nodeData.kind === "cropImage" ? nodeData : null
              result = await runCropImageTask({
                imageUrl: String(inputs.image_url ?? cropData?.imageUrl ?? ""),
                xPercent: Number(inputs.x_percent ?? cropData?.x_percent ?? 0),
                yPercent: Number(inputs.y_percent ?? cropData?.y_percent ?? 0),
                widthPercent: Number(inputs.width_percent ?? cropData?.width_percent ?? 100),
                heightPercent: Number(inputs.height_percent ?? cropData?.height_percent ?? 100),
              })
            } else if (node.type === "extractFrame") {
              const extractData = nodeData.kind === "extractFrame" ? nodeData : null
              const videoUrlCandidate =
                typeof inputs.video_url === "string" && inputs.video_url.trim().length > 0
                  ? inputs.video_url
                  : extractData?.videoUrl

              if (typeof videoUrlCandidate !== "string" || videoUrlCandidate.trim().length === 0) {
                throw new Error(
                  "Extract Frame requires a non-empty video_url input. Connect an Upload Video node to video_url or set the node video URL."
                )
              }

              result = await runExtractFrameTask({
                videoUrl: videoUrlCandidate,
                timestamp: String(inputs.timestamp ?? extractData?.timestamp ?? "0"),
              })
            }

            outputs[nodeId] = result

            const durationMs = Math.max(1, performance.now() - t0)
            const outputPreview = String(result).slice(0, 200)

            await db.nodeRun.update({
              where: { id: nodeRun.id },
              data: {
                status: "success",
                output: { output: result },
                outputPreview,
                durationMs: Math.round(durationMs),
              },
            })
          } catch (error) {
            const durationMs = Math.max(1, performance.now() - t0)
            const errorMsg = error instanceof Error ? error.message : String(error)

            await db.nodeRun.update({
              where: { id: nodeRun.id },
              data: {
                status: "failed",
                error: errorMsg,
                durationMs: Math.round(durationMs),
              },
            })
          }
        }),
      )
    }

    // Mark run as complete
    const allNodeRuns = await db.nodeRun.findMany({ where: { runId: input.runId } })
    const failedCount = allNodeRuns.filter((n) => n.status === "failed").length
    const status = failedCount === 0 ? "success" : failedCount === allNodeRuns.length ? "failed" : "partial"
    const totalDuration = performance.now() - start

    const updatedRun = await db.workflowRun.update({
      where: { id: input.runId },
      data: {
        status,
        completedAt: new Date(),
        durationMs: Math.round(totalDuration),
      },
      include: { nodeRuns: true },
    })

    return { success: true, runId: input.runId, run: updatedRun }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    await db.workflowRun.update({
      where: { id: input.runId },
      data: { status: "failed", error: errorMsg, completedAt: new Date() },
    })
    return { success: false, error: errorMsg }
  }
}

function buildRestrictedSet(mode: string, nodes: Node[], edges: Edge[], selectedNodeIds?: string[]): Set<string> {
  const all = new Set(nodes.map((n) => n.id))
  if (mode === "full") return all

  const selected = new Set(selectedNodeIds ?? [])
  if (selected.size === 0) return all

  const closure = new Set<string>(selected)
  const queue = [...selected]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (edge.source !== current) continue
      if (closure.has(edge.target)) continue
      closure.add(edge.target)
      queue.push(edge.target)
    }
  }

  return closure
}

function collectInputs(node: Node, nodesById: Map<string, Node>, edges: Edge[], upstreamOutputs: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  const nodeData = (node.data ?? {}) as Record<string, unknown>

  const isMissingTextInput = (value: unknown) => {
    if (value == null) return true
    return typeof value === "string" && value.trim().length === 0
  }

  for (const edge of edges) {
    if (edge.target !== node.id || !edge.targetHandle) continue
    const sourceOutput = upstreamOutputs[edge.source]

    if (edge.targetHandle === "images") {
      const prev = Array.isArray(input.images) ? (input.images as unknown[]) : []
      input.images = [...prev, sourceOutput]
    } else {
      input[edge.targetHandle] = sourceOutput
    }
  }

  // Local fallback values
  if (node.type === "llm") {
    input.model = nodeData.modelId
    if (input.system_prompt == null) input.system_prompt = nodeData.systemPrompt
    if (input.user_message == null) input.user_message = nodeData.userMessage
    if (input.images == null) input.images = nodeData.imageUrls
  }

  if (node.type === "cropImage") {
    if (isMissingTextInput(input.image_url)) input.image_url = nodeData.imageUrl
    if (input.x_percent == null) input.x_percent = nodeData.x_percent
    if (input.y_percent == null) input.y_percent = nodeData.y_percent
    if (input.width_percent == null) input.width_percent = nodeData.width_percent
    if (input.height_percent == null) input.height_percent = nodeData.height_percent
  }

  if (node.type === "extractFrame") {
    if (isMissingTextInput(input.video_url)) input.video_url = nodeData.videoUrl
    if (isMissingTextInput(input.timestamp)) input.timestamp = nodeData.timestamp
  }

  if (node.type === "text") {
    input.text = nodeData.text
  }

  return input
}

function getNodeName(type?: string): string {
  switch (type) {
    case "text":
      return "Text Node"
    case "uploadImage":
      return "Upload Image"
    case "uploadVideo":
      return "Upload Video"
    case "llm":
      return "LLM Node"
    case "cropImage":
      return "Crop Image"
    case "extractFrame":
      return "Extract Frame"
    default:
      return "Node"
  }
}
