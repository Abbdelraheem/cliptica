'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, ClipboardList, DollarSign, Settings, LogOut, CreditCard, Sparkles, BarChart2 } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/dashboard/projects', icon: ClipboardList },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: DollarSign },
  { name: 'Earnings', href: '/dashboard/earnings', icon: BarChart2 },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card transition-all duration-300">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-foreground">Cliptica</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                  <AvatarFallback className="text-xs">
                    {session?.user?.name?.[0] || session?.user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left truncate">
                  <p className="font-medium text-foreground truncate">{session?.user?.name || 'User'}</p>
                  <p className="text-xs truncate">{session?.user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{session?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex w-full items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/billing" className="flex w-full items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}