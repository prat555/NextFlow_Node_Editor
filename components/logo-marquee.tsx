"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"

const companies = [
  { name: "Lego", abbr: "LEGO", logo: "https://cdn.worldvectorlogo.com/logos/lego-4.svg" },
  { name: "Samsung", abbr: "SAMSUNG", logo: "https://cdn.worldvectorlogo.com/logos/samsung-4.svg" },
  { name: "Nike", abbr: "NIKE", logo: "https://cdn.worldvectorlogo.com/logos/nike-4-1.svg" },
  { name: "Microsoft", abbr: "MSFT", logo: "https://cdn.worldvectorlogo.com/logos/microsoft-6.svg" },
  { name: "Shopify", abbr: "SHOPIFY", logo: "https://cdn.worldvectorlogo.com/logos/shopify.svg" },
]

export function LogoMarquee() {
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
        <div className="relative overflow-hidden mb-12">
          <div className="flex animate-marquee gap-16 items-center justify-center">
            {[...companies, ...companies].map((company, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-2xl font-bold text-gray-500 whitespace-nowrap"
              >
                <Image
                  src={company.logo}
                  alt={`${company.name} logo`}
                  width={24}
                  height={24}
                  className="opacity-60 grayscale w-auto h-auto"
                  unoptimized
                />
                {company.abbr}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-white text-black hover:bg-gray-50 px-8 rounded-none border-0 shadow-none"
          >
            Sign up for free
          </Button>
          <Button
            size="lg"
            className="bg-black text-white hover:bg-gray-900 px-8 rounded-md"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  )
}
