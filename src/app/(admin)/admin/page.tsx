'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Users,
  FolderKanban,
  Film,
  DollarSign,
  CheckCircle2,
  Clock,
  MonitorSmartphone,
  Webhook,
  AlertTriangle,
} from 'lucide-react'

type Stats = {
  totals: {
    users: number
    projects: number
    clips: number
    campaigns: number
    payouts: number
    devices: number
    webhooks: number
  }
  revenue: { total: number; paid: number; approved: number; pending: number }
  credits: Record<string, number>
  breakdown: {
    usersByRole: { role: string; _count: { _all: number } }[]
    projectsByStatus: { status: string; _count: { _all: number } }[]
    clipsByStatus: { status: string; _count: { _all: number } }[]
  }
  trend: {
    signups: { day: string; total: number }[]
    projects: { day: string; total: number }[]
    clips: { day: string; total: number }[]
  }
  recent: {
    users: { id: string; email: string; name?: string | null; role: string; credits: number; createdAt: string }[]
    projects: {
      id: string
      title: string
      status: string
      user: { email: string; name?: string | null } | null
      _count: { clips: number; processingJobs: number }
      createdAt: string
    }[]
    clips: {
      id: string
      title: string
      viralScore: number
      status: string
      user: { email: string; name?: string | null } | null
      project: { title: string } | null
      createdAt: string
    }[]
  }
}

