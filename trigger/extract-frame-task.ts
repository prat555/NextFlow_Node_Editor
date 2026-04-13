import { task } from "@trigger.dev/sdk"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { uploadBufferToTransloadit } from "./transloadit"

export type ExtractFrameTaskPayload = {
  videoUrl: string
  timestamp: string
}

type TimestampInput =
  | { kind: "percent"; value: number }
  | { kind: "seconds"; value: number }

function parseTimestamp(value: string): TimestampInput {
  const raw = value.trim()
  if (!raw) return { kind: "percent", value: 50 }

  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1))
    if (!Number.isFinite(pct)) return { kind: "percent", value: 50 }
    const clamped = Math.max(0, Math.min(100, pct))
    return { kind: "percent", value: clamped }
  }

  const seconds = Number(raw)
  if (!Number.isFinite(seconds)) return { kind: "percent", value: 50 }
  return { kind: "seconds", value: Math.max(0, seconds) }
}

function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim()
  if (fromEnv) return fromEnv
  return "ffmpeg"
}

function runProcess(command: string, args: string[], allowFailure = false): Promise<{ stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let stderr = ""

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (!allowFailure && code !== 0) {
        reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stderr}`))
        return
      }
      resolve({ stderr, code })
    })
  })
}

function parseDurationSeconds(ffmpegStderr: string): number {
  const match = ffmpegStderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!match) {
    throw new Error("Could not determine video duration from ffmpeg output")
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  return hours * 3600 + minutes * 60 + seconds
}

function toSeekSeconds(timestamp: TimestampInput, durationSeconds: number): number {
  if (timestamp.kind === "seconds") return timestamp.value
  return (timestamp.value / 100) * durationSeconds
}

async function extractFrameWithFfmpeg(videoUrl: string, timestampRaw: string): Promise<string> {
  const ffmpegPath = resolveFfmpegPath()
  const workingDir = await mkdtemp(join(tmpdir(), "nextflow-extract-frame-"))
  const inputFile = join(workingDir, "input-video")
  const outputFile = join(workingDir, "frame.jpg")

  try {
    const response = await fetch(videoUrl, { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`Failed to download video (${response.status})`)
    }

    const videoBytes = Buffer.from(await response.arrayBuffer())
    await writeFile(inputFile, videoBytes)

    const probe = await runProcess(ffmpegPath, ["-hide_banner", "-i", inputFile], true)
    const durationSeconds = parseDurationSeconds(probe.stderr)
    const parsedTimestamp = parseTimestamp(timestampRaw)

    if (durationSeconds <= 0) {
      throw new Error("Could not determine a valid video duration")
    }

    const requestedSeconds = toSeekSeconds(parsedTimestamp, durationSeconds)
    if (parsedTimestamp.kind === "seconds" && requestedSeconds > durationSeconds) {
      throw new Error(
        `Requested timestamp ${requestedSeconds.toFixed(2)}s is beyond video duration ${durationSeconds.toFixed(2)}s. Please enter a timestamp within the video length.`,
      )
    }

    // Avoid seeking exactly at the end, which can produce no output frame.
    const maxSeekSeconds = Math.max(0, durationSeconds - 0.05)
    const seekSeconds = Math.max(0, Math.min(maxSeekSeconds, requestedSeconds))

    // Place -ss after -i for accurate frame selection (not nearest keyframe fast seek).
    await runProcess(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputFile,
      "-ss",
      seekSeconds.toFixed(3),
      "-frames:v",
      "1",
      "-q:v",
      "2",
      "-y",
      outputFile,
    ])

    let frameBytes: Buffer
    try {
      frameBytes = await readFile(outputFile)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new Error("Could not extract a frame at that timestamp. Please choose an earlier point in the video.")
      }
      throw error
    }

    return uploadBufferToTransloadit({
      bytes: frameBytes,
      filename: "frame.jpg",
      contentType: "image/jpeg",
    })
  } finally {
    await rm(workingDir, { recursive: true, force: true })
  }
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
    return extractFrameWithFfmpeg(videoUrl, payload.timestamp)
  },
})

export async function runExtractFrameTask(payload: ExtractFrameTaskPayload): Promise<string> {
  const result = (await extractFrameTask.triggerAndWait(payload)) as any
  if (!result?.ok) {
    throw new Error(result?.error?.message ?? "Extract frame task failed")
  }
  return String(result.output ?? "")
}