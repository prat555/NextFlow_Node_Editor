"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Sparkles,
  GitBranch,
  Folder,
  Image,
  Video,
  Wand2,
  Banana,
  Zap,
  Type,
  MoreHorizontal,
  Square,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const mainNav = [
  { name: "Home", href: "/dashboard", icon: Home, iconColor: "text-gray-400" },
  { name: "Train Lora", href: "/dashboard/train-lora", icon: Sparkles, iconColor: "text-orange-400" },
  { name: "Node Editor", href: "/dashboard/node-editor", icon: GitBranch, iconColor: "text-blue-400" },
  { name: "Assets", href: "/dashboard/assets", icon: Folder, iconColor: "text-yellow-400" },
]

const tools = [
  { name: "Image", href: "/dashboard/image", icon: Image, iconColor: "text-blue-400" },
  { name: "Video", href: "/dashboard/video", icon: Video, iconColor: "text-orange-400" },
  { name: "Enhancer", href: "/dashboard/enhancer", icon: Wand2, iconColor: "text-pink-400" },
  { name: "Nano Banana", href: "/dashboard/nano-banana", icon: Banana, iconColor: "text-yellow-400" },
  { name: "Realtime", href: "/dashboard/realtime", icon: Zap, iconColor: "text-cyan-400" },
  { name: "Edit", href: "/dashboard/edit", icon: Type, iconColor: "text-red-400" },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#0a0a0a] flex flex-col transition-all duration-300 z-50 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Collapse button */}
      <div className="p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-400 hover:text-white border border-gray-700"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {mainNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-[#1a1a1a] text-white"
                  : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
              }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} />
              {!collapsed && <span className="text-sm">{item.name}</span>}
            </Link>
          )
        })}

        {/* Tools section */}
        {!collapsed && (
          <p className="text-[10px] text-[#555] uppercase tracking-wider px-3 pt-6 pb-2">
            Tools
          </p>
        )}
        {collapsed && <div className="h-6" />}

        {tools.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-[#1a1a1a] text-white"
                  : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
              }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${item.iconColor}`} />
              {!collapsed && <span className="text-sm">{item.name}</span>}
            </Link>
          )
        })}

        {/* More */}
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-400 hover:bg-[#1a1a1a] hover:text-white w-full">
          <MoreHorizontal className="w-4 h-4 flex-shrink-0 text-gray-400" />
          {!collapsed && <span className="text-sm">More</span>}
        </button>
      </nav>

      {/* Bottom section */}
      <div className="p-3 space-y-2">
        {/* Earn credits */}
        {!collapsed && (
          <button className="text-sm text-[#888] hover:text-gray-300 px-3 py-2 text-left w-full">
            Earn 3,000 Credits
          </button>
        )}

        {/* Upgrade button */}
        <Button
          className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-full ${
            collapsed ? "px-2" : ""
          }`}
        >
          {collapsed ? <Zap className="w-4 h-4" /> : "Upgrade"}
        </Button>

        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
            A
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className="text-sm text-white truncate">awesomeuser</p>
              <span className="text-[10px] text-[#888] bg-[#1a1a1a] px-1.5 py-0.5 rounded">Free</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
