'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  AlertTriangle,
  Film,
  Layers,
  RotateCcw,
  Link2,
  BadgeDollarSign,
  Clock,
} from 'lucide-react'

type ProjectDetail = {
  id: string
  title: string
  status: string
  sourceType: string
  duration: number
  settings: Record<string, unknown> | null
  r2Key?: string | null
  error?: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name?: string | null; role: string }
  clips: {
    id: string
    title: string
    viralScore: number
    status: string
    duration: number
    createdAt: string
    _count: { campaignLinks: number; payouts: number }
  }[]
  processingJobs: {
    id: string
    type: string
    status: string
    progress: number
    error?: string | null
    attempts: number
    createdAt: string
    startedAt?: string | null
    completedAt?: string | null
  }[]
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'bg-emerald-deep/30 text-emerald-300',
  PROCESSING: 'bg-sky-400/15 text-sky-300',
  PENDING: 'bg-champagne/15 text-champagne',
  FAILED: 'bg-red-400/15 text-red-300',
  GENERATING: 'bg-sky-400/15 text-sky-300',
  EXPORTING: 'bg-champagne/15 text-champagne',
  READY: 'bg-emerald-deep/30 text-emerald-300',
  sold: 'bg-emerald-deep/30 text-emerald-300',
  available: 'bg-sky-400/15 text-sky-300',
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['admin-project', id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/projects/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ project: ProjectDetail }>
    },
  })

  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/projects/${id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error ?? 'Failed')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Project requeued')
      queryClient.invalidateQueries({ queryKey: ['admin-project', id] })
    },
    onError: (e) => toast.error(e.message),
  })

  const project = query.data?.project

  return (
    <div className="mx-auto max-w-7xl">
      <button
        onClick={() => router.push('/admin/projects')}
        className="flex items-center gap-2 text-sm text-mist transition-colors hover:text-pearl"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </button>

      {query.isError && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load this project.
        </p>
      )}

      {query.isLoading && (
        <div className="mt-6 space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card !p-6">
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      )}

      {project && (
        <>
          {/* Header */}
          <div className="mt-6 glass-card !p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-2xl font-semibold">{project.title}</h1>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${STATUS_COLOR[project.status] ?? 'bg-pearl/10 text-mist'}`}>
                    {project.status}
                  </span>
                </div>
                <p className="mt-1 text-sm font-light text-mist">
                  by{' '}
                  <button
                    onClick={() => router.push(`/admin/users/${project.user.id}`)}
                    className="font-medium text-gold hover:underline"
                  >
                    {project.user.name ?? project.user.email}
                  </button>{' '}
                  ({project.user.role})
                </p>
              </div>

              <div className="flex flex-col items-end gap-4 sm:flex-row sm:items-center">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-mist-2">Created</p>
                  <p className="text-sm font-light text-mist">{fmtDate(project.createdAt)}</p>
                </div>
                {['FAILED', 'PENDING'].includes(project.status) && (
                  <button
                    onClick={() => retryMutation.mutate()}
                    disabled={retryMutation.isPending}
                    className="btn-lux btn-gold flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {retryMutation.isPending ? 'Requeuing…' : 'Retry & requeue'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-hair/40 bg-surface/50 p-3">
                <Clock className="h-4 w-4 text-gold" />
                <p className="mt-2 font-display text-lg">{project.duration}s</p>
                <p className="text-[10px] uppercase tracking-widest text-mist-2">Source length</p>
              </div>
              <div className="rounded-xl border border-hair/40 bg-surface/50 p-3">
                <Film className="h-4 w-4 text-gold" />
                <p className="mt-2 font-display text-lg">{project.clips.length}</p>
                <p className="text-[10px] uppercase tracking-widest text-mist-2">Clips</p>
              </div>
              <div className="rounded-xl border border-hair/40 bg-surface/50 p-3">
                <Layers className="h-4 w-4 text-gold" />
                <p className="mt-2 font-display text-lg">{project.processingJobs.length}</p>
                <p className="text-[10px] uppercase tracking-widest text-mist-2">Jobs</p>
              </div>
              <div className="rounded-xl border border-hair/40 bg-surface/50 p-3">
                <Link2 className="h-4 w-4 text-gold" />
                <p className="mt-2 font-display text-lg">{project.sourceType}</p>
                <p className="text-[10px] uppercase tracking-widest text-mist-2">Source type</p>
              </div>
            </div>

            {project.error && (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-red-300">Project error</p>
                <p className="mt-1 font-mono text-xs text-red-300/90">{project.error}</p>
              </div>
            )}
            {project.r2Key && (
              <p className="mt-4 truncate font-mono text-xs text-mist-2">R2: {project.r2Key}</p>
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Jobs */}
            <section className="glass-card !p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Layers className="h-5 w-5 text-gold" /> Processing jobs
              </h2>
              <div className="mt-4 space-y-3">
                {project.processingJobs.map((j) => (
                  <div key={j.id} className="rounded-lg border border-hair/40 bg-surface/40 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-widest text-pearl">{j.type}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${STATUS_COLOR[j.status] ?? 'bg-pearl/10 text-mist'}`}>
                        {j.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-champagne to-gold transition-all"
                          style={{ width: `${j.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gold">{j.progress}%</span>
                    </div>
                    {j.error && (
                      <p className="mt-2 truncate font-mono text-[10px] text-red-300/90">⚠ {j.error}</p>
                    )}
                    <p className="mt-1.5 text-[10px] font-light text-mist-2">
                      {j.attempts} attempt{j.attempts !== 1 ? 's' : ''} · started {fmtDate(j.startedAt)} · done {fmtDate(j.completedAt)}
                    </p>
                  </div>
                ))}
                {project.processingJobs.length === 0 && <p className="text-sm font-light text-mist">No jobs yet.</p>}
              </div>
            </section>

            {/* Clips */}
            <section className="glass-card !p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Film className="h-5 w-5 text-gold" /> Clips
              </h2>
              <div className="mt-4 space-y-2">
                {project.clips.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-hair/40 bg-surface/40 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-[10px] uppercase tracking-widest text-mist-2">
                        {c.duration}s · {c._count.campaignLinks} links · {c._count.payouts} payouts
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${STATUS_COLOR[c.status] ?? 'bg-pearl/10 text-mist'}`}>
                        {c.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gold">
                        <BadgeDollarSign className="h-3 w-3" /> {c.viralScore}
                      </span>
                    </div>
                  </div>
                ))}
                {project.clips.length === 0 && <p className="text-sm font-light text-mist">No clips generated yet.</p>}
              </div>
            </section>
          </div>

          {/* Settings JSON */}
          <section className="mt-5 glass-card !p-6">
            <h2 className="font-display text-lg font-semibold">Project settings</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-hair/40 bg-surface/40 p-4 font-mono text-xs text-mist">
              {JSON.stringify(project.settings ?? {}, null, 2)}
            </pre>
          </section>
        </>
      )}
    </div>
  )
}