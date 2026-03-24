"use client"

import { useEffect, useState } from "react"
import { Zap, Image, Layers, Sparkles, Box, Palette, Check } from "lucide-react"

const models = [
  { name: "Veo 3.1", logo: "V" },
  { name: "Ideogram", logo: "I" },
  { name: "Runway", logo: "R" },
  { name: "Luma", logo: "L" },
  { name: "Flux", logo: "F" },
  { name: "Gemini", logo: "G" },
  { name: "Krea 1", logo: "K" },
]

const rotatingWords = ["Image", "Video", "3D", "Creative"]

const features = [
  { icon: Zap, text: "Industry-leading inference speed" },
  { icon: Image, text: "22K Pixels upscaling" },
  { icon: Layers, text: "Fine-tune models with your own data" },
  { icon: Sparkles, text: "4K Native image generation" },
  { icon: Box, text: "Ultra-realistic flagship model" },
  { icon: Palette, text: "1000+ styles" },
]

export function ModelShowcase() {
  const [scrollPosition, setScrollPosition] = useState(0)
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length)
        setIsAnimating(false)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setScrollPosition((prev) => (prev + 1) % (models.length * 2))
  }, [])


  return (
    <section className="py-24 px-4 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto text-center">
        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          {"The industry's best "}
          <span className="relative inline-block min-w-[140px]">
            <span
              className={`inline-block transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
              }`}
            >
              {rotatingWords[currentWordIndex]}
            </span>
          </span>
          {" models."}
        </h2>
        <p className="text-xl text-gray-500 mb-12">In one subscription.</p>

        {/* Scrolling model logos */}
        <div className="relative mb-16 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
          
          <div
            className="flex gap-8 transition-transform duration-100"
            style={{ transform: `translateX(-${scrollPosition * 2}px)` }}
          >
            {[...models, ...models, ...models].map((model, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-6 py-3 rounded-full bg-gray-50 border border-gray-200 whitespace-nowrap"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-900">
                  {model.logo}
                </div>
                <span className="text-gray-900 font-medium">{model.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-gray-900" />
              </div>
              <span className="text-sm text-gray-900">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">64+</div>
            <div className="text-sm text-gray-500">Models</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
              <Check className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-sm text-gray-500">Do not train</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">1000+</div>
            <div className="text-sm text-gray-500">Styles</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">3s</div>
            <div className="text-sm text-gray-500">Generation time</div>
          </div>
        </div>
      </div>
    </section>
  )
}
