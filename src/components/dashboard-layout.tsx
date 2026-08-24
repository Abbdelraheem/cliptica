'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  FolderOpen,
  Megaphone,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Wordmark } from '@/components/logo'
import { getDeviceId } from '@/lib/fingerprint'

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderOpen },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { name: 'Earnings', href: '/dashboard/earnings', icon: BarChart3 },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const deviceChecked = useRef(false)

  // One-account-per-device enforcement — runs on every dashboard entry.
  // Catches OAuth (Google/GitHub) accounts that bypassed the form flows.
  useEffect(() => {
    if (deviceChecked.current) return
    deviceChecked.current = true
    let cancelled = false
    ;(async () => {
      try {
        const deviceId = await getDeviceId()
        const res = await fetch('/api/device/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        })
        if (!cancelled && res.status === 403) {
          await signOut({ callbackUrl: '/login?error=DeviceConflict' })
        }
      } catch {
        /* offline preview / static export — skip silently */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen bg-onyx text-pearl">
      {/* Ambient */}
      <div className="amb" aria-hidden="true" />

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-hair/50 bg-onyx-2/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Wordmark size={26} />
        </Link>
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
        <div className="hidden items-center border-b border-hair/50 px-5 py-5 lg:flex">
          <Link href="/dashboard" aria-label="NOLOGY dashboard">
            <Wordmark size={30} />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 pt-20 lg:pt-3" aria-label="Dashboard navigation">
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
                    ? 'border border-hair bg-gradient-to-r from-champagne/15 to-transparent text-gold'
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
          <div className="mb-3 rounded-xl border border-hair/50 bg-surface p-3">
            <p className="text-xs uppercase tracking-widest text-mist-2">Credits</p>
            <p className="font-display text-2xl font-semibold text-gold">
              {session?.user?.credits ?? 0}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-pearl/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-champagne transition-all"
                style={{ width: `${Math.min(100, ((session?.user?.credits ?? 0) / 1200) * 100)}%` }}
              />
            </div>
          </div>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-surface hover:text-pearl">
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