const PROJECT_STATUS: Record<string, string> = {
  PENDING: 'bg-champagne/15 text-champagne',
  PROCESSING: 'bg-sky-400/15 text-sky-300',
  COMPLETED: 'bg-emerald-deep/30 text-emerald-300',
  FAILED: 'bg-red-400/15 text-red-300',
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'bg-gold/20 text-gold',
  CLIPPER: 'bg-champagne/15 text-champagne',
  STUDIO: 'bg-sky-400/15 text-sky-300',
  FREE: 'bg-pearl/10 text-mist',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export default function AdminOverviewPage() {
  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to load stats')
      return res.json() as Promise<Stats>
    },
  })

  const stats = statsQuery.data
  const cards = [
    { label: 'Users', value: stats?.totals.users ?? 0, icon: Users },
    { label: 'Projects', value: stats?.totals.projects ?? 0, icon: FolderKanban },
    { label: 'Clips', value: stats?.totals.clips ?? 0, icon: Film },
    { label: 'Revenue (total)', value: stats ? fmtMoney(stats.revenue.total) : '—', icon: DollarSign },
    { label: 'Revenue (paid)', value: stats ? fmtMoney(stats.revenue.paid) : '—', icon: CheckCircle2 },
    { label: 'Revenue (pending)', value: stats ? fmtMoney(stats.revenue.pending) : '—', icon: Clock },
    { label: 'Devices', value: stats?.totals.devices ?? 0, icon: MonitorSmartphone },
    { label: 'Webhooks processed', value: stats?.totals.webhooks ?? 0, icon: Webhook },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">Command center</p>
        <h1 className="display-md mt-2.5">Admin overview</h1>
        <p className="mt-2 max-w-2xl text-sm font-light text-mist">
          Live platform telemetry — accounts, processing load, revenue exposure and recent activity.
        </p>
      </div>

      {statsQuery.isError && (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load admin stats. Please try again.
        </p>
      )}

      {/* Stat cards */}
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => {
          const card = cards[i]
          return (
            <div key={i} className="glass-card !p-5">
              {statsQuery.isLoading ? (
                <div className="h-5 w-5 animate-pulse rounded bg-surface" />
              ) : (
                <card.icon className="h-5 w-5 text-gold" />
              )}
              <p className="mt-5 pt-0 font-display text-2xl font-semibold">
                {statsQuery.isLoading ? (
                  <div className="h-8 w-20 animate-pulse rounded bg-surface" />
                ) : (
                  card.value
                )}
              </p>
              <p className="mt-1 text-xs font-light text-mist">{card.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {/* Breakdowns */}
        <section className="glass-card !p-6">
          <h2 className="font-display text-lg font-semibold">Users by role</h2>
          <div className="mt-4 space-y-2">
            {(stats?.breakdown.usersByRole ?? []).map((r) => (
              <div key={r.role} className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${ROLE_COLOR[r.role] ?? 'bg-pearl/10 text-mist'}`}>
                  {r.role}
                </span>
                <span className="text-sm font-medium">{r._count._all}</span>
              </div>
            ))}
            {stats && stats.breakdown.usersByRole.length === 0 && (
              <p className="text-sm font-light text-mist">No users yet.</p>
            )}
          </div>
          <h2 className="mt-7 font-display text-lg font-semibold">Credits issued</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(stats?.credits ?? {})
              .filter(([, v]) => v !== 0)
              .map(([t, v]) => (
                <div key={t} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize text-mist">{t}</span>
                  <span className="font-medium">{v >= 0 ? `+${v}` : v}</span>
                </div>
              ))}
          </div>
        </section>

        {/* Projects by status */}
        <section className="glass-card !p-6">
          <h2 className="font-display text-lg font-semibold">Projects by status</h2>
          <div className="mt-4 space-y-2">
            {(stats?.breakdown.projectsByStatus ?? []).map((r) => (
              <div key={r.status} className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${PROJECT_STATUS[r.status] ?? 'bg-pearl/10 text-mist'}`}>
                  {r.status}
                </span>
                <span className="text-sm font-medium">{r._count._all}</span>
              </div>
            ))}
          </div>
          <h2 className="mt-7 font-display text-lg font-semibold">Clips by status</h2>
          <div className="mt-4 space-y-2">
            {(stats?.breakdown.clipsByStatus ?? []).map((r) => (
              <div key={r.status} className="flex items-center justify-between gap-3">
                <span className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest bg-pearl/10 text-mist">
                  {r.status}
                </span>
                <span className="text-sm font-medium">{r._count._all}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 14-day trend */}
        <section className="glass-card !p-6">
          <h2 className="font-display text-lg font-semibold">Last 14 days</h2>
          {(['signups', 'projects', 'clips'] as const).map((k) => {
            const arr = stats?.trend?.[k] ?? []
            const max = Math.max(1, ...arr.map((d) => d.total))
            return (
              <div key={k} className="mt-4">
                <p className="mb-1.5 text-xs uppercase tracking-widest text-mist-2 capitalize">{k}</p>
                <div className="flex h-16 items-end gap-[2px]">
                  {arr.map((d) => (
                    <div key={d.day} className="group relative flex-1">
                      <div
                        className="w-full rounded-t-sm bg-gradient-to-t from-gold/40 to-gold/80 transition-all"
                        style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
                      />
                    </div>
                  ))}
                  {arr.length === 0 && <p className="text-sm font-light text-mist">No activity yet.</p>}
                </div>
              </div>
            )
          })}
        </section>
      </div>

      {/* Recent activity */}
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="glass-card !p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Newest accounts</h2>
            <Link href="/admin/users" className="text-xs font-medium text-gold hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-1">
            {(stats?.recent.users ?? []).map((u) => (
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-surface"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.email}</p>
                  <p className="text-xs text-mist">{u.name ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${ROLE_COLOR[u.role] ?? 'bg-pearl/10 text-mist'}`}>
                    {u.role}
                  </span>
                  <span className="text-xs font-light text-mist">{fmtDate(u.createdAt)}</span>
                </div>
              </Link>
            ))}
            {(stats?.recent.users ?? []).length === 0 && (
              <p className="text-sm font-light text-mist">No accounts yet.</p>
            )}
          </div>
        </section>

        <section className="glass-card !p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Newest projects</h2>
            <Link href="/admin/projects" className="text-xs font-medium text-gold hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-1">
            {(stats?.recent.projects ?? []).map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-mist">{p.user?.email ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-light text-mist">
                    {p._count.clips} clips · {p._count.processingJobs} jobs
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${PROJECT_STATUS[p.status]}`}>
                    {p.status}
                  </span>
                </div>
              </Link>
            ))}
            {(stats?.recent.projects ?? []).length === 0 && (
              <p className="text-sm font-light text-mist">No projects yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}