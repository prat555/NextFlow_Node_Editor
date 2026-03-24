import Link from "next/link"
import { UserRound, ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section
      className="flex flex-col items-center pt-24 pb-16 px-4 overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1a1a2e 0%, #0d0d14 40%, #000000 100%)",
      }}
    >
      {/* Text content */}
      <div className="text-center max-w-4xl mx-auto">
        {/* Main headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[82px] font-bold tracking-tight leading-[1.1] mb-6 text-balance">
          <span className="text-white">The most powerful </span>
          <span className="text-[#8a8a8a]">AI</span>
          <br />
          <span className="text-white">suite for Creatives.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-[15px] sm:text-base text-[#8a8a8a] max-w-xl mx-auto mb-10">
          Generate, enhance, and edit images, videos, or 3D meshes for free with AI.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard">
            <button className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-7 py-3 text-[15px] font-medium rounded-full transition-colors">
              <UserRound className="h-4 w-4" />
              Sign Up
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="flex items-center gap-2 bg-[#222222] hover:bg-[#2a2a2a] text-white px-7 py-3 text-[15px] font-medium rounded-full transition-colors">
              <ArrowRight className="h-4 w-4" />
              Launch App
            </button>
          </Link>
        </div>
      </div>

      {/* Demo placeholder */}
      <div className="w-full max-w-5xl mx-auto mt-14 px-4">
        <div className="w-full aspect-[16/10] bg-[#111111] rounded-2xl border border-[#222222]" />
        <p className="text-center text-[13px] text-[#666666] mt-4">
          Workflow showing image generation, video animation, asset management, and video upscaling in Krea.
        </p>
      </div>
    </section>
  )
}
