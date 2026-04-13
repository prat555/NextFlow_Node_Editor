import type { Edge, Node } from "@xyflow/react"
import { Prisma } from "@prisma/client"
import { runs, wait } from "@trigger.dev/sdk"
import type { WorkflowNodeData } from "@/components/workflow-canvas/types"
import { cropImageTask } from "@/trigger/crop-image-task"
import { extractFrameTask } from "@/trigger/extract-frame-task"
import { llmTask } from "@/trigger/llm-task"
import { db } from "./db"
import { validateDAG } from "./dag-utils"

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
    const restricted = buildRestrictedSet(input.mode, input.nodes, input.edges, input.selectedNodeIds)
    const outputs: Record<string, unknown> = {}

    type PhaseNodeContext = {
      nodeId: string
      node: Node
      nodeData: WorkflowNodeData
      inputs: Record<string, unknown>
      nodeRunId: string
      startedAt: number
    }

    const markNodeSuccess = async (ctx: PhaseNodeContext, result: unknown) => {
      const safeResult = toJsonSafe(result)
      outputs[ctx.nodeId] = safeResult
      const durationMs = Math.max(1, performance.now() - ctx.startedAt)
      const outputPreview = String(safeResult ?? "").slice(0, 200)

      await db.nodeRun.update({
        where: { id: ctx.nodeRunId },
        data: {
          status: "success",
          output: { output: safeResult } as Prisma.InputJsonValue,
          outputPreview,
          durationMs: Math.round(durationMs),
        },
      })
    }

    const markNodeFailure = async (ctx: PhaseNodeContext, error: unknown) => {
      const durationMs = Math.max(1, performance.now() - ctx.startedAt)
      const errorMsg = error instanceof Error ? error.message : String(error)
      failedNodeErrors.set(ctx.nodeId, errorMsg)

      await db.nodeRun.update({
        where: { id: ctx.nodeRunId },
        data: {
          status: "failed",
          error: errorMsg,
          durationMs: Math.round(durationMs),
        },
      })
    }

    const allNodeIds = input.nodes.map((n) => n.id).filter((id) => restricted.has(id))
    const dependents = new Map<string, string[]>()
    const incomingEdges = new Map<string, Edge[]>()
    const remainingDeps = new Map<string, number>()
    const failedNodeErrors = new Map<string, string>()

    for (const nodeId of allNodeIds) {
      dependents.set(nodeId, [])
      incomingEdges.set(nodeId, [])
      remainingDeps.set(nodeId, 0)
    }

    for (const edge of input.edges) {
      if (!restricted.has(edge.source) || !restricted.has(edge.target)) continue
      dependents.get(edge.source)?.push(edge.target)
      incomingEdges.get(edge.target)?.push(edge)
      remainingDeps.set(edge.target, (remainingDeps.get(edge.target) ?? 0) + 1)
    }

    const readyQueue: string[] = []
    for (const nodeId of allNodeIds) {
      if ((remainingDeps.get(nodeId) ?? 0) === 0) readyQueue.push(nodeId)
    }

    type LaunchTaskItem = {
      ctx: PhaseNodeContext
      task: typeof llmTask | typeof cropImageTask | typeof extractFrameTask
      payload: unknown
      fallbackError: string
      launchKey: string
    }

    type RunningTaskItem = {
      ctx: PhaseNodeContext
      runId: string
      fallbackError: string
    }

    const startedNodes = new Set<string>()
    const runningTaskNodes = new Map<string, RunningTaskItem>()
    const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELED", "CRASHED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"])
    let settledCount = 0

    const settleNode = (nodeId: string) => {
      settledCount += 1
      for (const targetId of dependents.get(nodeId) ?? []) {
        const next = (remainingDeps.get(targetId) ?? 1) - 1
        remainingDeps.set(targetId, next)
        if (next === 0 && !startedNodes.has(targetId)) {
          readyQueue.push(targetId)
        }
      }
    }

    const runImmediateNode = async (ctx: PhaseNodeContext) => {
      try {
        if (ctx.node.type === "text") {
          await markNodeSuccess(ctx, ctx.nodeData.kind === "text" ? ctx.nodeData.text : "")
        } else if (ctx.node.type === "uploadImage") {
          await markNodeSuccess(ctx, ctx.nodeData.kind === "uploadImage" ? ctx.nodeData.imageUrl : "")
        } else if (ctx.node.type === "uploadVideo") {
          await markNodeSuccess(ctx, ctx.nodeData.kind === "uploadVideo" ? ctx.nodeData.videoUrl : "")
        } else {
          await markNodeSuccess(ctx, null)
        }
      } catch (error) {
        await markNodeFailure(ctx, error)
      } finally {
        settleNode(ctx.nodeId)
      }
    }

    const createContext = async (nodeId: string): Promise<PhaseNodeContext | null> => {
      const node = nodesById.get(nodeId)
      if (!node) return null

      const nodeData = (node.data ?? {}) as WorkflowNodeData
      const rawInputs = collectInputs(node, nodesById, input.edges, outputs)
      const inputs = normalizeNodeInputs(rawInputs)
      const nodeRun = await db.nodeRun.create({
        data: {
          runId: input.runId,
          nodeId,
          nodeType: node.type || "unknown",
          nodeName: getNodeName(node.type),
          status: "running",
          input: toJsonSafe(inputs),
        },
      })

      return {
        nodeId,
        node,
        nodeData,
        inputs,
        nodeRunId: nodeRun.id,
        startedAt: performance.now(),
      }
    }

    const extractRunErrorMessage = (run: any, fallback: string) => {
      if (typeof run?.error?.message === "string" && run.error.message.trim().length > 0) {
        return run.error.message
      }
      if (typeof run?.error === "string" && run.error.trim().length > 0) {
        return run.error
      }
      const status = typeof run?.status === "string" ? run.status : "UNKNOWN"
      const runId = typeof run?.id === "string" && run.id.length > 0 ? run.id : undefined
      return runId ? `${fallback} (status: ${status}, runId: ${runId})` : `${fallback} (status: ${status})`
    }

    while (settledCount < allNodeIds.length) {
      const launchItems: LaunchTaskItem[] = []

      while (readyQueue.length > 0) {
        const nodeId = readyQueue.shift()!
        if (startedNodes.has(nodeId)) continue
        startedNodes.add(nodeId)

        const ctx = await createContext(nodeId)
        if (!ctx) {
          settleNode(nodeId)
          continue
        }

        const failedUpstreamEdges = (incomingEdges.get(nodeId) ?? []).filter((edge) => failedNodeErrors.has(edge.source))
        if (failedUpstreamEdges.length > 0) {
          const upstreamNodeNames = failedUpstreamEdges
            .map((edge) => getNodeName(nodesById.get(edge.source)?.type))
            .filter(Boolean)
          const uniqueNames = Array.from(new Set(upstreamNodeNames))
          const dependencySuffix = uniqueNames.length > 0 ? ` (${uniqueNames.join(", ")})` : ""

          await markNodeFailure(
            ctx,
            `Upstream dependency failed${dependencySuffix}. Fix the failed upstream node and retry.`
          )
          settleNode(ctx.nodeId)
          continue
        }

        if (ctx.node.type === "llm") {
          const llmData = ctx.nodeData.kind === "llm" ? ctx.nodeData : null
          const connectedImageInputs = input.edges.some(
            (edge) => edge.target === ctx.nodeId && edge.targetHandle === "images" && restricted.has(edge.source)
          )
          const images = Array.isArray(ctx.inputs.images)
            ? ctx.inputs.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
            : (llmData?.imageUrls ?? []).filter((image): image is string => typeof image === "string" && image.trim().length > 0)

          if (connectedImageInputs && images.length === 0) {
            await markNodeFailure(
              ctx,
              "LLM node has a connected image input but no valid image was produced. Fix upstream image nodes and retry."
            )
            settleNode(ctx.nodeId)
            continue
          }

          launchItems.push({
            ctx,
            task: llmTask,
            payload: {
              model: String(ctx.inputs.model ?? llmData?.modelId ?? "gemini-2.5-flash-lite"),
              systemPrompt: ctx.inputs.system_prompt != null ? String(ctx.inputs.system_prompt) : llmData?.systemPrompt,
              userMessage: String(ctx.inputs.user_message ?? llmData?.userMessage ?? ""),
              images,
            },
            fallbackError: "Unable to fetch output",
            launchKey: `${input.runId}:${ctx.nodeId}`,
          })
          continue
        }

        if (ctx.node.type === "cropImage") {
          try {
            const cropData = ctx.nodeData.kind === "cropImage" ? ctx.nodeData : null
            const imageUrlCandidate =
              typeof ctx.inputs.image_url === "string" && ctx.inputs.image_url.trim().length > 0
                ? ctx.inputs.image_url
                : cropData?.imageUrl

            if (typeof imageUrlCandidate !== "string" || imageUrlCandidate.trim().length === 0) {
              throw new Error(
                "Crop Image requires a non-empty image_url input. Connect an Upload Image or Extract Frame output to image_url, or upload an image directly in the Crop Image node."
              )
            }

            launchItems.push({
              ctx,
              task: cropImageTask,
              payload: {
                imageUrl: imageUrlCandidate,
                xPercent: Number(ctx.inputs.x_percent ?? cropData?.x_percent ?? 0),
                yPercent: Number(ctx.inputs.y_percent ?? cropData?.y_percent ?? 0),
                widthPercent: Number(ctx.inputs.width_percent ?? cropData?.width_percent ?? 100),
                heightPercent: Number(ctx.inputs.height_percent ?? cropData?.height_percent ?? 100),
              },
              fallbackError: "Crop task failed",
              launchKey: `${input.runId}:${ctx.nodeId}`,
            })
          } catch (error) {
            await markNodeFailure(ctx, error)
            settleNode(ctx.nodeId)
          }
          continue
        }

        if (ctx.node.type === "extractFrame") {
          try {
            const extractData = ctx.nodeData.kind === "extractFrame" ? ctx.nodeData : null
            const videoUrlCandidate =
              typeof ctx.inputs.video_url === "string" && ctx.inputs.video_url.trim().length > 0
                ? ctx.inputs.video_url
                : extractData?.videoUrl

            if (typeof videoUrlCandidate !== "string" || videoUrlCandidate.trim().length === 0) {
              throw new Error(
                "Extract Frame requires a non-empty video_url input. Connect an Upload Video node to video_url or set the node video URL."
              )
            }

            launchItems.push({
              ctx,
              task: extractFrameTask,
              payload: {
                videoUrl: videoUrlCandidate,
                timestamp: String(ctx.inputs.timestamp ?? extractData?.timestamp ?? "0"),
              },
              fallbackError: "Extract frame task failed",
              launchKey: `${input.runId}:${ctx.nodeId}`,
            })
          } catch (error) {
            await markNodeFailure(ctx, error)
            settleNode(ctx.nodeId)
          }
          continue
        }

        await runImmediateNode(ctx)
      }

      if (launchItems.length > 0) {
        for (const item of launchItems) {
          try {
            const handle = await item.task.trigger(item.payload as any, {
              idempotencyKey: item.launchKey,
            })
            const runId = (handle as any)?.id
            if (!runId) {
              await markNodeFailure(item.ctx, item.fallbackError)
              settleNode(item.ctx.nodeId)
              continue
            }

            runningTaskNodes.set(item.ctx.nodeId, {
              ctx: item.ctx,
              runId,
              fallbackError: item.fallbackError,
            })
          } catch (error) {
            await markNodeFailure(item.ctx, error)
            settleNode(item.ctx.nodeId)
          }
        }
      }

      if (settledCount >= allNodeIds.length) break

      if (runningTaskNodes.size === 0) {
        // Safety valve for unexpected scheduler deadlocks.
        break
      }

      let completedThisPoll = 0
      for (const [nodeId, runningItem] of Array.from(runningTaskNodes.entries())) {
        const run = (await runs.retrieve(runningItem.runId as any)) as any
        const status = String(run?.status ?? "")
        if (!terminalStatuses.has(status)) continue

        completedThisPoll += 1
        if (status === "COMPLETED") {
          await markNodeSuccess(runningItem.ctx, String(run?.output ?? ""))
        } else {
          await markNodeFailure(runningItem.ctx, extractRunErrorMessage(run, runningItem.fallbackError))
        }

        runningTaskNodes.delete(nodeId)
        settleNode(nodeId)
      }

      if (completedThisPoll === 0) {
        await wait.for({ seconds: 1 })
      }
    }

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
      if (sourceOutput == null) continue
      const prev = Array.isArray(input.images) ? (input.images as unknown[]) : []
      input.images = [...prev, sourceOutput]
    } else {
      if (sourceOutput !== undefined) {
        input[edge.targetHandle] = sourceOutput
      }
    }
  }

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

function normalizeNodeInputs(input: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    if (key === "images" && Array.isArray(value)) {
      normalized.images = value
        .filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      continue
    }
    normalized[key] = value
  }

  return normalized
}

function toJsonSafe(value: unknown): unknown {
  if (value == null) return null

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => toJsonSafe(entry)) as Prisma.InputJsonArray
  }

  if (typeof value === "object") {
    const objectValue: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue
      objectValue[key] = toJsonSafe(entry)
    }
    return objectValue
  }

  return String(value)
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