"use client"

import { Button } from "@/components/ui/button"

const companies = [
  { name: "Lego", abbr: "LEGO" },
  { name: "Samsung", abbr: "SAMSUNG" },
  { name: "Nike", abbr: "NIKE" },
  { name: "Microsoft", abbr: "MSFT" },
  { name: "Shopify", abbr: "SHOPIFY" },
]

export function LogoMarquee() {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-left">
          A tool suite for pros and beginners alike
        </h2>
        <p className="text-lg text-gray-500 mb-12 text-left">
          Krea powers millions of creatives, enterprises, and everyday people.
        </p>

        {/* Logo scroll */}
        <div className="relative overflow-hidden mb-12">
          <div className="flex animate-marquee gap-16 items-center justify-center">
            {[...companies, ...companies].map((company, index) => (
              <div
                key={index}
                className="text-2xl font-bold text-gray-300 hover:text-gray-500 transition-colors whitespace-nowrap"
              >
                {company.abbr}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <Button
            size="lg"
            className="bg-gray-900 text-white hover:bg-gray-800 px-8 rounded-full"
          >
            Sign up for free
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-gray-300 text-gray-900 hover:bg-gray-100 px-8 rounded-full"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  )
}
