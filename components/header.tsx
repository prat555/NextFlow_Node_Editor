"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Sparkles, Video, Box, Wand2, ImageIcon, Layers, Menu, X } from "lucide-react"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-lg">K</span>
            </div>
            <span className="font-semibold text-xl text-foreground">krea</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:text-white/80">
                  Generate <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI Image Generation</DropdownMenuLabel>
                <DropdownMenuItem>
                  <ImageIcon className="mr-2 h-4 w-4" /> Text to Image
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Sparkles className="mr-2 h-4 w-4" /> Realtime Image Generation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI Video Generation</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Video className="mr-2 h-4 w-4" /> Text to Video
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Layers className="mr-2 h-4 w-4" /> Motion Transfer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI 3D Generation</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Box className="mr-2 h-4 w-4" /> Text to 3D Object
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Box className="mr-2 h-4 w-4" /> Image to 3D Object
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:text-white/80">
                  Edit <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI Image Enhancements</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Wand2 className="mr-2 h-4 w-4" /> Upscaling
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ImageIcon className="mr-2 h-4 w-4" /> Generative Image Editing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI Video Enhancements</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Video className="mr-2 h-4 w-4" /> Frame Interpolation
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Sparkles className="mr-2 h-4 w-4" /> Video Style Transfer
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Wand2 className="mr-2 h-4 w-4" /> Video Upscaling
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:text-white/80">
                  Customize <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI Finetuning</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Layers className="mr-2 h-4 w-4" /> Image LoRa Finetuning
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Video className="mr-2 h-4 w-4" /> Video LoRa Finetuning
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Sparkles className="mr-2 h-4 w-4" /> LoRa Sharing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">File Management</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Box className="mr-2 h-4 w-4" /> Asset Manager
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/dashboard">
              <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full">
                Sign up for free
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" className="text-white hover:text-white/80 bg-[#2a2a2a] hover:bg-[#333333] rounded-lg">
                Log in
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start text-muted-foreground">
                Generate
              </Button>
              <Button variant="ghost" className="justify-start text-muted-foreground">
                Edit
              </Button>
              <Button variant="ghost" className="justify-start text-muted-foreground">
                Customize
              </Button>
              <div className="border-t border-border my-2" />
              <Link href="/dashboard">
                <Button className="justify-start w-full bg-foreground text-background hover:bg-foreground/90">
                  Sign up for free
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost" className="justify-start w-full text-muted-foreground">
                  Log in
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
