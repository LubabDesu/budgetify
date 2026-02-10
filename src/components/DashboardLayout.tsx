import { Sidebar } from '@/components/Sidebar'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
      <Toaster theme="dark" position="top-right" />
    </div>
  )
}
