import { createHmac } from "crypto"

type AssemblyResultFile = {
  ssl_url?: string
  url?: string
}

type AssemblyStatusResponse = {
  ok?: string
  error?: string
  message?: string
  results?: Record<string, AssemblyResultFile[]>
  assembly_ssl_url?: string
}

function getAuth() {
  const key = process.env.TRANSLOADIT_AUTH_KEY?.trim()
  const secret = process.env.TRANSLOADIT_AUTH_SECRET?.trim()
  if (!key || !secret) {
    throw new Error("Transloadit credentials are missing")
  }
  return { key, secret }
}

function signParams(paramsJson: string, secret: string) {
  const digest = createHmac("sha384", secret).update(paramsJson).digest("hex")
  return `sha384:${digest}`
}

function buildAuthParams(key: string) {
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  return { key, expires }
}

async function createAssembly(
  params: string,
  signature: string,
  file?: { bytes: Buffer; filename: string; contentType: string }
): Promise<AssemblyStatusResponse> {
  const body = new FormData()
  body.set("params", params)
  body.set("signature", signature)

  if (file) {
    const blob = new Blob([file.bytes], { type: file.contentType })
    body.set("file", blob, file.filename)
  }

  const startRes = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body,
  })

  if (!startRes.ok) {
    const text = await startRes.text().catch(() => "")
    throw new Error(`Failed to create Transloadit assembly (${startRes.status}): ${text}`)
  }

  return (await startRes.json()) as AssemblyStatusResponse
}

async function waitForAssemblyResult(assemblySslUrl: string, resultStep: string): Promise<string> {
  const startedAt = Date.now()
  const timeoutMs = 3 * 60 * 1000

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500))

    const statusRes = await fetch(assemblySslUrl)
    if (!statusRes.ok) continue

    const status = (await statusRes.json()) as AssemblyStatusResponse
    const okCode = status.ok ?? ""

    if (okCode === "ASSEMBLY_COMPLETED") {
      const files = status.results?.[resultStep] ?? []
      const first = files[0]
      const url = first?.ssl_url ?? first?.url
      if (!url) {
        const keys = Object.keys(status.results ?? {})
        throw new Error(
          `Transloadit completed but step "${resultStep}" had no output. Available steps: ${keys.join(", ")}`
        )
      }
      return url
    }

    if (TERMINAL_ERROR.has(okCode) || status.error) {
      throw new Error(
        `Transloadit assembly failed with status "${okCode}": ${status.message ?? status.error ?? "unknown error"}`
      )
    }

    if (IN_PROGRESS.has(okCode) || !okCode) {
      continue
    }

    console.warn(`[transloadit] Unknown assembly status: "${okCode}" - continuing to poll`)
  }

  throw new Error("Transloadit assembly timed out after 3 minutes")
}

const TERMINAL_OK = new Set(["ASSEMBLY_COMPLETED"])
const TERMINAL_ERROR = new Set([
  "ASSEMBLY_FAILED",
  "REQUEST_ABORTED",
  "IMPORT_FAILED",
  "EXPORT_FAILED",
])
const IN_PROGRESS = new Set([
  "ASSEMBLY_EXECUTING",
  "ASSEMBLY_UPLOADING",
  "ASSEMBLY_REPLAYING",
  "QUEUE_FULL",
])

export async function runTransloaditAssembly(
  steps: Record<string, unknown>,
  resultStep: string
): Promise<string> {
  const { key, secret } = getAuth()
  const paramsObj = { auth: buildAuthParams(key), steps }
  const params = JSON.stringify(paramsObj)
  const signature = signParams(params, secret)

  const started = await createAssembly(params, signature)
  if (!started.assembly_ssl_url) {
    throw new Error("Transloadit did not return assembly URL")
  }

  return waitForAssemblyResult(started.assembly_ssl_url, resultStep)
}

export async function uploadBufferToTransloadit(
  file: { bytes: Buffer; filename: string; contentType?: string },
  resultStep = ":original"
): Promise<string> {
  const { key, secret } = getAuth()
  const steps = {
    [resultStep]: {
      robot: "/upload/handle",
      result: true,
    },
  }

  const params = JSON.stringify({ auth: buildAuthParams(key), steps })
  const signature = signParams(params, secret)
  const started = await createAssembly(params, signature, {
    bytes: file.bytes,
    filename: file.filename,
    contentType: file.contentType ?? "application/octet-stream",
  })

  if (!started.assembly_ssl_url) {
    throw new Error("Transloadit did not return assembly URL")
  }

  return waitForAssemblyResult(started.assembly_ssl_url, resultStep)
}