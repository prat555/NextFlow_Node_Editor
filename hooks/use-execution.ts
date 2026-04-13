import { useCallback, useEffect, useRef } from "react"

import { useWorkflowStore } from "@/components/workflow-canvas/workflow-store"
import type { WorkflowHistoryEntry } from "@/components/workflow-canvas/types"
import { buildExecutionPhases } from "@/lib/dag-utils"

function defaultNodeFailureMessage(nodeType?: string) {
  switch (nodeType) {
    case "llm":
      return "The AI response could not be generated. Please try again."
    case "cropImage":
      return "Image editing could not be completed. Please check the image and crop settings, then retry."
    case "extractFrame":
      return "Frame extraction failed. Please verify the video source and timestamp, then retry."
    case "uploadImage":
      return "Image upload failed. Please try uploading again."
    case "uploadVideo":
      return "Video upload failed. Please try uploading again."
    default:
      return "This step failed. Please try again."
  }
}

function toFriendlyNodeError(nodeType: string | undefined, rawError: unknown) {
  const message = typeof rawError === "string" ? rawError.trim() : ""
  if (!message) return defaultNodeFailureMessage(nodeType)

  const normalized = message.toLowerCase()

  if (normalized.includes("non-empty video_url")) {
    return "Please connect a video output to this node before running."
  }

  if (normalized.includes("non-empty image_url") || normalized.includes("imageurl is required")) {
    return "Please provide an image source for this Crop Image node before running."
  }

  if (normalized.includes("connected image input") && normalized.includes("no valid image")) {
    return "No valid image reached this LLM node. Fix the upstream image nodes or connection and run again."
  }

  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return "This step took too long to finish. Please try again."
  }

  if (normalized.includes("quota") || normalized.includes("429") || normalized.includes("rate limit")) {
    return "The AI service is busy right now. Please wait a moment and retry."
  }

  if (normalized.includes("credentials are missing") || normalized.includes("api_key") || normalized.includes("not set")) {
    return "A required API key is missing in project settings. Please contact the workspace owner."
  }

  if (normalized.includes("transloadit") || normalized.includes("assembly")) {
    return "Media processing is temporarily unavailable. Please retry in a moment."
  }

  if (normalized.includes("upstream dependency failed")) {
    return "This step depends on an upstream node that failed. Fix upstream errors and run again."
  }

  if (
    normalized.includes("unable to fetch output") ||
    normalized.includes("crop task failed") ||
    normalized.includes("extract frame task failed") ||
    normalized.includes("node execution failed")
  ) {
    return defaultNodeFailureMessage(nodeType)
  }

  return defaultNodeFailureMessage(nodeType)
}

