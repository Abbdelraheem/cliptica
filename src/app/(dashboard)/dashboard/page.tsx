'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  FolderOpen,
  Megaphone,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

type ProjectSummary = {
  id: string
  title: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  duration: number
  createdAt: string
  _count: { clips: number }
  clips: { viralScore: number }[]
}

const STATUS_LABEL: Record<ProjectSummary['status'], string> = {
  PENDING: 'Queued',
  PROCESSING: 'Processing',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load data')
  return res.json()
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  const projectsQuery = useQuery({
    queryKey: ['projects', 'overview'],
    queryFn: () => getJson<{ projects: ProjectSummary[] }>('/api/projects'),
  })

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getJson<{ campaigns: { isActive: boolean }[] }>('/api/campaigns'),
  })

  const projects = projectsQuery.data?.projects ?? []
  const loading = projectsQuery.isLoading || campaignsQuery.isLoading
  const error = projectsQuery.error || campaignsQuery.error

  const stats = [
    {
      label: 'Projects',
      value: String(projects.length),
      icon: FolderOpen,
      href: '/dashboard/projects',
    },
    {
      label: 'Active campaigns',
      value: String((campaignsQuery.data?.campaigns ?? []).filter((c) => c.isActive).length),
      icon: Megaphone,
      href: '/dashboard/campaigns',
    },
    {
      label: 'Avg. viral score',
      value: (() => {
        const scores = projects.flatMap((p) => p.clips.map((c) => c.viralScore))
        if (scores.length === 0) return '—'
        return `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%`
      })(),
      icon: TrendingUp,
      href: '/dashboard/earnings',
    },
    {
      label: 'Minutes processed',
      value: String(Math.round(projects.reduce((a, p) => a + p.duration, 0) / 60)),
      icon: Clock,
      href: '/dashboard/projects',
    },
  ]

  const recent = projects.slice(0, 5)

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

      {error && (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load your overview. Please try again.
        </p>
      )}

      {/* Stats */}
      {loading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card !p-6">
              <div className="h-5 w-5 animate-pulse rounded bg-surface" />
              <div className="mt-5 h-9 w-20 animate-pulse rounded bg-surface" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
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
      )}

      {/* Recent projects */}
      <div className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Recent projects</h2>
          <Link href="/dashboard/projects" className="text-sm text-gold underline-offset-4 hover:underline">
            View all
          </Link>
        </div>

        {!loading && recent.length === 0 ? (
          <Link
            href="/dashboard/projects/new"
            className="block rounded-2xl border border-dashed border-hair/50 px-6 py-16 text-center text-sm font-light text-mist transition-colors hover:border-champagne hover:text-gold"
          >
            No projects yet — drop in your first long video and let NOLOGY find the moments worth posting.
          </Link>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
            {recent.map((p, i) => {
              const best = p.clips[0]?.viralScore
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/detail?id=${p.id}`}
                  className={`flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface ${
                    i > 0 ? 'border-t border-hair/30' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-xs font-light text-mist">{p._count.clips} clips · {fmtDate(p.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5">
                    {best !== undefined && (
                      <span className="font-display text-xl italic text-gold">{Math.round(best)}%</span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
                        p.status === 'COMPLETED'
                          ? 'bg-emerald-deep/30 text-emerald-300'
                          : p.status === 'PROCESSING' || p.status === 'PENDING'
                            ? 'bg-champagne/15 text-champagne'
                            : p.status === 'FAILED'
                              ? 'bg-red-400/15 text-red-300'
                              : 'bg-pearl/5 text-mist'
                      }`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                </Link>
              )
            })}
            {loading && (
              <div className="flex items-center justify-center gap-3 px-6 py-12 text-mist">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-light">Loading…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
