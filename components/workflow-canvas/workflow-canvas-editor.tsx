"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MiniMap,
  MarkerType,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
} from "@xyflow/react"
import {
  ChevronDown,
  Clock,
  Command,
  Diamond,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Moon,
  Plus,
  Scissors,
  Sparkles,
  Sun,
  Zap,
  Hand,
  Settings,
  Crop,
  MousePointer2,
  Link2,
  Home,
  GitFork,
  Folder,
  Loader2,
  Play,
  X,
  PanelLeft,
  Coins,
  LogOut,
  ZoomIn,
  ZoomOut,
  Scan,
} from "lucide-react"

import { useWorkflowStore } from "./workflow-store"
import type {
  CanvasMode,
  NodeKind,
  ToolMode,
  WorkflowHistoryEntry,
  WorkflowHistoryNodeDetail,
  WorkflowNodeData,
  WorkflowScopeLabel,
} from "./types"
import { getInputTypeForHandle, getOutputTypeForHandle, willCreateCycle } from "./graph-utils"
import { workflowEdgeTypes } from "./workflow-edges"
import { workflowNodeTypes } from "./workflow-nodes"
import type { WorkflowHistoryEntry as HistoryEntryType } from "./types"
import { usePathname, useRouter } from "next/navigation"
import { SidebarToggleButton } from "@/components/sidebar-toggle-button"
import { useClerk, useUser } from "@clerk/nextjs"
import { useExecution } from "@/hooks/use-execution"
import { useIsMobile } from "@/hooks/use-mobile"
import { MarkdownOutput } from "./markdown-output"

function isEditableTarget(target: EventTarget | null) {
  if (!target) return false
  const el = target as HTMLElement
  const tag = el.tagName?.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select" || (el as any).isContentEditable
}

const workflowNodeButtons: { kind: NodeKind; name: string; icon: React.ReactNode; color: string; accepts: string }[] = [
  { kind: "text", name: "Text Node", icon: <FileText className="w-4 h-4" />, color: "text-[#999]", accepts: "text" },
  { kind: "uploadImage", name: "Upload Image", icon: <ImageIcon className="w-4 h-4" />, color: "text-[#3b82f6]", accepts: "image" },
  { kind: "uploadVideo", name: "Upload Video", icon: <Film className="w-4 h-4" />, color: "text-[#f97316]", accepts: "video" },
  { kind: "llm", name: "LLM Node", icon: <Sparkles className="w-4 h-4" />, color: "text-[#a855f7]", accepts: "text" },
  { kind: "cropImage", name: "Crop Image", icon: <Crop className="w-4 h-4" />, color: "text-[#22c55e]", accepts: "image" },
  { kind: "extractFrame", name: "Extract Frame", icon: <Film className="w-4 h-4" />, color: "text-[#facc15]", accepts: "video" },
]