export function useExecution(workflowId: string) {
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const history = useWorkflowStore((s) => s.history)
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const isRunning = useWorkflowStore((s) => s.isExecuting)
  const setIsExecuting = useWorkflowStore((s) => s.setIsExecuting)
  const setRunningNodes = useWorkflowStore((s) => s.setRunningNodes)
  const setHistoryEntries = useWorkflowStore((s) => s.setHistoryEntries)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
    }
  }, [])

  const startExecution = useCallback(
    async (mode: "full" | "partial" | "single", selectedNodeIds?: string[]) => {
      if (isRunning || nodes.length === 0) return
      const nodesToRun = mode === "full" ? nodes.map((n) => n.id) : (selectedNodeIds ?? [])
      if (mode !== "full" && nodesToRun.length === 0) return
      const executionPhases = buildExecutionPhases(nodes, edges, mode === "full" ? undefined : new Set(nodesToRun))
      const initialRunningNodeIds = executionPhases[0] ?? nodesToRun

      setIsExecuting(true)
      setRunningNodes(initialRunningNodeIds, true)

      try {
        await fetch(`/api/workflows/${workflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges, name: workflowName }),
        })

        const startRes = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowId,
            nodes,
            edges,
            mode,
            selectedNodeIds,
          }),
        })

        if (!startRes.ok) throw new Error("Failed to start execution")

        const startBody = await startRes.json()
        const runId = String(startBody.runId || "")
        if (!runId) throw new Error("Missing runId")

        if (pollRef.current) {
          clearInterval(pollRef.current)
        }

        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/runs/${runId}`)
            if (!pollRes.ok) return

            const pollData = await pollRes.json()
            const run = pollData.run ?? pollData
            const nodeRuns = run?.nodeRuns ?? []

            const runningNodeIds = new Set(
              nodeRuns
                .filter((nr: any) => nr.status === "running")
                .map((nr: any) => String(nr.nodeId))
            )

            // Replace the visual running set with the nodes that are actually running.
            setRunningNodes(Array.from(runningNodeIds), true)
            setRunningNodes(nodesToRun.filter((nodeId) => !runningNodeIds.has(nodeId)), false)

            for (const nodeRun of nodeRuns) {
              const node = nodes.find((n) => n.id === nodeRun.nodeId)

              if (nodeRun.status === "failed") {
                const failureMessage = toFriendlyNodeError(node?.type, nodeRun.error)

                const updates: Record<string, unknown> = {
                  execution: "failed",
                  errorMessage: failureMessage,
                }

                if (node?.type === "llm") {
                  updates.outputText = undefined
                } else if (node?.type === "cropImage") {
                  updates.croppedUrl = undefined
                } else if (node?.type === "extractFrame") {
                  updates.frameUrl = undefined
                }

                updateNodeData(nodeRun.nodeId, updates as any)
                continue
              }

              if (nodeRun.status === "success") {
                const outputValue = nodeRun?.output?.output
                const updates: Record<string, unknown> = {
                  execution: "executed",
                  errorMessage: undefined,
                }

                if (node?.type === "llm") {
                  updates.outputText = typeof outputValue === "string" ? outputValue : nodeRun.outputPreview
                } else if (node?.type === "cropImage" && typeof outputValue === "string") {
                  updates.croppedUrl = outputValue
                } else if (node?.type === "extractFrame" && typeof outputValue === "string") {
                  updates.frameUrl = outputValue
                }

                updateNodeData(nodeRun.nodeId, updates as any)
              }
            }

            if (run?.status === "success" || run?.status === "failed" || run?.status === "partial") {
              if (run.status === "failed" || run.status === "partial") {
                const reportedNodeIds = new Set(nodeRuns.map((nr: any) => String(nr.nodeId)))
                const missingNodeIds = nodesToRun.filter((nodeId) => !reportedNodeIds.has(nodeId))

                for (const missingNodeId of missingNodeIds) {
                  updateNodeData(missingNodeId, {
                    execution: "failed",
                    errorMessage: "This step did not complete because the workflow run ended early. Please retry.",
                  } as any)
                }
              }

              if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
              }

              const entry: WorkflowHistoryEntry = {
                id: run.id,
                timestamp: run.startedAt,
                status: run.status,
                durationMs: run.durationMs || 0,
                scope: run.scope === "full" ? "Full Workflow" : run.scope === "single" ? "Single Node" : "Partial",
                nodeDetails:
                  nodeRuns?.map((nr: any) => ({
                    nodeId: nr.nodeId,
                    nodeName: nr.nodeName,
                    durationMs: nr.durationMs,
                    status: nr.status,
                    outputPreview: nr.outputPreview,
                    error: nr.error,
                  })) || [],
              }

              setHistoryEntries([entry, ...history.filter((h) => h.id !== entry.id)])
              setRunningNodes(nodesToRun, false)
              setIsExecuting(false)
            }
          } catch {
            // Keep polling until terminal status or manual retry.
          }
        }, 2000)
      } catch {
        setRunningNodes(nodesToRun, false)
        setIsExecuting(false)
      }
    },
    [
      edges,
      history,
      isRunning,
      nodes,
      setHistoryEntries,
      setIsExecuting,
      setRunningNodes,
      updateNodeData,
      workflowId,
      workflowName,
    ],
  )

  return { isRunning, startExecution }
}
