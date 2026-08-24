'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, Sparkles, Loader2, AlertTriangle } from 'lucide-react'

type Project = {
  id: string
  title: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  duration: number
  createdAt: string
  _count: { clips: number }
  clips: { viralScore: number }[]
}

const STATUS_LABEL: Record<Project['status'], string> = {
  PENDING: 'Queued',
  PROCESSING: 'Processing',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/projects')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load projects')
        const data = await r.json()
        setProjects(data.projects ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Library</p>
          <h1 className="display-md mt-2.5">Projects</h1>
        </div>
        <Link href="/dashboard/projects/new" className="btn-lux btn-gold !py-3">
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {error && (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      )}

      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-3 py-24 text-mist">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-light">Loading your library…</span>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* New project tile */}
          <Link
            href="/dashboard/projects/new"
            className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hair/60 text-mist transition-all hover:border-champagne hover:text-gold"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hair">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-light">Paste a link or upload</span>
          </Link>

          {projects.map((p) => {
            const best = p.clips[0]?.viralScore
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="glass-card group !p-0 transition-transform duration-300 hover:-translate-y-1"
              >
                {/* Thumbnail */}
                <div className="relative h-36 overflow-hidden rounded-t-[17px] bg-gradient-to-br from-emerald-deep/40 via-onyx-2 to-champagne/10">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full border border-pearl/50 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 ${p.status === 'PROCESSING' || p.status === 'PENDING' ? 'animate-pulse' : ''}`}>
                      {p.status === 'PROCESSING' || p.status === 'PENDING' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-champagne" />
                      ) : p.status === 'FAILED' ? (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-gold" />
                      )}
                    </span>
                  </div>
                  {best !== undefined && (
                    <span className="absolute right-3 top-3 font-display text-lg italic text-gold">{Math.round(best)}%</span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="truncate font-medium">{p.title}</h3>
                  <div className="mt-2.5 flex items-center justify-between text-xs font-light text-mist">
                    <span>
                      {p._count.clips} clips{p.duration > 0 ? ` · ${Math.round(p.duration / 60)} min` : ''}
                    </span>
                    <span>{fmtDate(p.createdAt)}</span>
                  </div>
                  <span
                    className={`mt-3 inline-block rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${
                      p.status === 'COMPLETED'
                        ? 'bg-emerald-deep/30 text-emerald-300'
                        : p.status === 'FAILED'
                          ? 'bg-red-400/15 text-red-300'
                          : p.status === 'PROCESSING' || p.status === 'PENDING'
                            ? 'bg-champagne/15 text-champagne'
                            : 'bg-pearl/5 text-mist'
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <p className="mt-10 rounded-2xl border border-dashed border-hair/50 px-6 py-16 text-center text-sm font-light text-mist">
          No projects yet — drop in your first long video and let NOLOGY find the moments worth posting.
        </p>
      )}
    </div>
  )
}
