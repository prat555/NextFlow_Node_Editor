"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import Uppy from "@uppy/core"
import Transloadit from "@uppy/transloadit"
import { useWorkflowStore } from "./workflow-store"
import type { WorkflowNodeData } from "./types"
import { isConnectedToHandle } from "./graph-utils"
import { MarkdownOutput } from "./markdown-output"

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage
    const maybeDetails = (error as { details?: unknown }).details
    if (typeof maybeDetails === "string" && maybeDetails) return maybeDetails
  }
  return "Upload failed"
}

async function uploadWithTransloadit(file: File) {
  const signResponse = await fetch("/api/transloadit/sign", {
    method: "POST",
  })

  if (!signResponse.ok) {
    let message = "Failed to get Transloadit signature"
    try {
      const payload = (await signResponse.json()) as { error?: string; hint?: string }
      if (payload.error) {
        message = payload.hint ? `${payload.error}. ${payload.hint}` : payload.error
      }
    } catch {
      // Fallback to generic message when response is not JSON.
    }
    throw new Error(message)
  }

  const { params, signature } = await signResponse.json()

  const uppy = new Uppy({
    autoProceed: true,
    restrictions: {
      maxNumberOfFiles: 1,
    },
  })

  uppy.use(Transloadit, {
    waitForEncoding: true,
    assemblyOptions: {
      params,
      signature,
    },
  })

  const resultUrl = await new Promise<string>((resolve, reject) => {
    uppy.on("error", (error) => reject(new Error(extractErrorMessage(error))))
    uppy.on("upload-error", (_file, error) => reject(new Error(extractErrorMessage(error))))
    uppy.on("transloadit:error", (assembly: { error?: string }) => {
      const message = assembly?.error || "Transloadit upload failed"
      reject(new Error(message))
    })
    uppy.on("transloadit:complete", (assembly: any) => {
      // Try the exported CDN step first, then fall back to :original
      const files =
        assembly?.results?.exported ??
        assembly?.results?.[":original"] ??
        assembly?.results?.upload ??
        []

      const first = files[0]

      const url =
        first?.ssl_url ??
        first?.url ??
        first?.uploadURL

      if (!url) {
        reject(new Error("Transloadit did not return a file URL"))
        return
      }

      resolve(String(url))
    })

    uppy.addFile({
      name: file.name,
      type: file.type,
      data: file,
    })
  })

  await uppy.cancelAll()
  uppy.destroy()
  return resultUrl
}

function getUrlHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function NodeContainer({
  children,
  nodeId,
  selected,
  execution,
  label,
}: {
  children: React.ReactNode
  nodeId: string
  selected: boolean
  execution: WorkflowNodeData["execution"]
  label: string
}) {
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const statusLabel =
    execution === "running" ? "Running" : execution === "failed" ? "Failed" : execution === "executed" ? "Done" : "Idle"
  const statusTone =
    execution === "running"
      ? "bg-blue-500/15 text-blue-400"
      : execution === "failed"
        ? "bg-red-500/15 text-red-400"
        : execution === "executed"
          ? "bg-green-500/15 text-green-400"
          : "bg-gray-500/15 text-gray-400"
  const nodeShellClass =
    canvasMode === "light"
      ? "bg-white border border-gray-200 shadow-sm"
      : "bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)]"

  return (
    <div
      className={[
        "relative min-w-52 max-w-60 sm:min-w-64 sm:max-w-70 rounded-2xl transition-all duration-200",
        nodeShellClass,
        selected ? "ring-2 ring-blue-500" : "",
        execution === "running" ? "node-executing" : "",
      ].join(" ")}
    >
      <div className="absolute top-2.5 left-3 z-10">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>{statusLabel}</span>
      </div>
      <div className="absolute top-2.5 right-3 z-10">
        <span className="text-[#888] text-xs">{label}</span>
      </div>
      <div className="pt-9 px-3 pb-3 space-y-2">{children}</div>

      <div className="px-3 pb-3">
        <button type="button" className="flex items-center gap-1.5 text-[#555] hover:text-[#888] text-xs">
          <span>•</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}

function AutoResizeTextarea({
  value,
  placeholder,
  onChange,
  disabled,
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value)
        requestAnimationFrame(resize)
      }}
      onInput={() => resize()}
      className={
        canvasMode === "light"
          ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black placeholder:text-[#888] resize-none outline-none disabled:opacity-50"
          : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white placeholder:text-[#555] resize-none outline-none disabled:opacity-50"
      }
      style={{ minHeight: 88 }}
    />
  )
}

