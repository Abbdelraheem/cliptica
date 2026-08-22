'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  FolderOpen,
  Megaphone,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

const STATS = [
  { label: 'Projects', value: '26', icon: FolderOpen, href: '/dashboard/projects' },
  { label: 'Active campaigns', value: '4', icon: Megaphone, href: '/dashboard/campaigns' },
  { label: 'Avg. viral score', value: '78%', icon: TrendingUp, href: '/dashboard/earnings' },
  { label: 'Hours saved', value: '208', icon: Clock, href: '/dashboard/earnings' },
]

const RECENT = [
  { name: 'Podcast ep. 42 — growth tactics', clips: 9, score: 84, status: 'Ready' },
  { name: 'Webinar — pricing psychology', clips: 6, score: 71, status: 'Processing' },
  { name: 'Interview — founder story', clips: 12, score: 88, status: 'Ready' },
  { name: 'Keynote — product launch', clips: 7, score: 65, status: 'Queued' },
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-6xl">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">The atelier</p>
          <h1 className="display-md mt-2.5">
            Welcome back, <span className="italic-accent gold-text">{firstName}</span>
          </h1>
        </div>
        <Link href="/dashboard/projects/new" className="btn-lux btn-gold !py-3">
          <Sparkles className="h-4 w-4" />
          New project
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="glass-card group !p-6 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-gold" />
              <ArrowRight className="h-4 w-4 text-mist-2 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-5 font-display text-4xl font-semibold">{s.value}</p>
            <p className="mt-1 text-sm font-light text-mist">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent projects */}
      <div className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Recent projects</h2>
          <Link href="/dashboard/projects" className="text-sm text-gold underline-offset-4 hover:underline">
            View all
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
          {RECENT.map((p, i) => (
            <Link
              key={p.name}
              href="/dashboard/projects"
              className={`flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface ${
                i > 0 ? 'border-t border-hair/30' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs font-light text-mist">{p.clips} clips</p>
              </div>
              <div className="flex shrink-0 items-center gap-5">
                <span className="font-display text-xl italic text-gold">{p.score}%</span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
                    p.status === 'Ready'
                      ? 'bg-emerald-deep/30 text-emerald-300'
                      : p.status === 'Processing'
                        ? 'bg-champagne/15 text-champagne'
                        : 'bg-pearl/5 text-mist'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
