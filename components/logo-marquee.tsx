"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const companies = [
  { name: "Lego", logo: "L" },
  { name: "Samsung", logo: "S" },
  { name: "Nike", logo: "N" },
  { name: "Microsoft", logo: "M" },
  { name: "Shopify", logo: "S" },
]

export function LogoMarquee() {
  const [scrollPosition, setScrollPosition] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setScrollPosition((prev) => prev + 1)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <p className="text-lg font-bold text-gray-500 mb-2 text-left">
          A tool suite for pros and beginners alike
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-12 text-left">
          Krea powers millions of creatives, enterprises, and everyday people.
        </h2>

        {/* Logo scroll */}
        <div className="relative mb-8 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
          
          <div
            className="flex gap-8 transition-transform duration-100"
            style={{ transform: `translateX(-${scrollPosition * 2}px)` }}
          >
            {[...companies, ...companies, ...companies, ...companies].map((company, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-6 py-3 rounded-full bg-transparent whitespace-nowrap"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                  {company.logo}
                </div>
                <span className="text-gray-500 font-medium">{company.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="sm"
            className="bg-white text-black hover:bg-gray-50 px-6 rounded-none border-0 shadow-none"
          >
            Sign up for free
          </Button>
          <Button
            size="sm"
            className="bg-black text-white hover:bg-gray-900 px-6 rounded-md"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  )
}
