"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"

const CARD_GAP = 48 // px, doubled spacing between cards
const LEFT_PADDING = 64 // px, doubled from 32

const cards = [
  {
    id: 1,
    badge: "Krea 1",
    badgeIcon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: "PROMPT",
    quote: '"Cinematic photo of a person in a linen jacket"',
    image: "https://s.krea.ai/landingPhotorealExamplePortrait.webp",
    buttonLabel: "Generate image",
  },
  {
    id: 2,
    badge: "Veo 3",
    badgeIcon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
        <circle cx="12" cy="12" r="4" fill="white"/>
      </svg>
    ),
    label: "PROMPT",
    quote: '"An animated capybara talking about Krea.ai"',
    image: "https://s.krea.ai/landingCapybaraVideo.webp",
    buttonLabel: "Generate video",
  },
  {
    id: 3,
    badge: "Topaz Upscaler",
    badgeIcon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
    ),
    label: "PROMPT",
    quote: "Upscale image 512px → 8K",
    image: "https://s.krea.ai/landingUpscalerExample.webp",
    buttonLabel: "Upscale image",
  },
  {
    id: 4,
    badge: "Hailuo",
    badgeIcon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
        <path d="M8 12a4 4 0 0 1 8 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    label: "PROMPT",
    quote: '"Advertisement shot of a sandwich vertically exploding into different layers"',
    image: "https://s.krea.ai/landingHailuoExample.webp",
    buttonLabel: "Generate video",
  },
  {
    id: 5,
    badge: "Krea 1",
    badgeIcon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: "PROMPT",
    quote: '"Dramatic photo of an old offroad truck racing through the desert"',
    image: "https://s.krea.ai/landingDesertTruckExample.webp",
    buttonLabel: "Generate image",
  },
]

export function WorkflowShowcase() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const getCardWidth = () => {
    if (!scrollRef.current) return 0
    const containerWidth = scrollRef.current.offsetWidth
    // Show 3.7 cards: slightly smaller cards, more peek on the right
    return (containerWidth - LEFT_PADDING - 2.7 * CARD_GAP) / 3.7
  }

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return
    const cardWidth = getCardWidth()
    const amount = cardWidth + CARD_GAP
    scrollRef.current.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" })
  }

  return (
    <section className="bg-white py-16 overflow-hidden">
      {/* Left padding only — right edge is flush so last card touches the scrollbar */}
      <div className="pl-16 pr-0 relative">
        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto"
          style={{
            gap: CARD_GAP,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "x mandatory",
            scrollPaddingLeft: LEFT_PADDING,
            paddingRight: "64px",
          }}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              className="relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer group"
              style={{
                width: `calc((100vw - ${LEFT_PADDING}px - 2.7 * ${CARD_GAP}px) / 3.7)`,
                aspectRatio: "9/11",
                scrollSnapAlign: "start",
              }}
              onMouseEnter={() => setHoveredId(card.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Background image */}
              <Image
                src={card.image}
                alt={card.quote}
                fill
                loading={card.id === 1 ? "eager" : "lazy"}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="30vw"
                unoptimized
              />

              {/* Dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

              {/* Badge top-left — no background, just text+icon with drop shadow */}
              <div className="absolute top-4 left-4 flex items-center gap-1.5 drop-shadow-lg">
                {card.badgeIcon}
                <span className="text-white text-sm font-semibold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                  {card.badge}
                </span>
              </div>

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3">
                <div
                  className="transition-transform duration-300 ease-out"
                  style={{
                    transform: hoveredId === card.id ? "translateY(-8px)" : "translateY(0)",
                  }}
                >
                  <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase mb-1.5">
                    {card.label}
                  </p>
                  <p className="text-white font-bold text-2xl leading-snug">{card.quote}</p>
                </div>

                {/* Generate button — appears on hover, rectangular */}
                <div
                  className="transition-all duration-300 overflow-hidden"
                  style={{
                    maxHeight: hoveredId === card.id ? "56px" : "0px",
                    opacity: hoveredId === card.id ? 1 : 0,
                  }}
                >
                  <button className="bg-[#1c1c1e] hover:bg-[#2a2a2a] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap">
                    {card.buttonLabel}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Nav arrows — bottom right inside padded wrapper */}
          <div className="flex justify-end gap-2 mt-5 pr-16">
          <button
            onClick={() => scroll("left")}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
