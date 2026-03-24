"use client"

import { useState } from "react"
import { ArrowRight, ImageIcon, Wand2, Sparkles, Video, Layers, Play, Edit3 } from "lucide-react"

const useCases = [
  {
    id: "image-gen",
    title: "AI Image Generation",
    description:
      "Generate images with a simple text description. Control your compositions precisely with over 1000 styles, 20 different models, native 4K, image prompts, and image style transfer through exceptionally simple interfaces.",
    icon: ImageIcon,
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    id: "upscaling",
    title: "Image Upscaling",
    description:
      "Enhance and upscale images up to a 22K resolution. Make blurry photos razor-sharp, turn simple 3D renders into photo-like architecture visualizations, restore old film scans, or add ultra-fine skin textures to your portraits.",
    icon: Wand2,
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    id: "realtime",
    title: "Real-time rendering",
    description:
      "Turn easy-to-control primitives into photorealistic images in less than 50ms. Or try out the revolutionary Video Realtime with full frame consistency.",
    icon: Sparkles,
    gradient: "from-amber-500/20 to-yellow-500/20",
  },
  {
    id: "video-gen",
    title: "AI Video Generation",
    description:
      "Access all of the most powerful AI video models. Generate viral videos for social media, animate static images, or add new details to existing videos.",
    icon: Video,
    gradient: "from-pink-500/20 to-rose-500/20",
  },
  {
    id: "lora",
    title: "LoRA Fine-tuning",
    description:
      "Train your own model. Upload just a few images of the same face, product, or visual style and teach the AI to generate it on demand.",
    icon: Layers,
    gradient: "from-indigo-500/20 to-blue-500/20",
  },
  {
    id: "video-upscale",
    title: "Video Upscaling",
    description:
      "Upscale Videos up to 8K and interpolate frames to 120fps. Restore old videos, turn phone captures into professional footage, or make regular videos ultra slow-mo.",
    icon: Play,
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  {
    id: "editing",
    title: "Generative Editing",
    description:
      "Choose from multiple editing models to edit images with generative AI. Add or remove objects, merge images, change expressions, or lighting in an exceptionally simple interface.",
    icon: Edit3,
    gradient: "from-rose-500/20 to-orange-500/20",
  },
]

export function UseCases() {
  const [activeCase, setActiveCase] = useState(0)

  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-left mb-16">
          <p className="text-lg font-bold text-gray-500 mb-2">
            Use cases
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-balance">
            Generate or edit high quality images, videos, and 3D objects with AI
          </h2>
        </div>

        {/* Use case list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: List */}
          <div className="space-y-2">
            {useCases.map((useCase, index) => (
              <div
                key={useCase.id}
                onClick={() => setActiveCase(index)}
                className={`group cursor-pointer p-6 rounded-2xl border transition-all duration-300 ${
                  activeCase === index
                    ? "border-gray-300 bg-gray-50"
                    : "border-transparent hover:border-gray-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      activeCase === index
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <useCase.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {useCase.title}
                    </h3>
                    <p
                      className={`text-sm text-gray-500 transition-all duration-300 ${
                        activeCase === index
                          ? "max-h-40 opacity-100"
                          : "max-h-0 opacity-0 overflow-hidden"
                      }`}
                    >
                      {useCase.description}
                    </p>
                    <div
                      className={`flex items-center gap-2 text-sm font-medium mt-3 transition-all duration-300 ${
                        activeCase === index
                          ? "text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      Try {useCase.title}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Preview */}
          <div className="relative lg:sticky lg:top-24 h-fit">
            <div
              className={`rounded-3xl border border-gray-200 bg-white overflow-hidden aspect-square flex items-center justify-center bg-gradient-to-br ${useCases[activeCase].gradient}`}
            >
              <div className="text-center p-8">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  {(() => {
                    const Icon = useCases[activeCase].icon
                    return <Icon className="w-10 h-10 text-gray-900" />
                  })()}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {useCases[activeCase].title}
                </h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  {useCases[activeCase].description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
