'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

type ProjectRow = {
  id: string
  title: string
  status: string
  duration: number
  createdAt: string
  user: { email: string; name?: string | null }
  _count: { clips: number; processingJobs: number }
}

const STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'bg-emerald-deep/30 text-emerald-300',
  PROCESSING: 'bg-sky-400/15 text-sky-300',
  PENDING: 'bg-champagne/15 text-champagne',
  FAILED: 'bg-red-400/15 text-red-300',
}

export default function AdminProjectsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedQ, setDebouncedQ] = useState('')

  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  const query = useQuery({
    queryKey: ['admin-projects', debouncedQ, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (debouncedQ) params.set('q', debouncedQ)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/projects?${params}`)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ projects: ProjectRow[]; pagination: { page: number; totalPages: number } }>
    },
  })

  const projects = query.data?.projects ?? []

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">Content</p>
        <h1 className="display-md mt-2.5">Projects</h1>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by user email…"
            className="input-lux !pl-10"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="input-lux w-auto">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {query.isError && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load projects.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
        <div className="hidden grid-cols-[1fr_90px_60px_90px_110px] gap-4 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 md:grid">
          <span>Project</span>
          <span className="text-center">Status</span>
          <span className="text-center">Clips</span>
          <span className="text-center">Jobs</span>
          <span className="text-right">Created</span>
        </div>

        {query.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className={`px-6 py-4 ${i > 0 ? 'border-t border-hair/30' : ''}`}>
                <div className="h-4 w-full animate-pulse rounded bg-surface" />
              </div>
            ))
          : projects.map((p, i) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className={`grid grid-cols-2 items-center gap-4 px-6 py-4 transition-colors hover:bg-surface md:grid-cols-[1fr_90px_60px_90px_110px] ${
                  i > 0 ? 'border-t border-hair/30' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="truncate text-xs text-mist">{p.user.name ?? p.user.email}</p>
                </div>
                <span className={`mx-auto rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${STATUS_COLOR[p.status] ?? 'bg-pearl/10 text-mist'}`}>
                  {p.status}
                </span>
                <span className="text-center text-sm font-light text-mist">{p._count.clips}</span>
                <span className="text-center text-sm font-light text-mist">{p._count.processingJobs}</span>
                <span className="text-right text-xs font-light text-mist">
                  {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </Link>
            ))}
      </div>

      {projects.length === 0 && !query.isLoading && (
        <p className="mt-8 rounded-2xl border border-dashed border-hair/50 px-6 py-12 text-center text-sm font-light text-mist">
          No projects match your filters.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-mist">
        <span>Page {query.data?.pagination.page ?? 1} of {Math.max(1, query.data?.pagination.totalPages ?? 1)}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= (query.data?.pagination.totalPages ?? 1)}
            className="flex items-center gap-1 rounded-lg border border-hair/50 px-2.5 py-1.5 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}