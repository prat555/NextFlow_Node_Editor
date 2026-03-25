import { DashboardSidebar } from "@/components/dashboard/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <DashboardSidebar />
      <main className="pl-60 min-h-screen bg-[#0d0d0d]">
        {children}
      </main>
    </div>
  )
}
