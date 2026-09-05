'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Gauge,
  Users,
  FolderKanban,
  Banknote,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
} from 'lucide-react'
import { Wordmark } from '@/components/logo'

const NAV_ITEMS = [
  { name: 'Overview', href: '/admin', icon: Gauge },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { name: 'Payouts', href: '/admin/payouts', icon: Banknote },
  { name: 'Payments', href: '/admin/payments', icon: Wallet },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen bg-onyx text-pearl">
      <div className="amb" aria-hidden="true" />

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-hair/50 bg-onyx-2/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <Wordmark size={26} />
          <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">
            Admin
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
          className="text-pearl"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-30 flex w-64 flex-col border-r border-hair/50 bg-onyx-2/80 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="hidden items-center gap-2.5 border-b border-hair/50 px-5 py-5 lg:flex">
          <Wordmark size={28} />
          <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 pt-20 lg:pt-3" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'border border-hair bg-gradient-to-r from-gold/15 to-transparent text-gold'
                    : 'border border-transparent text-mist hover:border-hair/50 hover:bg-surface hover:text-pearl'
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] transition-colors ${
                    active ? 'text-gold' : 'text-mist group-hover:text-gold'
                  }`}
                />
                {item.name}
                {active && <span className="ml-auto h-1.5 w-1.5 rotate-45 bg-gold" />}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-hair/50 p-3">
          <Link
            href="/dashboard"
            className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-mist transition-colors hover:bg-surface hover:text-pearl"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="mb-2 rounded-xl border border-hair/50 bg-surface px-3 py-2.5">
            <p className="truncate text-xs font-medium text-pearl">{session?.user?.email}</p>
            <p className="text-[10px] uppercase tracking-widest text-gold">Administrator</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-surface hover:text-pearl"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-[2] min-h-screen pb-24 lg:ml-64 lg:pb-0">
        <div className="px-5 pb-12 pt-20 sm:px-8 lg:px-10 lg:pt-10">{children}</div>
      </main>
    </div>
  )
}