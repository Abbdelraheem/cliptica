'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Loader2, AlertTriangle, Download, Sparkles,
  Captions, ScanFace, Clock, Flame, Clapperboard,
} from 'lucide-react'

type Clip = {
  id: string
  title: string
  description: string | null
  viralScore: number
  hookScore: number | null
  duration: number
  status: 'GENERATING' | 'READY' | 'FAILED'
  videoUrl: string | null
  exportUrl: string | null
  thumbnailUrl: string | null
  captionData: { mode?: string; emoji?: string } | null
  motionGraphics: { mode?: string; headline?: string; kicker?: string } | null
}

type Project = {
  id: string
  title: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  sourceUrl: string | null
  framing: string
  language: string
  instructions: string | null
  duration: number
  createdAt: string
  clips: Clip[]
  processingJobs: { status: string; progress: number; error: string | null }[]
}

const STAGE_COPY: Record<string, string> = {
  queued: 'Waiting for a worker slot…',
  processing: 'Transcribing → scoring moments → rendering clips…',
  completed: 'Done',
  failed: 'Processing failed',
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!projectId) return Promise.reject(new Error('No project id given'))
    return fetch(`/api/projects/${projectId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Project not found' : 'Failed to load project')
        const data = await r.json()
        setProject(data.project)
      })
      .catch((e) => setError(e.message))
  }, [projectId])

  useEffect(() => {
    load().finally(() => setLoading(false))
    // Live-refresh while the pipeline is working.
    const t = setInterval(() => {
      setProject((cur) => {
        if (cur && cur.status !== 'PENDING' && cur.status !== 'PROCESSING') return cur
        load()
        return cur
      })
    }, 10_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-mist">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-light">Loading project…</span>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-red-400" />
        <p className="mt-4 text-sm text-red-300">{error ?? 'Something went wrong'}</p>
        <Link href="/dashboard/projects" className="btn-lux btn-outline mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
      </div>
    )
  }

  const job = project.processingJobs[0]
  const working = project.status === 'PENDING' || project.status === 'PROCESSING'

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-xs font-light text-mist transition-colors hover:text-gold">
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Link>

      {/* Header */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Project</p>
          <h1 className="display-md mt-2.5 max-w-2xl">{project.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-light text-mist-2">
            <span className="flex items-center gap-1"><ScanFace className="h-3.5 w-3.5" /> {project.framing}</span>
            <span className="flex items-center gap-1"><Captions className="h-3.5 w-3.5" /> {project.language}</span>
            {project.duration > 0 && (
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {Math.round(project.duration / 60)} min</span>
            )}
            {project.sourceUrl && (
              <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-gold">source</a>
            )}
          </p>
        </div>
      </div>

      {/* Pipeline banner */}
      {(working || project.status === 'FAILED') && (
        <div
          className={`mt-8 rounded-2xl border px-6 py-5 ${
            project.status === 'FAILED'
              ? 'border-red-400/30 bg-red-400/10'
              : 'border-champagne/30 bg-champagne/5'
          }`}
        >
          {project.status === 'FAILED' ? (
            <>
              <p className="flex items-center gap-2 text-sm text-red-300">
                <AlertTriangle className="h-4 w-4" /> Processing failed.
              </p>
              {job?.error && <p className="mt-2 font-mono text-xs text-red-300/70">{job.error}</p>}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-light text-champagne">
                <Loader2 className="h-4 w-4 animate-spin" />
                {STAGE_COPY[job?.status ?? 'queued']}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-gold to-champagne transition-all duration-700"
                  style={{ width: `${Math.max(6, job?.progress ?? 0)}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Clips */}
      <h2 className="mt-12 mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-mist">
        <Flame className="h-4 w-4 text-gold" /> Clips ({project.clips.length})
      </h2>

      {project.clips.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hair/50 px-6 py-14 text-center text-sm font-light text-mist">
          {working ? 'Moments are being scored — clips appear here as they finish rendering.' : 'No clips yet.'}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {project.clips.map((c) => (
            <div key={c.id} className="glass-card group !p-0 overflow-hidden transition-transform duration-300 hover:-translate-y-1">
              <div className="relative aspect-[9/13] bg-black">
                {c.videoUrl ? (
                  <video src={c.videoUrl} poster={c.thumbnailUrl ?? undefined} controls preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  <div className={`absolute inset-0 flex items-center justify-center ${working ? 'animate-pulse' : ''}`}>
                    {c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnailUrl} alt={c.title} className="h-full w-full object-cover opacity-70" />
                    ) : (
                      <Sparkles className={`h-6 w-6 ${working ? 'animate-spin text-champagne' : 'text-mist-2'}`} />
                    )}
                  </div>
                )}
                <span className="absolute right-2.5 top-2.5 rounded-lg border border-gold/40 bg-black/70 px-2 py-0.5 font-display text-sm italic text-gold backdrop-blur">
                  {c.viralScore}%
                </span>
                {c.motionGraphics?.mode === 'ai-motion' && (
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-lg border border-champagne/40 bg-black/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-champagne backdrop-blur">
                    <Clapperboard className="h-3 w-3" /> AI motion
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="truncate text-sm font-medium">{c.title}</h3>
                <div className="mt-2 flex items-center justify-between text-xs font-light text-mist-2">
                  <span>{mmss(c.duration)}</span>
                  {c.hookScore != null && <span>hook {c.hookScore}</span>}
                </div>
                {(c.exportUrl || c.videoUrl) && (
                  <a
                    href={c.exportUrl ?? c.videoUrl ?? '#'}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="btn-lux btn-outline mt-3 w-full !py-2 !text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Download MP4
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