function placeholderDataUrl(text: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0f0f10"/>
        <stop offset="1" stop-color="#1c1c1e"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="600" height="400" fill="url(#g)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="22">${text}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function WorkflowCanvasEditor({ workflowId }: { workflowId: string }) {
  const flowWrapperRef = useRef<HTMLDivElement | null>(null)
  const emptyOverlayRef = useRef<HTMLDivElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)

  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useClerk()
  const { user } = useUser()
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const history = useWorkflowStore((s) => s.history)
  const toolMode = useWorkflowStore((s) => s.toolMode)
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const isExecuting = useWorkflowStore((s) => s.isExecuting)
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const historyPanelOpen = useWorkflowStore((s) => s.historyPanelOpen)
  const invalidFlash = useWorkflowStore((s) => s.invalidFlash)

  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds)

  const setNodesEdges = useWorkflowStore((s) => s.setNodesEdges)
  const commitSnapshot = useWorkflowStore((s) => s.commitSnapshot)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)
  const addNode = useWorkflowStore((s) => s.addNode)
  const removeNode = useWorkflowStore((s) => s.removeNode)
  const removeEdge = useWorkflowStore((s) => s.removeEdge)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const resetExecution = useWorkflowStore((s) => s.resetExecution)
  const setRunningNodes = useWorkflowStore((s) => s.setRunningNodes)
  const setHistoryEntries = useWorkflowStore((s) => s.setHistoryEntries)
  const setSelectedNodeIds = useWorkflowStore((s) => s.setSelectedNodeIds)
  const toggleCanvasMode = useWorkflowStore((s) => s.toggleCanvasMode)
  const setToolMode = useWorkflowStore((s) => s.setToolMode)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)
  const setIsExecuting = useWorkflowStore((s) => s.setIsExecuting)
  const setHistoryPanelOpen = useWorkflowStore((s) => s.setHistoryPanelOpen)
  const replaceCanvas = useWorkflowStore((s) => s.replaceCanvas)
  const flashInvalid = useWorkflowStore((s) => s.flashInvalid)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [emptyOverlayDismissed, setEmptyOverlayDismissed] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const isMobile = useIsMobile()
  const showMiniMap = !isMobile

  const [nodeSearchOpen, setNodeSearchOpen] = useState(false)
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [nodeSearchQuery, setNodeSearchQuery] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [workflowNameDraft, setWorkflowNameDraft] = useState(workflowName)
  const previousToolRef = useRef<ToolMode | null>(null)
  const spacePanRef = useRef(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const hasLocalCanvasChangesRef = useRef(false)

  const canvasBg = canvasMode === "light" ? "#f0f0f0" : "#0d0d0d"
  const { startExecution } = useExecution(workflowId)

  const markCanvasDirty = useCallback(() => {
    hasLocalCanvasChangesRef.current = true
  }, [])

  useEffect(() => {
    hasLocalCanvasChangesRef.current = false
  }, [workflowId])

  useEffect(() => {
    setWorkflowNameDraft(workflowName)
  }, [workflowName])

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true)
      setHistoryPanelOpen(false)
      setMobileSidebarOpen(false)
      return
    }

    setMobileSidebarOpen(false)
  }, [isMobile, setHistoryPanelOpen])

  useEffect(() => {
    if (!profileMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as any)) {
        setProfileMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [profileMenuOpen])

  const addNodeAtCanvasCenter = useCallback(
    (kind: NodeKind) => {
      if (!reactFlowInstance || !flowWrapperRef.current) return
      const rect = flowWrapperRef.current.getBoundingClientRect()
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + (rect.height ?? 0) / 2,
      }
      const pos = reactFlowInstance.screenToFlowPosition(center)
      markCanvasDirty()
      commitSnapshot()
      addNode(kind, pos)
    },
    [reactFlowInstance, addNode, commitSnapshot, markCanvasDirty]
  )

  const loadSampleWorkflow = useCallback(() => {
    const nodesToAdd: Node<WorkflowNodeData>[] = [
      {
        id: "8a35bd60-d634-456b-ac7c-93b2592449a5",
        type: "cropImage",
        position: { x: 989.8057337275834, y: 167.5800231338743 },
        data: {
          kind: "cropImage",
          execution: "idle",
          x_percent: 2,
          y_percent: 2,
          width_percent: 98,
          height_percent: 98,
          image_urlConnected: true,
        } as WorkflowNodeData,
      },
      {
        id: "733a460a-89dc-4880-9c19-a2fe7932185d",
        type: "uploadImage",
        position: { x: 622.9529057570621, y: 146.584590413047 },
        data: { kind: "uploadImage", execution: "idle" } as WorkflowNodeData,
      },
      {
        id: "17f9f10c-778d-443d-87b7-20fc94ee6325",
        type: "text",
        position: { x: 754.3914269563209, y: -114.373004526078 },
        data: {
          kind: "text",
          text: "product is a wirless headphone with noice cancellation and 30hr battery",
          execution: "idle",
        } as WorkflowNodeData,
      },
      {
        id: "cfa2547b-0b6d-46ac-87be-f55beb0e72bf",
        type: "text",
        position: { x: 1081.339454154327, y: -164.4267527561366 },
        data: {
          kind: "text",
          text: "you are marketing copywriter. give two line product description",
          execution: "idle",
        } as WorkflowNodeData,
      },
      {
        id: "a28de4c9-e19e-4da9-9e3a-8ee783f9c1fc",
        type: "extractFrame",
        position: { x: 1833.953121976663, y: 344.4565857453929 },
        data: {
          kind: "extractFrame",
          execution: "idle",
          timestamp: "50%",
          video_urlConnected: true,
        } as WorkflowNodeData,
      },
      {
        id: "13d0f8ec-cc45-4310-9d69-20f1f02c628a",
        type: "uploadVideo",
        position: { x: 1404.324873287597, y: -237.5728288470882 },
        data: { kind: "uploadVideo", execution: "idle" } as WorkflowNodeData,
      },
      {
        id: "1df367c6-eea2-40ae-a07a-35cd68c97cfa",
        type: "text",
        position: { x: 1765.918458592719, y: -105.9207038478895 },
        data: {
          kind: "text",
          text: "you are social media manager. give content for a two line tweet about product.",
          execution: "idle",
        } as WorkflowNodeData,
      },
      {
        id: "d6c11e8f-5d77-4d04-be42-3532bf72c5bc",
        type: "llm",
        position: { x: 1423.528831286269, y: -18.54286167436473 },
        data: {
          kind: "llm",
          modelId: "gemini-2.5-flash-lite",
          execution: "idle",
          imageUrls: [],
          userMessage: "",
          systemPrompt: "",
          user_messageConnected: true,
          system_promptConnected: true,
        } as WorkflowNodeData,
      },
      {
        id: "376b7e81-dc6b-4522-b314-fffc0cc11b9b",
        type: "llm",
        position: { x: 2155.801652058023, y: -78.90374494839222 },
        data: {
          kind: "llm",
          modelId: "gemini-2.5-flash-lite",
          execution: "idle",
          imageUrls: [],
          userMessage: "",
          systemPrompt: "",
          imagesConnected: true,
          user_messageConnected: true,
          system_promptConnected: true,
        } as WorkflowNodeData,
      },
    ]

    const edgesToAdd: Edge<any>[] = [
      {
        id: "96900735-77f2-473b-842d-994bbe78fe14",
        data: { typeTag: "image" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "733a460a-89dc-4880-9c19-a2fe7932185d",
        target: "8a35bd60-d634-456b-ac7c-93b2592449a5",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "image_url",
      },
      {
        id: "486a3328-bb5f-4d4c-bc02-5a9b058ab90b",
        data: { typeTag: "video" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "13d0f8ec-cc45-4310-9d69-20f1f02c628a",
        target: "a28de4c9-e19e-4da9-9e3a-8ee783f9c1fc",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "video_url",
      },
      {
        id: "4b73ebb4-5db7-49c1-9b01-8b708b7b271a",
        data: { typeTag: "text" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "cfa2547b-0b6d-46ac-87be-f55beb0e72bf",
        target: "d6c11e8f-5d77-4d04-be42-3532bf72c5bc",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "system_prompt",
      },
      {
        id: "d57cd129-cd3d-47af-b4b8-876820729881",
        data: { typeTag: "text" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "17f9f10c-778d-443d-87b7-20fc94ee6325",
        target: "d6c11e8f-5d77-4d04-be42-3532bf72c5bc",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "user_message",
      },
      {
        id: "8fd4a5e2-2dc3-4448-a4ce-8bdede808baf",
        data: { typeTag: "text" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "d6c11e8f-5d77-4d04-be42-3532bf72c5bc",
        target: "376b7e81-dc6b-4522-b314-fffc0cc11b9b",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "user_message",
      },
      {
        id: "870c2dd6-72f8-45b7-befd-5ffe32470da7",
        data: { typeTag: "text" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "1df367c6-eea2-40ae-a07a-35cd68c97cfa",
        target: "376b7e81-dc6b-4522-b314-fffc0cc11b9b",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "system_prompt",
      },
      {
        id: "b2d08c61-f003-4d58-b563-424d5fc2cbe5",
        data: { typeTag: "image" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "a28de4c9-e19e-4da9-9e3a-8ee783f9c1fc",
        target: "376b7e81-dc6b-4522-b314-fffc0cc11b9b",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "images",
      },
      {
        id: "d44efb5a-01ac-4076-b6ec-d0b30801f322",
        data: { typeTag: "image" },
        type: "workflow",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        source: "8a35bd60-d634-456b-ac7c-93b2592449a5",
        target: "376b7e81-dc6b-4522-b314-fffc0cc11b9b",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        sourceHandle: "output",
        targetHandle: "images",
      },
      {
        source: "8a35bd60-d634-456b-ac7c-93b2592449a5",
        sourceHandle: "output",
        target: "d6c11e8f-5d77-4d04-be42-3532bf72c5bc",
        targetHandle: "images",
        id: "ec63bc4a-cb4d-4a4a-bd44-3f5c7798d8d9",
        type: "workflow",
        animated: false,
        style: { stroke: "#3b82f6", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
        data: { typeTag: "image" },
      },
    ]

    markCanvasDirty()
    commitSnapshot()
    replaceCanvas(nodesToAdd, edgesToAdd)
    setEmptyOverlayDismissed(true)
  }, [commitSnapshot, replaceCanvas, markCanvasDirty])

  const loadSimpleCaptionPreset = useCallback(() => {
    const nodesToAdd: Node<WorkflowNodeData>[] = [
      {
        id: "upload-image-simple-1",
        type: "uploadImage",
        position: { x: 140, y: 220 },
        data: { kind: "uploadImage", imageUrl: undefined, execution: "idle" } as WorkflowNodeData,
      },
      {
        id: "text-simple-1",
        type: "text",
        position: { x: 140, y: 420 },
        data: {
          kind: "text",
          text: "Write one short product caption for social media based on this image.",
          execution: "idle",
        } as WorkflowNodeData,
      },
      {
        id: "llm-simple-1",
        type: "llm",
        position: { x: 520, y: 300 },
        data: {
          kind: "llm",
          systemPrompt: "You are a concise marketing assistant.",
          userMessage: "",
          imageUrls: [],
          modelId: "gemini-2.5-flash-lite",
          execution: "idle",
        } as WorkflowNodeData,
      },
    ]

    const edgesToAdd: Edge<any>[] = [
      {
        id: "simple-e1",
        source: "upload-image-simple-1",
        target: "llm-simple-1",
        sourceHandle: "output",
        targetHandle: "images",
        type: "workflow",
        data: { typeTag: "image" },
      },
      {
        id: "simple-e2",
        source: "text-simple-1",
        target: "llm-simple-1",
        sourceHandle: "output",
        targetHandle: "user_message",
        type: "workflow",
        data: { typeTag: "text" },
      },
    ]

    markCanvasDirty()
    commitSnapshot()
    replaceCanvas(nodesToAdd, edgesToAdd)
    setEmptyOverlayDismissed(true)
  }, [commitSnapshot, replaceCanvas, markCanvasDirty])

  const loadQuickMathPreset = useCallback(() => {
    const nodesToAdd: Node<WorkflowNodeData>[] = [
      {
        id: "text-math-1",
        type: "text",
        position: { x: 160, y: 260 },
        data: {
          kind: "text",
          text: "whats 1+2",
          execution: "idle",
        } as WorkflowNodeData,
      },
      {
        id: "llm-math-1",
        type: "llm",
        position: { x: 560, y: 240 },
        data: {
          kind: "llm",
          systemPrompt: "",
          userMessage: "",
          imageUrls: [],
          modelId: "gemini-2.5-flash-lite",
          execution: "idle",
        } as WorkflowNodeData,
      },
    ]

    const edgesToAdd: Edge<any>[] = [
      {
        id: "math-e1",
        source: "text-math-1",
        target: "llm-math-1",
        sourceHandle: "output",
        targetHandle: "user_message",
        type: "workflow",
        data: { typeTag: "text" },
      },
    ]

    markCanvasDirty()
    commitSnapshot()
    replaceCanvas(nodesToAdd, edgesToAdd)
    setEmptyOverlayDismissed(true)
  }, [commitSnapshot, replaceCanvas, markCanvasDirty])


  useEffect(() => {
    // Load draft from localStorage (UI only).
    const key = `workflow-canvas:${workflowId}`
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        nodes?: Node<WorkflowNodeData>[]
        edges?: Edge<any>[]
        canvasMode?: CanvasMode
        name?: string
      }

      const savedName = typeof parsed.name === "string" ? parsed.name.trim() : ""
      if (savedName) {
        setWorkflowName(savedName)
      }

      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        setNodesEdges(parsed.nodes, parsed.edges)
        if (parsed.nodes.length > 0 || parsed.edges.length > 0) {
          hasLocalCanvasChangesRef.current = true
        }
        setEmptyOverlayDismissed(parsed.nodes.length > 0)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  // Load run history from server for this workflow.
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/runs?workflowId=${encodeURIComponent(workflowId)}`)
        if (!response.ok) return
        const data = await response.json()
        const entries: HistoryEntryType[] = (data.runs ?? []).map((run: any) => ({
          id: run.id,
          timestamp: run.startedAt,
          status: run.status,
          durationMs: run.durationMs || 0,
          scope: run.scope === "full" ? "Full Workflow" : run.scope === "single" ? "Single Node" : "Partial",
          nodeDetails:
            run.nodeRuns?.map((nr: any) => ({
              nodeId: nr.nodeId,
              nodeName: nr.nodeName,
              durationMs: nr.durationMs,
              status: nr.status,
              outputPreview: nr.outputPreview,
              error: nr.error,
            })) || [],
        }))
        setHistoryEntries(entries)
      } catch (error) {
        console.error("Failed to load run history:", error)
      }
    }

    if (workflowId) {
      loadHistory()
    }
  }, [workflowId, setHistoryEntries])

  // Load workflow from server API
  useEffect(() => {
    let cancelled = false

    const loadWorkflow = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`)
        if (!response.ok) return
        const { workflow } = await response.json()
        if (cancelled) return

        if (typeof workflow?.name === "string") {
          setWorkflowName(workflow.name || "Untitled")
        }

        if (hasLocalCanvasChangesRef.current) return

        if (Array.isArray(workflow?.nodes) && Array.isArray(workflow?.edges)) {
          setNodesEdges(workflow.nodes, workflow.edges)
          setEmptyOverlayDismissed(workflow.nodes.length > 0)
        }
      } catch (error) {
        console.error("Failed to load workflow from API:", error)
      }
    }

    if (workflowId) {
      loadWorkflow()
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const saveDraft = useCallback((nameOverride?: string) => {
    const key = `workflow-canvas:${workflowId}`
    const nameToSave = (nameOverride ?? workflowName).trim() || "Untitled"
    const payload = {
      nodes,
      edges,
      canvasMode,
      name: nameToSave,
    }
    window.localStorage.setItem(key, JSON.stringify(payload))

    // Also save to API
    fetch(`/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes, edges, name: nameToSave }),
    }).catch((err) => console.error("Failed to save workflow to API:", err))
  }, [workflowId, nodes, edges, canvasMode, workflowName])

  const commitWorkflowNameDraft = useCallback(() => {
    const nextName = workflowNameDraft.trim() || "Untitled"
    setWorkflowNameDraft(nextName)
    setEditingName(false)

    if (nextName !== workflowName) {
      setWorkflowName(nextName)
    }

    if (!workflowId || workflowId === "new" || nextName === workflowName) return

    fetch(`/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    }).catch((err) => console.error("Failed to persist workflow name:", err))
  }, [workflowId, workflowNameDraft, workflowName, setWorkflowName])

  const exportWorkflow = useCallback(() => {
    const data = JSON.stringify({ name: workflowName, nodes, edges }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${workflowName || "workflow"}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [workflowName, nodes, edges])

  const importWorkflow = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(String(event.target?.result ?? "{}"))
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            markCanvasDirty()
            commitSnapshot()
            replaceCanvas(parsed.nodes, parsed.edges)
          }
          if (typeof parsed.name === "string") {
            setWorkflowName(parsed.name)
          }
        } catch {
          window.alert("Invalid workflow file")
        }
      }
      reader.readAsText(file)
      e.target.value = ""
    },
    [commitSnapshot, replaceCanvas, setWorkflowName, markCanvasDirty],
  )

  // Auto-save workflow to API every 3 seconds after changes.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!workflowId || workflowId === "new") return
      fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workflowName, nodes, edges }),
      }).catch((err) => console.error("Failed to auto-save workflow to API:", err))
    }, 3000)
    return () => window.clearTimeout(t)
  }, [workflowId, workflowName, nodes, edges])

  // Persist draft on changes (debounced).
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const key = `workflow-canvas:${workflowId}`
        const nameToSave = workflowName.trim() || "Untitled"
        window.localStorage.setItem(
          key,
          JSON.stringify({
            nodes,
            edges,
            canvasMode,
            name: nameToSave,
          })
        )
      } catch {
        // ignore
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [workflowId, nodes, edges, canvasMode, workflowName])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        const nextName = workflowNameDraft.trim() || "Untitled"
        setWorkflowName(nextName)
        setWorkflowNameDraft(nextName)
        saveDraft(nextName)
        return
      }

      if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        setSelectedNodeIds(nodes.map((n) => n.id))
        setNodesEdges(
          nodes.map((n) => ({ ...n, selected: true })),
          edges,
        )
        return
      }

      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault()
        if (!spacePanRef.current) {
          previousToolRef.current = toolMode
          spacePanRef.current = true
          setToolMode("pan")
        }
        return
      }

      if (e.key === "Escape") {
        setNodeSearchOpen(false)
        setPresetModalOpen(false)
        setSelectedNodeIds([])
        setNodesEdges(
          nodes.map((n) => ({ ...n, selected: false })),
          edges,
        )
        return
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedNodeIds.length === 0) return
        markCanvasDirty()
        commitSnapshot()
        for (const nodeId of selectedNodeIds) removeNode(nodeId)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return
      if (!spacePanRef.current) return
      spacePanRef.current = false
      setToolMode(previousToolRef.current ?? "select")
      previousToolRef.current = null
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [
    commitSnapshot,
    edges,
    nodes,
    removeNode,
    redo,
    saveDraft,
    selectedNodeIds,
    setNodesEdges,
    setSelectedNodeIds,
    setToolMode,
    setWorkflowName,
    markCanvasDirty,
    toolMode,
    undo,
    workflowNameDraft,
  ])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes)
      const nextNodeIds = new Set(next.map((n) => n.id))

      const orphaned = edges.filter((e) => !nextNodeIds.has(e.source) || !nextNodeIds.has(e.target))
      if (orphaned.length > 0) {
        for (const e of orphaned) {
          if (e.target && e.targetHandle) {
            updateNodeData(e.target, { [`${e.targetHandle}Connected`]: false } as any)
          }
        }
      }

      const liveEdges = edges.filter((e) => nextNodeIds.has(e.source) && nextNodeIds.has(e.target))
      // Drag updates positions quickly; we keep undo snapshots at drag-stop only.
      setNodesEdges(next, liveEdges)
    },
    [nodes, edges, setNodesEdges, updateNodeData]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const toUnset: Array<{ nodeId: string; handleId: string }> = []
      for (const change of changes) {
        if (change.type !== "remove") continue
        const removed = edges.find((e) => e.id === change.id)
        if (!removed?.target || !removed?.targetHandle) continue
        toUnset.push({ nodeId: removed.target, handleId: removed.targetHandle })
      }

      if (toUnset.length) {
        for (const item of toUnset) {
          updateNodeData(item.nodeId, { [`${item.handleId}Connected`]: false } as any)
        }
      }

      const next = applyEdgeChanges(changes, edges)
      setNodesEdges(nodes, next)
    },
    [edges, nodes, setNodesEdges, updateNodeData]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceId = connection.source
      const targetId = connection.target
      const sourceHandleId = connection.sourceHandle
      const targetHandleId = connection.targetHandle
      if (!sourceId || !targetId || !sourceHandleId || !targetHandleId) return

      const sourceNode = nodes.find((n) => n.id === sourceId)
      const targetNode = nodes.find((n) => n.id === targetId)
      if (!sourceNode || !targetNode) return

      const sourceKind = (sourceNode.data as WorkflowNodeData).kind
      const targetKind = (targetNode.data as WorkflowNodeData).kind

      const outType = getOutputTypeForHandle(sourceKind, sourceHandleId)
      const inType = getInputTypeForHandle(targetKind, targetHandleId)
      const liveEdges = edges.filter(
        (e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)
      )

      const invalid =
        !outType ||
        !inType ||
        outType !== inType ||
        (targetHandleId !== "images" && liveEdges.some((e) => e.target === targetId && e.targetHandle === targetHandleId)) ||
        willCreateCycle({ nodes, edges: liveEdges, source: sourceId, target: targetId })

      if (invalid) {
        flashInvalid({
          sourceNodeId: sourceId,
          sourceHandleId,
          targetNodeId: targetId,
          targetHandleId,
        })
        window.setTimeout(() => flashInvalid(null), 900)
        return
      }

      markCanvasDirty()
      commitSnapshot()
      const created = addEdge(
        {
          ...connection,
          id: crypto.randomUUID(),
          type: "workflow",
          animated: false,
          style: { stroke: "#3b82f6", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
          data: { typeTag: outType },
        },
        liveEdges,
      )
      setNodesEdges(nodes as any, created as any)
      updateNodeData(targetId, { [`${targetHandleId}Connected`]: true } as any)
    },
    [commitSnapshot, edges, flashInvalid, nodes, setNodesEdges, updateNodeData, markCanvasDirty]
  )

  const onConnectStart = useCallback(() => {
    // Intentionally left minimal for future UX feedback.
  }, [])

  const onConnectEnd = useCallback(() => {
    // Intentionally left minimal for future UX feedback.
  }, [])

  const isValidConnection = useCallback(
    (connection: any) => {
      const sourceId = connection.source
      const targetId = connection.target
      const sourceHandleId = connection.sourceHandle
      const targetHandleId = connection.targetHandle
      if (!sourceId || !targetId || !sourceHandleId || !targetHandleId) return false

      const sourceNode = nodes.find((n) => n.id === sourceId)
      const targetNode = nodes.find((n) => n.id === targetId)
      if (!sourceNode || !targetNode) return false

      const sourceKind = (sourceNode.data as WorkflowNodeData).kind
      const targetKind = (targetNode.data as WorkflowNodeData).kind

      const outType = getOutputTypeForHandle(sourceKind, sourceHandleId)
      const inType = getInputTypeForHandle(targetKind, targetHandleId)
      const liveEdges = edges.filter(
        (e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)
      )

      const invalid =
        !outType ||
        !inType ||
        outType !== inType ||
        (targetHandleId !== "images" && liveEdges.some((e) => e.target === targetId && e.targetHandle === targetHandleId)) ||
        willCreateCycle({ nodes, edges: liveEdges, source: sourceId, target: targetId })

      if (invalid) {
        flashInvalid({
          sourceNodeId: sourceId,
          sourceHandleId,
          targetNodeId: targetId,
          targetHandleId,
        })
        window.setTimeout(() => flashInvalid(null), 900)
        return false
      }

      return true
    },
    [edges, flashInvalid, nodes]
  )

  const onEdgeClick = useCallback(
    (_e: any, edge: Edge<any>) => {
      if (toolMode !== "cut") return
      eStopPropagation(_e)
      markCanvasDirty()
      commitSnapshot()
      if (edge.target && edge.targetHandle) {
        updateNodeData(edge.target, { [`${edge.targetHandle}Connected`]: false } as any)
      }
      removeEdge(edge.id)
    },
    [commitSnapshot, removeEdge, toolMode, updateNodeData, markCanvasDirty]
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eStopPropagation = (e: any) => {
    try {
      e.stopPropagation()
    } catch {
      // ignore
    }
  }

  const runWorkflow = useCallback(
    async (scope: "all" | "selected") => {
      if (nodes.length === 0) return
      if (scope === "selected" && selectedNodeIds.length === 0) return

      commitSnapshot()
      if (scope === "all") {
        await startExecution("full")
      } else if (selectedNodeIds.length <= 1) {
        await startExecution("single", selectedNodeIds)
      } else {
        await startExecution("partial", selectedNodeIds)
      }
    },
    [commitSnapshot, nodes.length, selectedNodeIds, startExecution],
  )

  const onNodeDragStop = useCallback(() => {
    commitSnapshot()
  }, [commitSnapshot])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const kind = e.dataTransfer.getData("application/x-workflow-node")
      if (!kind) return
      if (!reactFlowInstance || !flowWrapperRef.current) return
      const pos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      markCanvasDirty()
      commitSnapshot()
      addNode(kind as NodeKind, pos)
    },
    [addNode, commitSnapshot, reactFlowInstance, markCanvasDirty]
  )

  const onSelectionChange = useCallback(
    (sel: any) => {
      setSelectedNodeIds((sel?.nodes ?? []).map((n: any) => n.id))
    },
    [setSelectedNodeIds]
  )

  // TODO: ReactFlow types differ a bit between versions; keep a tolerant cast.
  const selectionChangeHandler = onSelectionChange as any

  const edgeTypes = useMemo(() => workflowEdgeTypes as any, [])
  const nodeTypes = useMemo(() => workflowNodeTypes as any, [])

  const showEmptyOverlay = nodes.length === 0 && !emptyOverlayDismissed
  const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 48 : 240
  const userName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    "User"
  const userInitial = userName.charAt(0).toUpperCase()

  useEffect(() => {
    if (!showEmptyOverlay) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (emptyOverlayRef.current?.contains(target)) return
      setEmptyOverlayDismissed(true)
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [showEmptyOverlay])

  return (
    <div
      className="h-dvh w-full overflow-x-hidden overflow-y-auto md:overflow-hidden"
      style={{ background: canvasBg }}
    >
      {/* Top bar */}
      <div
        className={[
          "relative h-15 px-3 flex items-center justify-between z-10 overflow-x-auto",
          "bg-transparent",
        ].join(" ")}
        style={{ marginLeft: isMobile ? 0 : sidebarWidth, width: isMobile ? "100%" : `calc(100% - ${sidebarWidth}px)` }}
      >
        <div className="flex items-center gap-2 h-full px-3">
          <div className={`relative flex items-center gap-2 ${canvasMode === "light" ? "bg-white border border-gray-200" : "bg-[#1a1a1a]"} rounded-xl px-3 py-2 shadow-sm`}>
            <div className={`w-6 h-6 ${canvasMode === "light" ? "bg-gray-100" : "bg-[#2a2a2a]"} rounded-md flex items-center justify-center`}>
              <span className={`${canvasMode === "light" ? "text-black" : "text-white"} text-xs font-bold`}>K</span>
            </div>
            {editingName ? (
              <input
                autoFocus
                className={`bg-transparent ${canvasMode === "light" ? "text-black" : "text-white"} text-sm font-medium outline-none min-w-45`}
                value={workflowNameDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setWorkflowNameDraft(e.target.value)}
                onBlur={commitWorkflowNameDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    ;(e.currentTarget as HTMLInputElement).blur()
                  }
                }}
              />
            ) : (
              <span
                className={`${canvasMode === "light" ? "text-black" : "text-white"} text-sm font-medium min-w-45`}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditingName(true)
                }}
              >
                {workflowName}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-[#888]" />
          </div>
        </div>

        <div className="flex items-center gap-2 px-3">
          <button
            type="button"
            className={`p-2 rounded-lg cursor-pointer ${canvasMode === "light" ? "hover:bg-gray-100 text-gray-600" : "hover:bg-[#1a1a1a] text-[#888]"}`}
            onClick={toggleCanvasMode}
            aria-label="Toggle canvas theme"
          >
            {canvasMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${canvasMode === "light" ? "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm" : "bg-[#1a1a1a] hover:bg-[#222] text-white"} text-sm`}
            aria-label="Share"
          >
            <Diamond className={`w-3.5 h-3.5 ${canvasMode === "light" ? "text-blue-500" : ""}`} />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={exportWorkflow}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${canvasMode === "light" ? "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm" : "bg-[#1a1a1a] hover:bg-[#222] text-white"} text-sm`}
            aria-label="Export workflow"
          >
            <Zap className={`w-3.5 h-3.5 ${canvasMode === "light" ? "text-amber-500" : ""}`} />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${canvasMode === "light" ? "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm" : "bg-[#1a1a1a] hover:bg-[#222] text-white"} text-sm`}
            aria-label="Import workflow"
          >
            <Folder className={`w-3.5 h-3.5 ${canvasMode === "light" ? "text-blue-500" : ""}`} />
            <span>Import JSON</span>
          </button>

          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={importWorkflow} />

          <button
            type="button"
            className={`flex items-center gap-1 p-2 rounded-lg ${canvasMode === "light" ? "bg-white border border-gray-200 hover:bg-gray-50 shadow-sm" : "bg-[#1a1a1a] hover:bg-[#222]"}`}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-[#888]" />
            <ChevronDown className="w-3 h-3 text-[#888]" />
          </button>
        </div>
      </div>

      {/* Body zones */}
      <div className="h-[calc(100dvh-60px)] md:h-[calc(100vh-60px)] w-full flex relative">
        {isMobile && !mobileSidebarOpen ? (
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className={`fixed left-3 top-18 z-30 flex h-10 w-10 items-center justify-center rounded-lg border ${canvasMode === "light" ? "bg-white border-gray-200 text-gray-700" : "bg-[#111] border-[#222] text-white/90"}`}
            aria-label="Open node editor sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        ) : null}

        {isMobile && mobileSidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/45"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close node editor sidebar"
          />
        ) : null}

        {/* Left sidebar (icon-only when collapsed) */}
        <aside
          className={`fixed top-0 left-0 h-screen flex flex-col ${canvasMode === "light" ? "bg-white border-r border-gray-200 shadow-sm" : "bg-[#0a0a0a]"} z-20 transition-all duration-300 ${
            isMobile
              ? `w-72 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : sidebarCollapsed
                ? "w-12"
                : "w-60"
          } overflow-hidden`}
        >
          <div className="shrink-0 p-3">
            <SidebarToggleButton onClick={() => (isMobile ? setMobileSidebarOpen(false) : setSidebarCollapsed(!sidebarCollapsed))} />
          </div>

          <div className="shrink-0 pt-3 px-2">
            <div className={sidebarCollapsed ? "pt-0" : "pt-0"}>
              <div className="flex flex-col gap-1">
                {[
                  { label: "Home", icon: Home, href: "/dashboard" },
                  { label: "Node Editor", icon: GitFork, href: "/dashboard/workflow" },
                ].map((item) => {
                  const isActive =
                    pathname === item.href || (item.href === "/dashboard/workflow" && pathname.startsWith("/dashboard/workflow"))
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => {
                        if (isMobile) setMobileSidebarOpen(false)
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                        isActive
                          ? canvasMode === "light"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-[#1a1a1a] text-white"
                          : canvasMode === "light"
                            ? "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
                      } ${!isMobile && sidebarCollapsed ? "justify-center" : ""}`}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {(isMobile || !sidebarCollapsed) ? <span className="text-sm font-medium">{item.label}</span> : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 ${canvasMode === "light" ? "light-sidebar-scrollbar" : "dark-sidebar-scrollbar"}`}>
            <div className={sidebarCollapsed ? "px-0" : "px-1"}>

              {/* QUICK ACCESS */}
              <div className={`text-[10px] ${canvasMode === "light" ? "text-gray-400" : "text-[#555]"} tracking-wider uppercase mt-4 mb-2 px-2 font-semibold`}>
                {!sidebarCollapsed ? "Quick access" : ""}
              </div>

              <div className="flex flex-col gap-1">
                {workflowNodeButtons.map((btn) => (
                  <button
                    key={btn.kind}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-workflow-node", btn.kind)
                      e.dataTransfer.effectAllowed = "copy"
                    }}
                    onClick={() => addNodeAtCanvasCenter(btn.kind)}
                    className={`flex items-center gap-3 w-full rounded-lg px-2 py-2 text-left transition-colors ${
                      canvasMode === "light"
                        ? "text-gray-600 hover:bg-gray-100"
                        : "text-[#cfcfcf] hover:bg-[#1a1a1a]"
                    } ${!isMobile && sidebarCollapsed ? "justify-center" : ""} cursor-pointer`}
                  >
                    <span className={btn.color}>{btn.icon}</span>
                    {(isMobile || !sidebarCollapsed) ? <span className={`text-sm ${canvasMode === "light" ? "text-gray-700 font-medium" : "text-[#ccc]"}`}>{btn.name}</span> : null}
                  </button>
                ))}
              </div>

              {/* RUN */}
              <div className={`mt-4 text-[10px] ${canvasMode === "light" ? "text-gray-400" : "text-[#555]"} tracking-wider uppercase px-2 mb-1 font-semibold`}>
                {(isMobile || !sidebarCollapsed) ? "Run" : ""}
              </div>
              <div className="px-0 space-y-1.5">
                <button
                  type="button"
                  onClick={() => runWorkflow("all")}
                  title="Run All"
                  disabled={isExecuting}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    canvasMode === "light"
                      ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      : "text-[#ccc] hover:bg-[#1a1a1a] hover:text-white"
                  } ${!isMobile && sidebarCollapsed ? "justify-center" : ""} cursor-pointer`}
                >
                  {isExecuting ? <Loader2 className="w-4 h-4 animate-spin text-green-500" /> : <Play className="w-4 h-4 shrink-0 text-green-500" />}
                  {(isMobile || !sidebarCollapsed) ? <span className="font-medium">Run All</span> : null}
                </button>

                <button
                  type="button"
                  onClick={() => runWorkflow("selected")}
                  title="Run Selected"
                  disabled={isExecuting}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    canvasMode === "light"
                      ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      : "text-[#ccc] hover:bg-[#1a1a1a] hover:text-white"
                  } ${!isMobile && sidebarCollapsed ? "justify-center" : ""} cursor-pointer`}
                >
                  {isExecuting ? <Loader2 className="w-4 h-4 animate-spin text-yellow-500" /> : <Zap className="w-4 h-4 shrink-0 text-yellow-500" />}
                  {(isMobile || !sidebarCollapsed) ? <span className="font-medium">Run Selected</span> : null}
                </button>
              </div>
            </div>
          </div>

          <div className="relative px-3 pb-4 mt-auto shrink-0" ref={profileMenuRef}>
            {(isMobile || !sidebarCollapsed) && (
              <p className={`text-[11px] ${canvasMode === "light" ? "text-gray-400" : "text-[#555]"} tracking-wider px-3 pt-2 pb-2 font-semibold`}>
                Sessions
              </p>
            )}

            {profileMenuOpen && (
              <div className={`absolute bottom-16 left-2 min-w-52 z-50 overflow-hidden rounded-xl border ${
                canvasMode === "light" ? "bg-white border-gray-200 shadow-xl" : "bg-[#181818] border-white/10 shadow-2xl"
              } flex flex-col items-stretch py-1`}>
                {[
                  { icon: Sparkles, label: "Upgrade plan", color: "text-blue-500" },
                  { icon: Coins, label: "Buy credits", color: "text-amber-500" },
                  { icon: Settings, label: "Settings", color: "text-gray-400" },
                  { icon: LayoutGrid, label: "Usage Statistics", color: "text-gray-400" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    className={`flex w-full items-center gap-2 rounded-none px-4 py-2 text-sm ${
                      canvasMode === "light" ? "text-gray-700 hover:bg-gray-50" : "text-gray-200 hover:bg-[#232323]"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    {item.label}
                  </button>
                ))}
                <div className={`border-t ${canvasMode === "light" ? "border-gray-100" : "border-white/10"} mx-2 my-1`} />
                <button
                  onClick={async () => {
                    setProfileMenuOpen(false)
                    await signOut()
                    router.push("/")
                  }}
                  className={`flex w-full items-center gap-2 rounded-none px-4 py-2 text-sm ${
                    canvasMode === "light" ? "text-red-600 hover:bg-red-50" : "text-gray-100 hover:bg-[#232323]"
                  }`}
                >
                  <LogOut className="h-4 w-4 text-gray-400" />
                  Log out
                </button>
              </div>
            )}

            {/* User profile */}
            <button
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                canvasMode === "light" ? "hover:bg-gray-100" : "hover:bg-[#171717]"
              } ${!isMobile && sidebarCollapsed ? "justify-center" : ""}`}
            >
              <div className={`w-8 h-8 rounded-full ${canvasMode === "light" ? "bg-gray-100" : "bg-gray-700"} flex items-center justify-center ${canvasMode === "light" ? "text-gray-700" : "text-white"} font-semibold text-sm shrink-0 shadow-sm border ${canvasMode === "light" ? "border-gray-200" : "border-transparent"}`}>
                {userInitial}
              </div>
              {(isMobile || !sidebarCollapsed) && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate ${canvasMode === "light" ? "text-gray-900" : "text-white"}`}>{userName}</p>
                    <p className={`text-[11px] ${canvasMode === "light" ? "text-gray-500" : "text-[#888]"}`}>Free</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 ${canvasMode === "light" ? "text-gray-500" : "text-gray-500"} transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
          </div>

        </aside>

        {/* Canvas zone */}
        <div className="flex-1 relative" style={{ marginLeft: sidebarWidth }}>
          <div className="absolute inset-0" ref={flowWrapperRef}>
            <ReactFlow
              nodes={nodes}
              edges={edges.map((e) => ({
                ...e,
                style:
                  toolMode === "cut"
                    ? { ...(e.style ?? {}), stroke: "#ef4444", strokeWidth: 2, cursor: "crosshair" }
                    : { ...(e.style ?? {}), stroke: "#3b82f6", strokeWidth: 2 },
              }))}
              nodeTypes={nodeTypes as any}
              edgeTypes={edgeTypes as any}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              connectionMode={ConnectionMode.Loose}
              connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
              connectionLineType={ConnectionLineType.Bezier}
              isValidConnection={isValidConnection}
              onInit={(instance) => setReactFlowInstance(instance as any)}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onSelectionChange={selectionChangeHandler}
              onPaneClick={() => setSelectedNodeIds([])}
              onEdgeClick={onEdgeClick as any}
              onNodeDragStop={onNodeDragStop}
              nodesDraggable={toolMode !== "pan"}
              panOnDrag={toolMode === "pan" ? true : [1]}
              elementsSelectable={toolMode === "select"}
              selectionOnDrag={false}
              zoomOnScroll
              fitView
              panOnScroll={true}
              panActivationKeyCode={null}
              selectionKeyCode="Shift"
              multiSelectionKeyCode="Shift"
              deleteKeyCode={["Delete", "Backspace"] as any}
              proOptions={{ hideAttribution: true }}
              style={{ cursor: toolMode === "cut" ? "crosshair" : toolMode === "pan" ? "grab" : "default" }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1.5}
                color={canvasMode === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)"}
              />

              {/* Mini map */}
              {showMiniMap ? (
                <MiniMap
                  position="bottom-right"
                  style={{
                    width: 128,
                    height: 80,
                    backgroundColor: canvasMode === "dark" ? "#1a1a1a" : "#f8fafc",
                    border: `1px solid ${canvasMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.45)"}`,
                    borderRadius: "8px",
                    bottom: "80px",
                    right: "16px",
                  }}
                  nodeColor={canvasMode === "dark" ? "#333" : "#cbd5e1"}
                  maskColor={canvasMode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(226,232,240,0.65)"}
                />
              ) : null}
            </ReactFlow>
          </div>

          {/* Empty state overlay */}
          {showEmptyOverlay ? (
            <div ref={emptyOverlayRef} className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <div className="flex items-center gap-2 mb-8 pointer-events-auto">
                <button
                  type="button"
                  className={`${canvasMode === "light" ? "bg-white text-gray-800 border border-gray-200" : "bg-[#1a1a1a] text-white border border-[#333]"} text-sm px-3 py-1 rounded-full`}
                  onClick={() => setNodeSearchOpen(true)}
                >
                  Add a node
                </button>
                <span className={`${canvasMode === "light" ? "text-gray-500" : "text-[#555]"} text-sm`}>or drag from sidebar</span>
              </div>

              <div className="flex items-start gap-4 pointer-events-auto max-w-full overflow-x-auto px-4">
                <button
                  type="button"
                  onClick={() => setEmptyOverlayDismissed(true)}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className={`${canvasMode === "light" ? "bg-white border-gray-200 hover:border-gray-300" : "bg-[#1a1a1a] border-[#333] hover:border-[#555]"} w-40 sm:w-48 h-32 rounded-2xl border flex items-center justify-center`}>
                    <div className={`${canvasMode === "light" ? "bg-gray-900" : "bg-white"} w-10 h-10 rounded-full flex items-center justify-center`}>
                      <Plus className={`${canvasMode === "light" ? "text-white" : "text-black"} w-5 h-5`} />
                    </div>
                  </div>
                  <span className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Empty Workflow</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadSampleWorkflow()}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className={`${canvasMode === "light" ? "bg-white border-gray-200 hover:border-gray-300" : "bg-[#1a1a1a] border-[#333] hover:border-[#555]"} w-40 sm:w-48 h-32 rounded-2xl border flex items-center justify-center overflow-hidden relative`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <GitFork className={`${canvasMode === "light" ? "text-gray-400" : "text-[#555]"} w-8 h-8`} />
                    </div>
                  </div>
                  <span className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Product Marketing Kit Generator</span>
                  <span className={`${canvasMode === "light" ? "text-gray-500" : "text-[#888]"} text-xs`}>9 nodes: image + video + copy pipeline</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadQuickMathPreset()}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className={`${canvasMode === "light" ? "bg-white border-gray-200 hover:border-gray-300" : "bg-[#1a1a1a] border-[#333] hover:border-[#555]"} w-40 sm:w-48 h-32 rounded-2xl border flex items-center justify-center overflow-hidden relative`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className={`${canvasMode === "light" ? "text-gray-400" : "text-[#555]"} w-8 h-8`} />
                    </div>
                  </div>
                  <span className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Quick Math Prompt</span>
                  <span className={`${canvasMode === "light" ? "text-gray-500" : "text-[#888]"} text-xs`}>2 nodes: text to LLM</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadSimpleCaptionPreset()}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className={`${canvasMode === "light" ? "bg-white border-gray-200 hover:border-gray-300" : "bg-[#1a1a1a] border-[#333] hover:border-[#555]"} w-40 sm:w-48 h-32 rounded-2xl border flex items-center justify-center overflow-hidden relative`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText className={`${canvasMode === "light" ? "text-gray-400" : "text-[#555]"} w-8 h-8`} />
                    </div>
                  </div>
                  <span className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Quick Caption Flow</span>
                  <span className={`${canvasMode === "light" ? "text-gray-500" : "text-[#888]"} text-xs`}>3 nodes: image + prompt to LLM</span>
                </button>
              </div>

              <button
                type="button"
                className={`${canvasMode === "light" ? "bg-white text-gray-500 hover:text-gray-800 border-gray-200" : "bg-[#1a1a1a] text-[#888] hover:text-white border-[#333]"} mt-6 flex items-center gap-2 px-4 py-2 rounded-full text-sm border pointer-events-auto`}
                onClick={() => setEmptyOverlayDismissed(true)}
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </div>
          ) : null}

          {/* Bottom toolbar */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-15 z-20">
            <div className={`${canvasMode === "light" ? "bg-white" : "bg-[#1a1a1a]"} rounded-full px-3 py-2 flex items-center gap-2 shadow-lg`}>
              <button
                type="button"
                onClick={() => setNodeSearchOpen(true)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  canvasMode === "light" ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-transparent text-white/90 hover:bg-white/10"
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setToolMode("select")}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  toolMode === "select"
                    ? canvasMode === "light" ? "bg-neutral-800 text-white" : "bg-white/90 text-black"
                    : canvasMode === "light" ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-transparent text-white/90 hover:bg-white/10"
                } cursor-pointer`}
              >
                <MousePointer2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setToolMode("pan")}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  toolMode === "pan"
                    ? canvasMode === "light" ? "bg-neutral-800 text-white" : "bg-white/90 text-black"
                    : canvasMode === "light" ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-transparent text-white/90 hover:bg-white/10"
                } cursor-pointer`}
              >
                <Hand className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setToolMode("cut")}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  toolMode === "cut"
                    ? canvasMode === "light" ? "bg-neutral-800 text-white" : "bg-white/90 text-black"
                    : canvasMode === "light" ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-transparent text-white/90 hover:bg-white/10"
                } cursor-pointer`}
              >
                <Scissors className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setPresetModalOpen(true)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  canvasMode === "light" ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-transparent text-white/90 hover:bg-white/10"
                } cursor-pointer`}
                aria-label="Open presets"
              >
                <Link2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Compact view controls */}
          <div className="absolute right-4 top-20 z-20">
            <div className={`${canvasMode === "light" ? "bg-white border border-gray-200" : "bg-[#111] border border-[#222]"} rounded-xl p-1.5 flex flex-col gap-1 shadow-sm`}>
              <button
                type="button"
                onClick={() => reactFlowInstance?.zoomIn({ duration: 180 })}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  canvasMode === "light" ? "text-gray-700 hover:bg-gray-100" : "text-white/90 hover:bg-white/10"
                } cursor-pointer`}
                aria-label="Zoom in small"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => reactFlowInstance?.zoomOut({ duration: 180 })}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  canvasMode === "light" ? "text-gray-700 hover:bg-gray-100" : "text-white/90 hover:bg-white/10"
                } cursor-pointer`}
                aria-label="Zoom out small"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => reactFlowInstance?.fitView({ duration: 220, padding: 0.2 })}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  canvasMode === "light" ? "text-gray-700 hover:bg-gray-100" : "text-white/90 hover:bg-white/10"
                } cursor-pointer`}
                aria-label="Fit view small"
                title="Fit view"
              >
                <Scan className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Undo/redo and shortcuts */}
          {/* Undo/redo and shortcuts */}
          <div className={`absolute left-6 bottom-13 text-[12px] z-20 flex items-center gap-4 ${canvasMode === "light" ? "text-gray-500" : "text-[#888]"}`}>
            <button type="button" className={`cursor-pointer ${canvasMode === "light" ? "hover:text-gray-900" : "hover:text-white"}`} onClick={undo}>
              ← Undo
            </button>
            <button type="button" className={`cursor-pointer ${canvasMode === "light" ? "hover:text-gray-900" : "hover:text-white"}`} onClick={redo}>
              → Redo
            </button>
            <button type="button" className={`flex items-center gap-1.5 text-xs cursor-pointer ${canvasMode === "light" ? "hover:text-gray-900" : "hover:text-white"}`}>
              <Command className="w-3 h-3" />
              <span>Keyboard shortcuts</span>
            </button>
          </div>

          {/* History panel toggle */}
          {!historyPanelOpen ? (
            <button
              type="button"
              className={`absolute right-3 top-[50%] -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center z-30 transition-colors cursor-pointer ${canvasMode === "light" ? "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm" : "bg-[#111] border border-[#222] text-white/90 hover:bg-[#151515]"}`}
              onClick={() => setHistoryPanelOpen(true)}
              aria-label="Open history"
            >
              <Clock className="w-4 h-4" />
            </button>
          ) : null}

          {/* History panel */}
          <div
            className={`fixed top-0 right-0 h-screen z-40 transition-transform duration-200 ${
              isMobile ? "w-full max-w-full" : "w-75 max-w-[85vw]"
            } ${
              historyPanelOpen ? "translate-x-0" : "translate-x-full"
            } ${
              canvasMode === "light" ? "bg-white border-l border-gray-200 shadow-lg" : "bg-[#111] border-l border-[#222]"
            }`}
            onWheelCapture={(event) => event.stopPropagation()}
            onTouchMoveCapture={(event) => event.stopPropagation()}
          >
            <div className={`p-4 flex items-center gap-3 ${canvasMode === "light" ? "border-b border-gray-200" : "border-b border-[#222]"}`}>
              <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} font-medium`}>Workflow History</div>
              <button
                type="button"
                className={`ml-auto w-8 h-8 rounded-lg flex items-center justify-center ${
                  canvasMode === "light" ? "hover:bg-gray-100 text-gray-600" : "hover:bg-[#1a1a1a] text-white/90"
                } cursor-pointer`}
                onClick={() => setHistoryPanelOpen(false)}
                aria-label="Close history"
              >
                ×
              </button>
            </div>

            <div
              className={`p-3 overflow-y-auto overscroll-contain h-[calc(100%-56px)] ${canvasMode === "light" ? "light-sidebar-scrollbar" : "dark-sidebar-scrollbar"}`}
              style={{ scrollbarGutter: "stable" }}
            >
              {history.length === 0 ? (
                <div className={`text-sm mt-10 text-center ${canvasMode === "light" ? "text-gray-500" : "text-[#777]"}`}>
                  <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} font-medium mb-2`}>No runs yet.</div>
                  Run your workflow to see history here.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.map((entry) => (
                    <details
                      key={entry.id}
                      className={`${canvasMode === "light" ? "bg-gray-50 border border-gray-200" : "bg-[#0f0f10] border border-[#222]"} rounded-2xl overflow-hidden`}
                    >
                      <summary className="cursor-pointer list-none p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white/90"} text-sm`}>
                              Run #{entry.id.slice(-6)} - {new Date(entry.timestamp).toLocaleString()}
                            </div>
                            <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#777]"} text-xs mt-1`}>
                              ({entry.scope}) • {(entry.durationMs / 1000).toFixed(1)}s
                            </div>
                          </div>
                          <span
                            className={`text-[11px] px-2 py-1 rounded-full ${
                              entry.status === "success"
                                ? "bg-green-500/20 text-green-600"
                                : entry.status === "partial"
                                  ? "bg-amber-500/20 text-amber-600"
                                  : entry.status === "running"
                                    ? "bg-blue-500/20 text-blue-600"
                                    : "bg-red-500/20 text-red-600"
                            }`}
                          >
                            {entry.status === "success"
                              ? "Success"
                              : entry.status === "partial"
                                ? "Partial"
                                : entry.status === "running"
                                  ? "Running"
                                  : "Failed"}
                          </span>
                        </div>
                      </summary>
                      <div className="p-3 pt-0">
                        <div className="flex flex-col gap-2">
                          {entry.nodeDetails.map((nd) => (
                            <div
                              key={nd.nodeId}
                              className={`${canvasMode === "light" ? "bg-gray-100 border border-gray-200" : "bg-[#111] border border-[#222]"} rounded-xl p-2`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    nd.status === "success"
                                      ? "bg-green-500"
                                      : nd.status === "failed"
                                        ? "bg-red-500"
                                        : "bg-yellow-500"
                                  }`}
                                />
                                <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white/90"} text-sm truncate`}>{nd.nodeName}</div>
                              </div>
                              <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#777]"} text-xs mt-1`}>
                                {(nd.durationMs / 1000).toFixed(1)}s
                              </div>
                              {nd.status === "failed" ? (
                                <div className="text-red-500 text-xs mt-2">Unable to fetch output</div>
                              ) : nd.outputPreview ? (
                                <div className="mt-2">
                                  <MarkdownOutput content={nd.outputPreview} canvasMode={canvasMode} />
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Node search modal */}
          {nodeSearchOpen ? (
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center"
              onClick={() => {
                setNodeSearchOpen(false)
                setNodeSearchQuery("")
              }}
            >
              <div
                className={
                  canvasMode === "light"
                    ? "w-[calc(100vw-2rem)] max-w-[320px] bg-white rounded-2xl overflow-hidden border border-[#ddd]"
                    : "w-[calc(100vw-2rem)] max-w-[320px] bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[#222]"
                }
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={nodeSearchQuery}
                      onChange={(e) => setNodeSearchQuery(e.target.value)}
                      placeholder="Search nodes..."
                      className={
                        canvasMode === "light"
                          ? "w-full bg-transparent border border-[#ddd] rounded-xl px-3 py-2 text-sm outline-none text-black placeholder:text-[#888]"
                          : "w-full bg-transparent border border-[#222] rounded-xl px-3 py-2 text-sm outline-none text-white placeholder:text-[#666]"
                      }
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999]">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <div className="text-[11px] uppercase text-[#999] tracking-wider mb-2">Quick access</div>
                  <div className="flex flex-col gap-2">
                    {workflowNodeButtons
                      .filter((b) => b.name.toLowerCase().includes(nodeSearchQuery.trim().toLowerCase()))
                      .map((b) => (
                        <button
                          key={b.kind}
                          type="button"
                          onClick={() => {
                            addNodeAtCanvasCenter(b.kind)
                            setNodeSearchOpen(false)
                            setNodeSearchQuery("")
                          }}
                          className={
                            canvasMode === "light"
                              ? "flex items-center gap-3 w-full bg-transparent hover:bg-[#f4f4f5] border border-[#eee] rounded-xl px-3 py-2 cursor-pointer"
                              : "flex items-center gap-3 w-full bg-transparent hover:bg-[#111] border border-[#222] rounded-xl px-3 py-2 cursor-pointer"
                          }
                        >
                          <span className={b.color}>{b.icon}</span>
                          <span className={canvasMode === "light" ? "text-sm text-black" : "text-sm text-white/90"}>{b.name}</span>
                          <span className="ml-auto text-[#999]">›</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Presets modal */}
          {presetModalOpen ? (
            <div
              className={`${canvasMode === "light" ? "bg-black/35" : "bg-black/60"} absolute inset-0 z-50 flex items-center justify-center`}
              onClick={() => setPresetModalOpen(false)}
            >
              <div
                className={`${canvasMode === "light" ? "bg-white border border-gray-200" : "bg-[#111] border border-[#222]"} w-[92vw] max-w-175 rounded-2xl p-4 sm:p-6`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start">
                  <div>
                    <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} font-semibold text-lg`}>Presets</div>
                    <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#777]"} text-sm mt-1`}>
                      Start with a template to get up and running quickly.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${canvasMode === "light" ? "hover:bg-gray-100 text-gray-700" : "hover:bg-[#1a1a1a] text-white/90"} ml-auto w-9 h-9 rounded-lg`}
                    onClick={() => setPresetModalOpen(false)}
                    aria-label="Close presets"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={`${canvasMode === "light" ? "bg-gray-50 border border-gray-200 hover:bg-gray-100" : "bg-[#0f0f10] border border-[#222] hover:bg-[#161616]"} rounded-2xl h-55 transition-colors cursor-pointer`}
                    onClick={() => {
                      markCanvasDirty()
                      commitSnapshot()
                      replaceCanvas([], [])
                      setPresetModalOpen(false)
                      setEmptyOverlayDismissed(false)
                    }}
                  >
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                      <div className={`${canvasMode === "light" ? "border-gray-300" : "border-white/20"} w-16 h-16 rounded-full border flex items-center justify-center`}>
                        <Plus className={`${canvasMode === "light" ? "text-gray-700" : "text-white"} w-6 h-6`} />
                      </div>
                      <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Empty Workflow</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`${canvasMode === "light" ? "bg-gray-50 border border-gray-200 hover:bg-gray-100" : "bg-[#0f0f10] border border-[#222] hover:bg-[#161616]"} rounded-2xl h-55 transition-colors cursor-pointer`}
                    onClick={() => {
                      loadSampleWorkflow()
                      setPresetModalOpen(false)
                    }}
                  >
                    <div className="p-5 h-full flex flex-col">
                      <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Product Marketing Kit Generator</div>
                      <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#777]"} text-[12px] mt-1`}>
                        9-node preset for product description + tweet from image and video inputs.
                      </div>
                      <div className={`${canvasMode === "light" ? "border-gray-200 bg-white text-gray-500" : "border-[#222] bg-[#111] text-[#555]"} flex-1 mt-4 rounded-xl border flex items-center justify-center text-sm`}>
                        9 Nodes
                      </div>
                      <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#999]"} text-[11px] mt-3`}>Click to load</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`${canvasMode === "light" ? "bg-gray-50 border border-gray-200 hover:bg-gray-100" : "bg-[#0f0f10] border border-[#222] hover:bg-[#161616]"} rounded-2xl h-55 transition-colors cursor-pointer`}
                    onClick={() => {
                      loadSimpleCaptionPreset()
                      setPresetModalOpen(false)
                    }}
                  >
                    <div className="p-5 h-full flex flex-col">
                      <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Quick Caption Flow</div>
                      <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#777]"} text-[12px] mt-1`}>
                        Minimal starter workflow for image captioning.
                      </div>
                      <div className={`${canvasMode === "light" ? "border-gray-200 bg-white text-gray-500" : "border-[#222] bg-[#111] text-[#555]"} flex-1 mt-4 rounded-xl border flex items-center justify-center text-sm`}>
                        3 Nodes
                      </div>
                      <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#999]"} text-[11px] mt-3`}>Click to load</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`${canvasMode === "light" ? "bg-gray-50 border border-gray-200 hover:bg-gray-100" : "bg-[#0f0f10] border border-[#222] hover:bg-[#161616]"} rounded-2xl h-55 transition-colors cursor-pointer`}
                    onClick={() => {
                      loadQuickMathPreset()
                      setPresetModalOpen(false)
                    }}
                  >
                    <div className="p-5 h-full flex flex-col">
                      <div className={`${canvasMode === "light" ? "text-gray-900" : "text-white"} text-sm font-medium`}>Quick Math Prompt</div>
                      <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#777]"} text-[12px] mt-1`}>
                        Text node "whats 1+2" wired to one LLM node.
                      </div>
                      <div className={`${canvasMode === "light" ? "border-gray-200 bg-white text-gray-500" : "border-[#222] bg-[#111] text-[#555]"} flex-1 mt-4 rounded-xl border flex items-center justify-center text-sm`}>
                        2 Nodes
                      </div>
                      <div className={`${canvasMode === "light" ? "text-gray-500" : "text-[#999]"} text-[11px] mt-3`}>Click to load</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

