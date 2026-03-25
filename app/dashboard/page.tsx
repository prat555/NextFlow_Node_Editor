"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Image, Video, Wand2, Zap } from "lucide-react"

const heroSlides = [
  {
    title: "Start by generating a free image",
  },
  {
    title: "Create stunning videos with AI",
  },
  {
    title: "Enhance your photos instantly",
  },
]

const toolCards = [
  {
    name: "Image",
    description: "Generate stunning images from text",
    icon: Image,
    iconColor: "text-blue-400",
    cardBg: "bg-gradient-to-br from-yellow-400 to-orange-500",
  },
  {
    name: "Video",
    description: "Create videos from images or text",
    icon: Video,
    iconColor: "text-orange-400",
    cardBg: "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]",
  },
  {
    name: "Enhancer",
    description: "Upscale and enhance your images",
    icon: Wand2,
    iconColor: "text-pink-400",
    cardBg: "bg-gradient-to-br from-[#1a2a3a] to-[#0a1520]",
  },
  {
    name: "Realtime",
    description: "Generate images in real-time",
    icon: Zap,
    iconColor: "text-purple-400",
    cardBg: "bg-gradient-to-br from-purple-900 to-indigo-950",
  },
]

export default function DashboardPage() {
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
  }

  return (
    <div className="p-6 space-y-6 bg-[#0d0d0d] min-h-screen">
      {/* Hero Banner */}
      <div className="relative">
        <div
          className="relative h-72 rounded-2xl bg-gradient-to-br from-sky-200 via-sky-100 to-white flex items-center justify-center overflow-hidden"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-light text-gray-800 text-center px-8 relative z-10">
            {heroSlides[currentSlide].title}
          </h1>
        </div>

        {/* Navigation arrows */}
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          <button
            onClick={prevSlide}
            className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-gray-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex justify-center">
        <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-full font-medium transition-colors">
          <span className="w-1.5 h-1.5 bg-white rounded-full" />
          Click here to open the image tool
        </button>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {toolCards.map((tool) => (
          <div
            key={tool.name}
            className={`group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer ${tool.cardBg}`}
          >
            {/* Centered icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-xl bg-black/30 backdrop-blur-sm flex items-center justify-center">
                <tool.icon className={`w-7 h-7 ${tool.iconColor}`} />
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <div>
                <h3 className="text-white font-semibold text-lg">{tool.name}</h3>
                <p className="text-gray-300 text-sm">{tool.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent/Suggested section */}
      <div className="pt-6">
        <h2 className="text-lg font-medium text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Text to Image", icon: Image, color: "text-blue-400" },
            { label: "Image to Video", icon: Video, color: "text-orange-400" },
            { label: "Upscale Image", icon: Wand2, color: "text-pink-400" },
            { label: "Realtime Canvas", icon: Zap, color: "text-yellow-400" },
          ].map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-3 p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#222] transition-colors text-left"
            >
              <action.icon className={`w-5 h-5 ${action.color}`} />
              <span className="text-white text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