function UploadArea({
  accept,
  kind,
  preview,
  onFile,
  onClear,
  disabled,
}: {
  accept: string
  kind: "image" | "video"
  preview?: string
  onFile: (url: string) => void
  onClear?: () => void
  disabled?: boolean
}) {
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const processFile = async (file: File) => {
    if (disabled || uploading) return
    setUploadError(null)
    setUploading(true)
    try {
      const url = await uploadWithTransloadit(file)
      const host = getUrlHost(url)
      console.info("[media-upload] Uploaded via Transloadit", {
        kind,
        fileName: file.name,
        host,
        url,
      })
      onFile(url)
    } catch (error) {
      const message = extractErrorMessage(error)
      setUploadError(message)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    void processFile(file)
  }

  return (
    <div
      className={
        canvasMode === "light"
          ? "relative w-full h-[100px] rounded-xl bg-white border-2 border-dashed border-gray-300 overflow-hidden"
          : "relative w-full h-[100px] rounded-xl bg-[#0d0d0d] border-2 border-dashed border-[#333] overflow-hidden"
      }
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = disabled ? "none" : "copy"
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (disabled) return
          const file = e.target.files?.[0]
          if (!file) return
          void processFile(file)
        }}
      />

      {preview ? (
        <>
          {kind === "video" ? (
            <video src={preview} className="w-full h-full object-cover" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="upload preview" className="w-full h-full object-cover" />
          )}

          {onClear ? (
            <button
              type="button"
              disabled={disabled || uploading}
              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center rounded-md bg-black/60 text-white p-1 hover:bg-black/75 disabled:opacity-50"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setUploadError(null)
                onClear()
              }}
              title="Clear selected file"
              aria-label="Clear selected file"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors disabled:cursor-not-allowed hover:border-[#555]"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-5 h-5 text-[#555] mb-1" />
          <span className="text-[#888] text-xs">{uploading ? "Uploading..." : "Drag & drop or click"}</span>
          <span className="text-[#555] text-xs">Accepts supported formats</span>
        </button>
      )}

      {uploadError ? (
        <div className="absolute bottom-1 left-2 right-2 text-[10px] text-red-400 truncate" title={uploadError}>
          {uploadError}
        </div>
      ) : null}
    </div>
  )
}

export function TextNode(props: NodeProps) {
  const { id, selected } = props
  const data = (props.data ?? {}) as WorkflowNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const textValue = data.kind === "text" ? data.text : ""
  return (
    <NodeContainer nodeId={id} selected={selected} execution={data.execution} label="Text">
      <div className="flex flex-col gap-2">
        <AutoResizeTextarea
          value={textValue}
          placeholder="Enter your text..."
          onChange={(v) => updateNodeData(id, { text: v } as any)}
        />
      </div>

      <Handle id="input" type="target" position={Position.Left} style={{ background: "#9ca3af", width: 10, height: 10, border: "2px solid #0a0a0a" }} />
      {/* Output handle */}
      <Handle id="output" type="source" position={Position.Right} className="w-3 h-3 !bg-[#9ca3af] !border-0" />
    </NodeContainer>
  )
}

export function UploadImageNode(props: NodeProps) {
  const { id, selected } = props
  const data = (props.data ?? {}) as WorkflowNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  return (
    <NodeContainer nodeId={id} selected={selected} execution={data.execution} label="Image">
      <UploadArea
        accept=".jpg,.jpeg,.png,.webp,.gif"
        kind="image"
        preview={data.kind === "uploadImage" ? data.imageUrl : undefined}
        onFile={(url) => updateNodeData(id, { imageUrl: url } as any)}
        onClear={() => updateNodeData(id, { imageUrl: undefined } as any)}
      />

      <Handle id="output" type="source" position={Position.Right} className="w-3 h-3 !bg-[#3b82f6] !border-0" />
    </NodeContainer>
  )
}

export function UploadVideoNode(props: NodeProps) {
  const { id, selected } = props
  const data = (props.data ?? {}) as WorkflowNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  return (
    <NodeContainer nodeId={id} selected={selected} execution={data.execution} label="Video">
      <UploadArea
        accept=".mp4,.mov,.webm,.m4v"
        kind="video"
        preview={data.kind === "uploadVideo" ? data.videoUrl : undefined}
        onFile={(url) => updateNodeData(id, { videoUrl: url } as any)}
        onClear={() => updateNodeData(id, { videoUrl: undefined } as any)}
      />

      <Handle id="output" type="source" position={Position.Right} className="w-3 h-3 !bg-[#f97316] !border-0" />
    </NodeContainer>
  )
}

