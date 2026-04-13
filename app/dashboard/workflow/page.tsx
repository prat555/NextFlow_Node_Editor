"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  ChevronDown,
  LayoutGrid,
  Plus,
  Search,
  ArrowUpRight,
  GitBranch,
  MoreVertical,
  FolderOpen,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react"
import { useWorkflows } from "@/hooks/use-workflows"

type UiWorkflow = {
  id: string
  name: string
  editedAt: string
  hasPreview?: boolean
}


const tabs = ["Projects", "Apps", "Examples", "Templates"] as const

export default function WorkflowProjectsPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Projects")
  const [searchQuery, setSearchQuery] = useState("")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renameDialog, setRenameDialog] = useState<{ id: string; name: string } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { workflows: apiWorkflows, loading } = useWorkflows()

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenuId]);

  const renameWorkflow = async (id: string, newName: string) => {
    if (!newName || newName.trim() === "") return
    setRenaming(true)
    const response = await fetch(`/api/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setRenaming(false)
    if (response.ok) {
      window.location.reload()
    }
  }

  const duplicateWorkflow = async (id: string, currentName: string) => {
    const response = await fetch(`/api/workflows/${id}`)
    if (!response.ok) return
    const data = await response.json()
    const workflow = data?.workflow
    if (!workflow) return

    const createRes = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${currentName} Copy`,
        nodes: Array.isArray(workflow.nodes) ? workflow.nodes : [],
        edges: Array.isArray(workflow.edges) ? workflow.edges : [],
      }),
    })
    if (createRes.ok) {
      window.location.reload()
    }
  }

  const deleteWorkflow = async (id: string) => {
    setDeleting(true)
    const response = await fetch(`/api/workflows/${id}`, { method: "DELETE" })
    setDeleting(false)
    if (response.ok) {
      window.location.reload()
    }
  }

  const workflows: UiWorkflow[] = apiWorkflows.map((w) => ({
    id: w.id,
    name: w.name,
    editedAt: w.updatedAt.toLocaleString(),
    hasPreview: true,
  }))

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  const hasWorkflows = filteredWorkflows.length > 0

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* Hero Banner */}
      <div className="relative h-[50vh] overflow-hidden">
        {/* Custom background image */}
        <div className="absolute inset-0">
          <img
            src="https://s.krea.ai/nodesHeaderBannerBlurGradient.webp"
            alt="Node Editor Banner"
            className="w-full h-full object-cover object-center"
            draggable={false}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 px-8 pt-8">
          {/* Title row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#3b82f6] flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-[34px] font-bold text-white leading-none">Node Editor</h1>
          </div>

          {/* Subtitle */}
          <p className="text-white/90 text-sm max-w-130 mb-6">
            Nodes is the most powerful way to operate Krea. Connect every tool and model into complex automated
            pipelines.
          </p>

          {/* New Workflow button */}
          <Link
            href="/dashboard/workflow/new"
            prefetch={false}
            className="inline-flex items-center gap-2 bg-white text-black rounded-full px-6 py-2.5 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            New Workflow
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Projects Section */}
      <div className="px-8 py-6">
        {/* Tabs and Search Row */}
        <div className="flex items-center justify-between mb-4">
          {/* Tabs */}
          <div className="flex items-center gap-6">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1a1a1a] border border-[#222] rounded-md pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#666] focus:outline-none focus:border-[#444] w-55"
              />
            </div>

            <button className="flex items-center gap-2 bg-[#1a1a1a] border border-[#222] rounded-md px-3 py-2 text-sm text-white hover:bg-[#222] transition-colors">
              Last viewed
              <ChevronDown className="w-4 h-4 text-[#888]" />
            </button>

            <button className="bg-[#1a1a1a] border border-[#222] rounded-md w-10 h-10 flex items-center justify-center text-[#888] hover:text-white hover:bg-[#222] transition-colors">
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-[#222] mb-6" />

        {hasWorkflows ? (
          /* Projects Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* New Workflow Card */}
            <Link href="/dashboard/workflow/new" prefetch={false} className="block">
              <div className="bg-[#1a1a1a] rounded-2xl aspect-4/3 flex items-center justify-center hover:bg-[#222] transition-colors">
                <div className="w-16 h-16 rounded-full border border-white/60 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-white" />
                </div>
              </div>
              <p className="text-white text-sm font-medium mt-2">New Workflow</p>
            </Link>

            {/* Workflow Cards */}
            {filteredWorkflows.map((workflow) => (
              <div key={workflow.id} className="block">
                <div className="bg-[#1a1a1a] rounded-2xl aspect-4/3 overflow-hidden relative hover:ring-1 hover:ring-[#333] transition-all group">
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setOpenMenuId((curr) => (curr === workflow.id ? null : workflow.id))
                      }}
                      className="w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer bg-transparent hover:bg-transparent focus:bg-transparent shadow-none border-none outline-none"
                      style={{ boxShadow: 'none', background: 'none', border: 'none' }}
                    >
                      <MoreVertical className="w-5 h-5 text-white" />
                    </button>

                    {openMenuId === workflow.id ? (
                      <div
                        ref={menuRef}
                        className="absolute right-0 mt-2 w-44 rounded-lg border border-[#2a2a2a] bg-[#121212] shadow-xl overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null)
                            window.location.href = `/dashboard/workflow/${workflow.id}`
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#1a1a1a] flex items-center gap-2 cursor-pointer"
                        >
                          <FolderOpen className="w-4 h-4" /> Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null)
                            setRenameDialog({ id: workflow.id, name: workflow.name })
                            setRenameValue(workflow.name)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#1a1a1a] flex items-center gap-2 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setOpenMenuId(null)
                            await duplicateWorkflow(workflow.id, workflow.name)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#1a1a1a] flex items-center gap-2 cursor-pointer"
                        >
                          <Copy className="w-4 h-4" /> Duplicate
                        </button>
                        <div className="border-t border-[#2a2a2a]" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null)
                            setDeleteDialog({ id: workflow.id, name: workflow.name })
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <Link href={`/dashboard/workflow/${workflow.id}`} className="block w-full h-full">
                  {workflow.hasPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[80%] h-[70%] rounded-xl border border-[#222] bg-[#161616] flex items-center justify-center relative">
                        <div className="absolute left-4 top-4 w-12 h-16 bg-[#2a2a2a] rounded-lg border border-[#333]" />
                        <div className="absolute right-4 top-8 w-10 h-12 bg-[#2a2a2a] rounded-lg border border-[#333]" />
                        <div className="absolute left-10 bottom-6 w-14 h-12 bg-[#2a2a2a] rounded-lg border border-[#333]" />
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 140">
                          <path
                            d="M42 45 C 70 20, 95 30, 120 55"
                            stroke="rgba(59, 130, 246, 0.55)"
                            strokeWidth="2"
                            fill="none"
                          />
                          <path
                            d="M120 55 C 140 75, 150 90, 158 105"
                            stroke="rgba(59, 130, 246, 0.35)"
                            strokeWidth="2"
                            fill="none"
                          />
                          <circle cx="42" cy="45" r="3.5" fill="rgba(59, 130, 246, 0.7)" />
                          <circle cx="120" cy="55" r="3.5" fill="rgba(59, 130, 246, 0.5)" />
                          <circle cx="158" cy="105" r="3.5" fill="rgba(59, 130, 246, 0.35)" />
                        </svg>
                      </div>
                    </div>
                  )}
                  </Link>
                </div>
                <p className="text-white text-sm font-medium mt-2">{workflow.name}</p>
                <p className="text-[#888] text-xs">Edited {workflow.editedAt}</p>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 text-[#888] text-sm">Loading workflows...</div>
        ) : (
          /* Empty State - Just show New Workflow Card */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/workflow/new" prefetch={false} className="block">
              <div className="bg-[#1a1a1a] rounded-2xl aspect-4/3 flex items-center justify-center hover:bg-[#222] transition-colors">
                <div className="w-16 h-16 rounded-full border border-white/60 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-white" />
                </div>
              </div>
              <p className="text-white text-sm font-medium mt-2">New Workflow</p>
            </Link>
          </div>
        )}
      </div>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null) }}>
        <DialogContent showCloseButton={!deleting} className="bg-[#18191a] border-none shadow-2xl p-7 max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              {deleteDialog ? (
                <>
                  Delete <span className="font-bold text-red-400 ml-1">'{deleteDialog.name}'</span>?
                </>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-base text-gray-300">
            This workflow will be permanently deleted. <br />
            <span className="text-gray-400 text-sm">You can’t undo this action.</span>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={deleting}
                className="mr-2 bg-white text-black hover:bg-gray-100 border border-gray-200"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (deleteDialog) {
                  await deleteWorkflow(deleteDialog.id)
                }
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Workflow Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => { if (!open) setRenameDialog(null) }}>
        <DialogContent showCloseButton={!renaming} className="bg-[#18191a] border-none shadow-2xl p-7 max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              {renameDialog ? (
                <>
                  Rename <span className="font-bold text-blue-400 ml-1">'{renameDialog.name}'</span>
                </>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-base text-gray-300">
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="w-full rounded-md bg-[#232323] border border-[#333] px-3 py-2 text-white focus:outline-none focus:border-[#3b82f6]"
              disabled={renaming}
              autoFocus
              maxLength={64}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                disabled={renaming}
                className="mr-2 bg-white text-black hover:bg-gray-100 border border-gray-200"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="default"
              disabled={renaming || renameValue.trim() === "" || renameValue.trim() === renameDialog?.name.trim()}
              onClick={async () => {
                if (renameDialog && renameValue.trim() && renameValue.trim() !== renameDialog.name.trim()) {
                  await renameWorkflow(renameDialog.id, renameValue)
                }
              }}
            >
              {renaming ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

