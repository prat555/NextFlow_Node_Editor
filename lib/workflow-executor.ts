import type { Edge, Node } from "@xyflow/react"

import { buildExecutionPhases, validateDAG } from "@/lib/dag-utils"

export type ExecutionMode = "full" | "selected" | "single"

export type WorkflowScopeLabel = "Full Workflow" | "Partial" | "Single Node"

export type NodeExecutionResult = {
  status: "success" | "failed"
  output?: unknown
  error?: string
  outputPreview?: string
}

export type ExecuteWorkflowInput = {
  nodes: Node[]
  edges: Edge[]
  mode: ExecutionMode
  selectedNodeIds?: string[]
  runNode: (node: Node, inputs: Record<string, unknown>, upstreamOutputs: Record<string, unknown>) => Promise<NodeExecutionResult>
  onNodeStart?: (nodeId: string) => void
  onNodeFinish?: (nodeId: string, result: NodeExecutionResult) => void
}

export type ExecuteWorkflowOutput = {
  scope: WorkflowScopeLabel
  durationMs: number
  status: "success" | "failed" | "partial"
  nodeDetails: Array<{
    nodeId: string
    nodeName: string
    status: "success" | "failed"
    durationMs: number
    outputPreview?: string
    error?: string
  }>
}

function toScope(mode: ExecutionMode, selectedCount: number): WorkflowScopeLabel {
  if (mode === "full") return "Full Workflow"
  if (selectedCount <= 1 || mode === "single") return "Single Node"
  return "Partial"
}

function buildRestrictedSet(mode: ExecutionMode, nodes: Node[], edges: Edge[], selectedNodeIds?: string[]): Set<string> {
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

function resolveOutputFromSource(node: Node | undefined, sourceHandle?: string | null) {
  if (!node) return undefined
  const data = (node.data ?? {}) as Record<string, unknown>

  if (sourceHandle === "video_out") return data.videoUrl
  if (sourceHandle === "text_out") return data.outputText ?? data.text
  if (sourceHandle === "image_out") return data.croppedUrl ?? data.imageUrl ?? data.frameUrl

  // Canonical handle
  if (sourceHandle === "output") {
    if (node.type === "uploadVideo") return data.videoUrl
    if (node.type === "text" || node.type === "llm") return data.outputText ?? data.text
    return data.croppedUrl ?? data.imageUrl ?? data.frameUrl
  }

  return data.outputText ?? data.croppedUrl ?? data.imageUrl ?? data.frameUrl ?? data.videoUrl ?? data.text
}

function collectInputs(node: Node, nodesById: Map<string, Node>, edges: Edge[], upstreamOutputs: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  const nodeData = (node.data ?? {}) as Record<string, unknown>

  for (const edge of edges) {
    if (edge.target !== node.id || !edge.targetHandle) continue
    const sourceOutput = upstreamOutputs[edge.source] ?? resolveOutputFromSource(nodesById.get(edge.source), edge.sourceHandle)

    if (edge.targetHandle === "images") {
      const prev = Array.isArray(input.images) ? (input.images as unknown[]) : []
      input.images = [...prev, sourceOutput]
    } else {
      input[edge.targetHandle] = sourceOutput
    }
  }

  // Local fallback values for unconnected fields.
  if (node.type === "llm") {
    input.model = nodeData.modelId
    if (input.system_prompt == null) input.system_prompt = nodeData.systemPrompt
    if (input.user_message == null) input.user_message = nodeData.userMessage
    if (input.images == null) input.images = nodeData.imageUrls
  }

  if (node.type === "cropImage") {
    if (input.image_url == null) input.image_url = nodeData.imageUrl
    if (input.x_percent == null) input.x_percent = nodeData.x_percent
    if (input.y_percent == null) input.y_percent = nodeData.y_percent
    if (input.width_percent == null) input.width_percent = nodeData.width_percent
    if (input.height_percent == null) input.height_percent = nodeData.height_percent
  }

  if (node.type === "extractFrame") {
    if (input.video_url == null) input.video_url = nodeData.videoUrl
    if (input.timestamp == null) input.timestamp = nodeData.timestamp
  }

  if (node.type === "text") {
    input.text = nodeData.text
  }

  return input
}

export async function executeWorkflow(input: ExecuteWorkflowInput): Promise<ExecuteWorkflowOutput> {
  const start = performance.now()
  const nodesById = new Map(input.nodes.map((n) => [n.id, n]))
  const restricted = buildRestrictedSet(input.mode, input.nodes, input.edges, input.selectedNodeIds)

  const validation = validateDAG(input.nodes, input.edges)
  if (!validation.valid) {
    return {
      scope: toScope(input.mode, input.selectedNodeIds?.length ?? 0),
      durationMs: performance.now() - start,
      status: "failed",
      nodeDetails: [],
    }
  }

  const phases = buildExecutionPhases(input.nodes, input.edges, restricted)
  const outputs: Record<string, unknown> = {}
  const nodeDetails: ExecuteWorkflowOutput["nodeDetails"] = []

  for (const phase of phases) {
    // Safe to parallelize here: not inside a Trigger.dev task
    // Trigger.dev constraint only applies when wrapping task waits in Promise.all
    await Promise.all(
      phase.map(async (nodeId) => {
        const node = nodesById.get(nodeId)
        if (!node || !restricted.has(nodeId)) return

        input.onNodeStart?.(nodeId)
        const t0 = performance.now()

        const result = await input.runNode(node, collectInputs(node, nodesById, input.edges, outputs), outputs)
        if (result.status === "success") {
          outputs[nodeId] = result.output
        }

        input.onNodeFinish?.(nodeId, result)
        const t1 = performance.now()

        nodeDetails.push({
          nodeId,
          nodeName: String(node.type ?? "node"),
          status: result.status,
          durationMs: Math.max(0.1, t1 - t0),
          outputPreview: result.outputPreview,
          error: result.error,
        })
      }),
    )
  }

  const failed = nodeDetails.filter((n) => n.status === "failed").length
  const status: ExecuteWorkflowOutput["status"] =
    failed === 0 ? "success" : failed === nodeDetails.length ? "failed" : "partial"

  return {
    scope: toScope(input.mode, input.selectedNodeIds?.length ?? 0),
    durationMs: performance.now() - start,
    status,
    nodeDetails,
  }
}