function InputField({
  connected,
  label,
  children,
}: {
  connected: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {connected ? (
        <div className="text-[11px] text-[#666]">
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#444]" />
            Receiving input
          </span>
        </div>
      ) : (
        <div className="text-[11px] text-[#666]">{label}</div>
      )}
      <div className={connected ? "opacity-50" : ""}>{children}</div>
    </div>
  )
}

export function LlmNode(props: NodeProps) {
  const { id, selected } = props
  const data = (props.data ?? {}) as WorkflowNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const storeEdges = useWorkflowStore((s) => s.edges)
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const invalidFlash = useWorkflowStore((s) => s.invalidFlash)

  const connectedSystem = isConnectedToHandle(storeEdges, id, "system_prompt")
  const connectedUser = isConnectedToHandle(storeEdges, id, "user_message")
  const connectedImages = isConnectedToHandle(storeEdges, id, "images")

  const exec = data.execution
  const llmData = data.kind === "llm" ? data : null
  const selectedModel = (llmData?.modelId ?? "gemini-2.5-flash-lite").replace(/^models\//, "")
  const systemPrompt = llmData?.systemPrompt ?? ""
  const userMessage = llmData?.userMessage ?? ""

  return (
    <NodeContainer nodeId={id} selected={selected} execution={exec} label="LLM">
      <div className="relative">
        {/* Left input handles */}
        {(() => {
          const invalidSystem = invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "system_prompt"
          const invalidUser = invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "user_message"
          const invalidImages = invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "images"

          return (
            <>
        <Handle
          id="system_prompt"
          type="target"
          position={Position.Left}
              style={{ top: "35%", background: invalidSystem ? "#ef4444" : "#eab308", width: 10, height: 10, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="user_message"
          type="target"
          position={Position.Left}
              style={{ top: "55%", background: invalidUser ? "#ef4444" : "#3b82f6", width: 10, height: 10, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="images"
          type="target"
          position={Position.Left}
              style={{ top: "75%", background: invalidImages ? "#ef4444" : "#a855f7", width: 10, height: 10, border: "2px solid #0a0a0a" }}
        />
            </>
          )
        })()}

        <div className="space-y-1">
          <div className="text-[#888] text-xs pl-2">system_prompt</div>
          <div className="text-[#888] text-xs pl-2">user_message</div>
          <div className="text-[#888] text-xs pl-2">images</div>
        </div>

        <div className="flex flex-col gap-2">
          <InputField connected={connectedSystem} label="System prompt">
            <input
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black placeholder:text-[#888] outline-none disabled:opacity-50"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white placeholder:text-[#555] outline-none disabled:opacity-50"
              }
              value={systemPrompt}
              disabled={connectedSystem}
              onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value } as any)}
              placeholder="System prompt"
            />
          </InputField>

          <InputField connected={connectedUser} label="User message">
            <textarea
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black placeholder:text-[#888] outline-none disabled:opacity-50 resize-none"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white placeholder:text-[#555] outline-none disabled:opacity-50 resize-none"
              }
              value={userMessage}
              disabled={connectedUser}
              onChange={(e) => updateNodeData(id, { userMessage: e.target.value } as any)}
              placeholder="Enter your message..."
              rows={4}
            />
          </InputField>

          <InputField connected={connectedImages} label="Images (URLs)">
            <input
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black placeholder:text-[#888] outline-none disabled:opacity-50"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white placeholder:text-[#555] outline-none disabled:opacity-50"
              }
              value={(llmData?.imageUrls ?? []).join(", ")}
              disabled={connectedImages}
              onChange={(e) => updateNodeData(id, { imageUrls: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } as any)}
              placeholder="image1.png, image2.png"
            />
          </InputField>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <div className="text-[11px] text-[#666]">Model</div>
            <select
              className={
                canvasMode === "light"
                  ? "w-full min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-black outline-none overflow-hidden text-ellipsis whitespace-nowrap"
                  : "w-full min-w-0 max-w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl px-3 py-2 text-sm text-white outline-none overflow-hidden text-ellipsis whitespace-nowrap"
              }
              value={selectedModel}
              onChange={(e) => updateNodeData(id, { modelId: e.target.value as any } as any)}
              disabled={connectedUser && connectedImages}
              title={selectedModel}
            >
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-2.0-flash-001">gemini-2.0-flash-001</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
              <option value="gemini-2.0-flash-lite-001">gemini-2.0-flash-lite-001</option>
            </select>
          </div>

          {data.outputText ? (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[#888] text-xs">Result</span>
              </div>
              <MarkdownOutput content={data.outputText} canvasMode={canvasMode} />
            </div>
          ) : null}

          {data.errorMessage ? (
            <div className="mt-2 p-3 bg-red-950/30 rounded-xl border border-red-900/50">
              <div className="flex items-center gap-1.5 mb-1">
                <X className="w-3 h-3 text-red-400" />
                <span className="text-red-400 text-xs">Error</span>
              </div>
              <p className="text-red-300 text-xs">{data.errorMessage}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Output handle */}
      <Handle id="output" type="source" position={Position.Right} style={{ background: "#22c55e", width: 10, height: 10, border: "2px solid #0a0a0a" }} />
    </NodeContainer>
  )
}

export function CropImageNode(props: NodeProps) {
  const { id, selected } = props
  const data = (props.data ?? {}) as WorkflowNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const storeEdges = useWorkflowStore((s) => s.edges)
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const invalidFlash = useWorkflowStore((s) => s.invalidFlash)

  const connectedImageUrl = isConnectedToHandle(storeEdges, id, "image_url")
  const connectedX = isConnectedToHandle(storeEdges, id, "x_percent")
  const connectedY = isConnectedToHandle(storeEdges, id, "y_percent")
  const connectedW = isConnectedToHandle(storeEdges, id, "width_percent")
  const connectedH = isConnectedToHandle(storeEdges, id, "height_percent")

  return (
    <NodeContainer nodeId={id} selected={selected} execution={data.execution} label="Crop Image">
      <div className="flex flex-col gap-2 relative">
        <Handle
          id="image_url"
          type="target"
          position={Position.Left}
          style={{ top: "25%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "image_url" ? "#ef4444" : "#3b82f6", width: 10, height: 10, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="x_percent"
          type="target"
          position={Position.Left}
          style={{ top: "42%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "x_percent" ? "#ef4444" : "#888", width: 8, height: 8, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="y_percent"
          type="target"
          position={Position.Left}
          style={{ top: "55%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "y_percent" ? "#ef4444" : "#888", width: 8, height: 8, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="width_percent"
          type="target"
          position={Position.Left}
          style={{ top: "68%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "width_percent" ? "#ef4444" : "#888", width: 8, height: 8, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="height_percent"
          type="target"
          position={Position.Left}
          style={{ top: "81%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "height_percent" ? "#ef4444" : "#888", width: 8, height: 8, border: "2px solid #0a0a0a" }}
        />

        <div className="space-y-1">
          <div className="text-[#888] text-xs pl-2">image_url</div>
          <div className="text-[#888] text-xs pl-2">x_percent</div>
          <div className="text-[#888] text-xs pl-2">y_percent</div>
          <div className="text-[#888] text-xs pl-2">width_percent</div>
          <div className="text-[#888] text-xs pl-2">height_percent</div>
        </div>

        <InputField connected={connectedImageUrl} label="image_url">
          <UploadArea
            accept="image/*"
            kind="image"
            preview={data.kind === "cropImage" ? data.imageUrl : undefined}
            onFile={(url) => updateNodeData(id, { imageUrl: url } as any)}
            onClear={() => updateNodeData(id, { imageUrl: undefined } as any)}
            disabled={connectedImageUrl}
          />
        </InputField>

        <div className="grid grid-cols-2 gap-2">
          <InputField connected={connectedX} label="x_percent">
            <input
              type="number"
              disabled={connectedX}
              value={data.kind === "cropImage" ? data.x_percent : 0}
              onChange={(e) => updateNodeData(id, { x_percent: Number(e.target.value) } as any)}
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              }
            />
          </InputField>
          <InputField connected={connectedY} label="y_percent">
            <input
              type="number"
              disabled={connectedY}
              value={data.kind === "cropImage" ? data.y_percent : 0}
              onChange={(e) => updateNodeData(id, { y_percent: Number(e.target.value) } as any)}
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              }
            />
          </InputField>
          <InputField connected={connectedW} label="width_percent">
            <input
              type="number"
              disabled={connectedW}
              value={data.kind === "cropImage" ? data.width_percent : 100}
              onChange={(e) => updateNodeData(id, { width_percent: Number(e.target.value) } as any)}
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              }
            />
          </InputField>
          <InputField connected={connectedH} label="height_percent">
            <input
              type="number"
              disabled={connectedH}
              value={data.kind === "cropImage" ? data.height_percent : 100}
              onChange={(e) => updateNodeData(id, { height_percent: Number(e.target.value) } as any)}
              className={
                canvasMode === "light"
                  ? "w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-black outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  : "w-full bg-[#0f0f10] border border-[#2a2a2c] rounded-xl p-3 text-sm text-white outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              }
            />
          </InputField>
        </div>

        {data.kind === "cropImage" && data.croppedUrl ? (
          <div className="mt-2">
            <p className="text-[#888] text-xs mb-1">Cropped Result</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.croppedUrl} alt="cropped" className="w-full rounded-lg max-h-[120px] object-cover" />
          </div>
        ) : null}

        {data.errorMessage ? (
          <div className="mt-2 p-3 bg-red-950/30 rounded-xl border border-red-900/50">
            <div className="flex items-center gap-1.5 mb-1">
              <X className="w-3 h-3 text-red-400" />
              <span className="text-red-400 text-xs">Error</span>
            </div>
            <p className="text-red-300 text-xs">{data.errorMessage}</p>
          </div>
        ) : null}
      </div>

      {/* Output handle */}
      <Handle id="output" type="source" position={Position.Right} style={{ background: "#3b82f6", width: 10, height: 10, border: "2px solid #0a0a0a" }} />
    </NodeContainer>
  )
}

export function ExtractFrameNode(props: NodeProps) {
  const { id, selected } = props
  const data = (props.data ?? {}) as WorkflowNodeData
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)
  const storeEdges = useWorkflowStore((s) => s.edges)
  const canvasMode = useWorkflowStore((s) => s.canvasMode)
  const invalidFlash = useWorkflowStore((s) => s.invalidFlash)

  const connectedVideoUrl = isConnectedToHandle(storeEdges, id, "video_url")
  const connectedTimestamp = isConnectedToHandle(storeEdges, id, "timestamp")

  return (
    <NodeContainer nodeId={id} selected={selected} execution={data.execution} label="Extract Frame">
      <div className="flex flex-col gap-2 relative">
        <Handle
          id="video_url"
          type="target"
          position={Position.Left}
          style={{ top: "35%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "video_url" ? "#ef4444" : "#f97316", width: 10, height: 10, border: "2px solid #0a0a0a" }}
        />
        <Handle
          id="timestamp"
          type="target"
          position={Position.Left}
          style={{ top: "65%", background: invalidFlash?.targetNodeId === id && invalidFlash?.targetHandleId === "timestamp" ? "#ef4444" : "#888", width: 8, height: 8, border: "2px solid #0a0a0a" }}
        />

        <div className="space-y-1">
          <div className="text-[#888] text-xs pl-2">video_url</div>
          <div className="text-[#888] text-xs pl-2">timestamp</div>
        </div>

        <div className="flex items-center gap-2 min-h-6">
          <span className="text-xs text-[#888]">video_url</span>
          {connectedVideoUrl ? <span className="text-xs text-blue-400">Receiving input</span> : null}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[#888]">timestamp</label>
          <input
            type="text"
            disabled={connectedTimestamp}
            value={data.kind === "extractFrame" ? data.timestamp : "0"}
            onChange={(e) => updateNodeData(id, { timestamp: e.target.value } as any)}
            placeholder="e.g. 30 or 50%"
            className={
              canvasMode === "light"
                ? `w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-black outline-none ${
                    connectedTimestamp ? "opacity-40 cursor-not-allowed" : ""
                  }`
                : `w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none ${
                    connectedTimestamp ? "opacity-40 cursor-not-allowed" : ""
                  }`
            }
          />
        </div>

        {data.kind === "extractFrame" && data.frameUrl ? (
          <div className="mt-2">
            <p className="text-[#888] text-xs mb-1">Extracted Frame</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.frameUrl} alt="frame" className="w-full rounded-lg max-h-[120px] object-cover" />
          </div>
        ) : null}

        {data.errorMessage ? (
          <div
            className={
              canvasMode === "light"
                ? "mt-2 p-3 rounded-xl border border-red-200 bg-red-50"
                : "mt-2 p-3 bg-red-950/30 rounded-xl border border-red-900/50"
            }
          >
            <div className="flex items-center gap-1.5 mb-1">
              <X className={canvasMode === "light" ? "w-3 h-3 text-red-700" : "w-3 h-3 text-red-400"} />
              <span className={canvasMode === "light" ? "text-red-700 text-xs font-medium" : "text-red-400 text-xs"}>Error</span>
            </div>
            <p className={canvasMode === "light" ? "text-red-700 text-xs" : "text-red-300 text-xs"}>{data.errorMessage}</p>
          </div>
        ) : null}
      </div>

      {/* Output handle */}
      <Handle id="output" type="source" position={Position.Right} style={{ background: "#eab308", width: 10, height: 10, border: "2px solid #0a0a0a" }} />
    </NodeContainer>
  )
}

export const workflowNodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  llm: LlmNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
}

