import { task } from "@trigger.dev/sdk"
import { runTransloaditAssembly } from "./transloadit"

export type ExtractFrameTaskPayload = {
  videoUrl: string
  timestamp: string
}

function normalizeTimestamp(value: string): string {
  const raw = value.trim()
  if (!raw) return "50%"

  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1))
    if (!Number.isFinite(pct)) return "50%"
    const clamped = Math.max(0, Math.min(100, pct))
    return `${clamped}%`
  }

  const seconds = Number(raw)
  if (!Number.isFinite(seconds)) return "50%"
  return `${Math.max(0, seconds)}`
}

export const extractFrameTask = task({
  id: "extract-frame-task",
  run: async (payload: ExtractFrameTaskPayload): Promise<string> => {
    const videoUrl = payload.videoUrl.trim()
    if (!videoUrl) {
      throw new Error("videoUrl is required")
    }
    if (!/^https?:\/\//i.test(videoUrl)) {
      throw new Error("Valid videoUrl is required")
    }

    const timestamp = normalizeTimestamp(payload.timestamp)

    const steps = {
      import: {
        robot: "/http/import",
        url: addCacheBuster(videoUrl),
      },
      frame: {
        robot: "/video/thumbs",
        use: "import",
        count: 1,
        format: "jpg",
        // ✅ FIX: correct parameter is `offsets`, not `from`
        // Pass as array — Transloadit picks the closest keyframe to each offset
        offsets: [timestamp],
      },
    }

    try {
      return await runTransloaditAssembly(steps, "frame")
    } catch {
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect fill='%23333' width='320' height='180'/%3E%3Ctext x='50%25' y='50%25' fill='%23999' text-anchor='middle' dominant-baseline='middle'%3EFrame unavailable%3C/text%3E%3C/svg%3E`
    }
  },
})

export async function runExtractFrameTask(payload: ExtractFrameTaskPayload): Promise<string> {
  const result = (await extractFrameTask.triggerAndWait(payload)) as any
  if (!result?.ok) {
    throw new Error(result?.error?.message ?? "Extract frame task failed")
  }
  return String(result.output ?? "")
}