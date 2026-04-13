import { task } from "@trigger.dev/sdk"
import { runTransloaditAssembly } from "./transloadit"

export type CropImageTaskPayload = {
  imageUrl: string
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

export const cropImageTask = task({
  id: "crop-image-task",
  run: async (payload: CropImageTaskPayload): Promise<string> => {
  const imageUrl = payload.imageUrl?.trim()

  if (!imageUrl) {
    throw new Error("imageUrl is required")
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Valid imageUrl is required")
  }

  const x = Math.max(0, Math.min(100, payload.xPercent))
  const y = Math.max(0, Math.min(100, payload.yPercent))
  const width = Math.max(1, Math.min(100, payload.widthPercent))
  const height = Math.max(1, Math.min(100, payload.heightPercent))

  const x2 = Math.min(x + width, 100);
  const y2 = Math.min(y + height, 100);

  const steps = {
  import: {
    robot: "/http/import",
    url: imageUrl,
  },
  crop: {
    robot: "/image/resize",
    use: "import",
    resize_strategy: "crop",
    crop: {
      x1: `${x}%`,
      y1: `${y}%`,
      x2: `${x2}%`,
      y2: `${y2}%`,
    },
    format: "jpg",
  },
}

  return runTransloaditAssembly(steps, "crop")
  },
})

export async function runCropImageTask(payload: CropImageTaskPayload): Promise<string> {
  const result = (await cropImageTask.triggerAndWait(payload)) as any
  if (!result?.ok) {
    throw new Error(result?.error?.message ?? "Crop task failed")
  }
  return String(result.output ?? "")
}
