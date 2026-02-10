'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Receipt, 
  Repeat, 
  PieChart, 
  Settings, 
  LogOut,
  Wallet,
  PlusCircle,
  Scan,
  CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Categories', href: '/categories', icon: Wallet },
  { name: 'Templates', href: '/templates', icon: Repeat },
  { name: 'Analytics', href: '/analytics', icon: PieChart },
  { name: 'Subscriptions', href: '/subscriptions', icon: CalendarDays },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-full w-64 flex-col bg-zinc-950 border-r border-zinc-800 text-zinc-400">
      <div className="flex h-20 items-center px-6 gap-3 border-b border-zinc-800">
        <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
          <Wallet className="w-6 h-6 text-emerald-400" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">Budgetify</span>
      </div>

      <div className="flex flex-1 flex-col gap-y-7 px-6 py-8">
        <nav className="flex flex-1 flex-col gap-y-7">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex gap-x-3 rounded-xl p-3 text-sm font-semibold leading-6 transition-all duration-200',
                        pathname === item.href
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            
            <li className="mt-auto">
              <Button
                variant="ghost"
                className="w-full justify-start gap-x-3 px-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                Logout
              </Button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
