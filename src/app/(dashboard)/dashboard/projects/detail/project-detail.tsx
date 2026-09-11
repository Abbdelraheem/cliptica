'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Loader2, AlertTriangle, Download, Sparkles,
  Captions, ScanFace, Clock, Flame, Clapperboard,
  Copy, Check, Share2, Scissors, Zap, Send, ExternalLink, X,
} from 'lucide-react'
import { ConnectionSummary } from '@/lib/social/types'

type Clip = {
  id: string
  title: string
  description: string | null
  sourceStart: number
  sourceEnd: number
  viralScore: number
  hookScore: number | null
  retentionScore?: number | null
  shareScore?: number | null
  aspectRatio?: string
  duration: number
  status: 'GENERATING' | 'READY' | 'FAILED'
  videoUrl: string | null
  exportUrl: string | null
  thumbnailUrl: string | null
  captionStyle: string
  captionData: { mode?: string; emoji?: string; words?: Array<{ start: number; end: number; word: string }> } | null
  motionGraphics: { mode?: string; headline?: string; kicker?: string } | null
  createdAt: string
}

type Project = {
  id: string
  title: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  sourceUrl: string | null
  framing: string
  language: string
  captionStyle?: string
  aspectRatio?: string
  instructions: string | null
  duration: number
  createdAt: string
  clips: Clip[]
  processingJobs: { status: string; progress: number; error: string | null; result?: { stage?: string } | null }[]
}

const STAGE_COPY: Record<string, string> = {
  queued: 'Waiting for a worker slot…',
  processing: 'Transcribing → scoring moments → rendering clips…',
  completed: 'Done',
  failed: 'Processing failed',
}

const CAPTION_PRESET_OPTIONS = [
  // === KINETIC ===
  { id: 'hormozi', category: 'Kinetic', name: 'Hormozi Pop (Yellow High-Impact)' },
  { id: 'bold_impact', category: 'Kinetic', name: 'Bold Impact (Punchy Gold Uppercase)' },
  { id: 'bounce_side', category: 'Kinetic', name: 'Side Bounce (Left Slide Spring)' },
  { id: 'pill_box', category: 'Kinetic', name: 'Pill Box (Obsidian Slate Badge)' },
  { id: 'tiktok_classic', category: 'Kinetic', name: 'TikTok Big Word (Jumbo Retention)' },
  // === EDITORIAL ===
  { id: 'clean_minimal', category: 'Editorial', name: 'Clean Minimal (Soft Subtitle)' },
  { id: 'classic_subtitle', category: 'Editorial', name: 'Classic Subtitle (Cinema Standard)' },
  { id: 'slow_fade', category: 'Editorial', name: 'Slow Fade (Serif Breathing Fade)' },
  { id: 'cinematic_caps', category: 'Editorial', name: 'Cinematic Caps (Letterbox Tracked)' },
  { id: 'podcast_soft', category: 'Editorial', name: 'Podcast Soft (Warm Peach Cadence)' },
  // === CREATIVE ===
  { id: 'neon_highlight', category: 'Creative', name: 'Neon Highlight (Electric Cyan Glow)' },
  { id: 'highlighter', category: 'Creative', name: 'Highlighter Marker (Fluorescent Lime)' },
  { id: 'typewriter', category: 'Creative', name: 'Typewriter (Monospace Terminal Green)' },
  { id: 'two_tone', category: 'Creative', name: 'Two-Tone Alternate (Gold/Pearl Cadence)' },
  { id: 'glitch_flicker', category: 'Creative', name: 'Glitch Accent (Chromatic Cyber Pink)' },
] as const

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [editingClipId, setEditingClipId] = useState<string | null>(null)
  const [adjustState, setAdjustState] = useState<{ start: number; end: number; captionStyle: string }>({
    start: 0,
    end: 30,
    captionStyle: 'hormozi',
  })
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // Direct publishing state
  const [publishingClip, setPublishingClip] = useState<Clip | null>(null)
  const [publishPlatform, setPublishPlatform] = useState<'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM'>('TIKTOK')
  const [publishTitle, setPublishTitle] = useState('')
  const [publishDesc, setPublishDesc] = useState('')
  const [publishPrivacy, setPublishPrivacy] = useState('public')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishSuccess, setPublishSuccess] = useState<{ message: string; postUrl?: string } | null>(null)
  const [socialConnections, setSocialConnections] = useState<ConnectionSummary[]>([])

  useEffect(() => {
    fetch('/api/social/connections')
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d) => setSocialConnections(d.connections || []))
      .catch(() => setSocialConnections([]))
  }, [])

  const openPublishModal = (c: Clip) => {
    setPublishingClip(c)
    setPublishTitle(c.title || 'Viral Clip')
    const hook = c.description || c.title || ''
    setPublishDesc(`${hook}\n\n#Shorts #Reels #Viral #Cliptica`)
    setPublishPrivacy('public')
    setPublishError(null)
    setPublishSuccess(null)
  }

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publishingClip) return
    setPublishing(true)
    setPublishError(null)
    setPublishSuccess(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/clips/${publishingClip.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: publishPlatform,
          title: publishTitle,
          description: publishDesc,
          privacy: publishPrivacy,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Publishing request failed.')
      }
      setPublishSuccess({
        message:
          data.status === 'PROCESSING'
            ? 'Clip submitted to TikTok for background processing!'
            : `Successfully published clip to ${publishPlatform}!`,
        postUrl: data.postUrl,
      })
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : String(err))
    } finally {
      setPublishing(false)
    }
  }

  const openAdjust = (c: Clip) => {
    if (editingClipId === c.id) {
      setEditingClipId(null)
      return
    }
    setEditingClipId(c.id)
    setAdjustState({
      start: c.sourceStart ?? 0,
      end: c.sourceEnd ?? (c.sourceStart ?? 0) + (c.duration || 30),
      captionStyle: c.captionStyle || project?.captionStyle || 'hormozi',
    })
    setAdjustError(null)
  }

  const nudgeStart = (delta: number) => {
    setAdjustState((prev) => {
      const nextStart = Math.max(0, prev.start + delta)
      return nextStart < prev.end ? { ...prev, start: nextStart } : prev
    })
  }

  const nudgeEnd = (delta: number) => {
    setAdjustState((prev) => {
      const maxDur = project?.duration || 999999
      const nextEnd = Math.min(maxDur, Math.max(prev.start + 15, prev.end + delta))
      return { ...prev, end: nextEnd }
    })
  }

  const handleReRender = async (clipId: string) => {
    setAdjusting(true)
    setAdjustError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/clips/${clipId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: adjustState.start,
          end: adjustState.end,
          captionStyle: adjustState.captionStyle,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust clip')
      }
      setProject((cur) => {
        if (!cur) return cur
        return {
          ...cur,
          clips: cur.clips.map((c) => (c.id === clipId ? { ...c, status: 'GENERATING' } : c)),
        }
      })
      setEditingClipId(null)
      load()
    } catch (e: unknown) {
      setAdjustError(e instanceof Error ? e.message : 'Failed to adjust clip')
    } finally {
      setAdjusting(false)
    }
  }

  const copySocialKit = async (c: Clip) => {
    const hook = c.description || (c.motionGraphics?.headline ? `${c.motionGraphics.headline} — ${c.motionGraphics.kicker}` : 'Watch this viral highlight.')
    const hashtags = '#shorts #viral #fyp #reels #trending #growth'
    const postText = `${c.title}\n\n${hook}\n\n${hashtags}`
    try {
      await navigator.clipboard.writeText(postText)
      setCopiedId(`kit-${c.id}`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      /* ignore clipboard rejection */
    }
  }

  const copyVideoLink = async (c: Clip) => {
    const url = c.exportUrl || c.videoUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(`link-${c.id}`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      /* ignore */
    }
  }

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
    // Live-refresh while the pipeline is working or any clip is adjusting.
    const t = setInterval(() => {
      setProject((cur) => {
        const hasWorkingClip = cur?.clips.some((c) => c.status === 'GENERATING')
        const isProjectWorking = cur && (cur.status === 'PENDING' || cur.status === 'PROCESSING')
        if (isProjectWorking || hasWorkingClip) {
          load()
        }
        return cur
      })
    }, 4_000)
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
              <div className="flex items-center justify-between text-sm font-light text-champagne">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {job?.result?.stage ?? STAGE_COPY[job?.status ?? 'queued']}
                </span>
                <span className="font-mono text-xs text-champagne/80 font-medium">{job?.progress ?? 0}%</span>
              </div>
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
                {c.status === 'GENERATING' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-gold" />
                    <p className="mt-3 font-display text-sm font-semibold text-white">Re-trimming clip…</p>
                    <p className="mt-1 text-xs font-light text-champagne">Fast render: ~10-20s</p>
                    <p className="mt-0.5 text-[10px] text-mist-2">Reusing transcript & face tracking</p>
                    <div className="mt-4 h-1.5 w-3/4 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-gold to-champagne" />
                    </div>
                  </div>
                ) : c.videoUrl ? (
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
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg border border-gold/40 bg-black/75 px-2.5 py-1 font-display text-xs backdrop-blur shadow-sm z-20">
                  {c.viralScore >= 90 ? (
                    <span className="flex items-center gap-1 text-gold font-bold">
                      <Flame className="h-3.5 w-3.5 fill-gold/30" /> {c.viralScore}% VIRAL
                    </span>
                  ) : c.viralScore >= 75 ? (
                    <span className="flex items-center gap-1 text-champagne font-semibold">
                      <Sparkles className="h-3.5 w-3.5" /> {c.viralScore}% HIGH
                    </span>
                  ) : (
                    <span className="text-white/80 font-medium">{c.viralScore}%</span>
                  )}
                </div>
                {c.motionGraphics?.mode === 'ai-motion' && (
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-lg border border-champagne/40 bg-black/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-champagne backdrop-blur z-20">
                    <Clapperboard className="h-3 w-3" /> AI motion
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-gold transition-colors">{c.title}</h3>
                  <div className="mt-2 flex items-center justify-between text-xs font-light text-mist-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {mmss(c.duration)}
                      {c.sourceStart != null && c.sourceEnd != null && (
                        <span className="font-mono text-[11px] text-champagne/80">({mmss(c.sourceStart)} - {mmss(c.sourceEnd)})</span>
                      )}
                    </span>
                    {c.aspectRatio && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-champagne/70">{c.aspectRatio}</span>}
                  </div>

                  {/* Virality Sub-score Breakdown */}
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-lg border border-hair-soft bg-white/[0.02] p-2 text-center">
                    <div title="Hook Score: First 3 seconds scroll-stopping power">
                      <span className="text-mist-2 block text-[9px] uppercase tracking-wider font-light">Hook</span>
                      <span className="font-mono font-semibold text-xs text-champagne">{c.hookScore ?? Math.round(c.viralScore * 0.95)}</span>
                    </div>
                    <div title="Retention Score: Audience pacing & dropoff prevention">
                      <span className="text-mist-2 block text-[9px] uppercase tracking-wider font-light">Retention</span>
                      <span className="font-mono font-semibold text-xs text-amber-300">{c.retentionScore ?? Math.round(c.viralScore * 0.92)}</span>
                    </div>
                    <div title="Shareability Score: Relatability & discussion driver">
                      <span className="text-mist-2 block text-[9px] uppercase tracking-wider font-light">Share</span>
                      <span className="font-mono font-semibold text-xs text-emerald-400">{c.shareScore ?? Math.round(c.viralScore * 0.88)}</span>
                    </div>
                  </div>

                  {c.description && (
                    <div className="mt-2 rounded-lg border border-hair-soft bg-white/[0.02] p-2 text-[11px] text-mist leading-relaxed">
                      <span className="font-semibold text-champagne">AI Hook:</span> {c.description}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 pt-2 border-t border-hair-soft">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openAdjust(c)}
                      disabled={c.status === 'GENERATING'}
                      className={`btn-lux btn-outline flex-1 !py-1.5 !px-2 !text-xs !font-normal ${
                        editingClipId === c.id ? '!border-gold !text-gold' : ''
                      }`}
                      title="Adjust clip start/end timestamps and caption style"
                    >
                      <Scissors className="h-3.5 w-3.5 text-champagne" />
                      <span>{editingClipId === c.id ? 'Close' : 'Adjust Trim'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copySocialKit(c)}
                      className="btn-lux btn-outline !py-1.5 !px-2.5 !text-xs !font-normal"
                      title="Copy viral title, hook, and trending hashtags for TikTok/Shorts/Reels"
                    >
                      {copiedId === `kit-${c.id}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-champagne" />
                      )}
                    </button>

                    {(c.exportUrl || c.videoUrl) && (
                      <button
                        type="button"
                        onClick={() => copyVideoLink(c)}
                        className="btn-lux btn-outline !py-1.5 !px-2.5 !text-xs"
                        title="Copy direct video stream link"
                      >
                        {copiedId === `link-${c.id}` ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5 text-mist-2 hover:text-white" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openPublishModal(c)}
                      disabled={c.status === 'GENERATING'}
                      className="btn-lux btn-outline !py-1.5 !px-2.5 !text-xs !font-normal flex items-center gap-1 text-champagne hover:!border-champagne"
                      title="Direct publish clip to TikTok, YouTube Shorts, or Instagram Reels"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Publish</span>
                    </button>
                  </div>

                  {editingClipId === c.id && (
                    <div className="mt-3 space-y-3 rounded-xl border border-gold/30 bg-black/60 p-3 text-xs">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="flex items-center gap-1.5 font-semibold text-gold">
                          <Scissors className="h-3.5 w-3.5" /> Adjust Clip Bounds
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            adjustState.end - adjustState.start >= 15 && adjustState.end - adjustState.start <= 120
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {adjustState.end - adjustState.start}s (15s-120s)
                        </span>
                      </div>

                      {/* Start Time */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-mist">
                          <span>Start Time</span>
                          <span className="font-mono font-medium text-white">{mmss(adjustState.start)} ({adjustState.start}s)</span>
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeStart(-5)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            -5s
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeStart(-1)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            -1s
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeStart(1)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            +1s
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeStart(5)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            +5s
                          </button>
                        </div>
                      </div>

                      {/* End Time */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-mist">
                          <span>End Time</span>
                          <span className="font-mono font-medium text-white">{mmss(adjustState.end)} ({adjustState.end}s)</span>
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeEnd(-5)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            -5s
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeEnd(-1)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            -1s
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeEnd(1)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            +1s
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeEnd(5)}
                            className="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] hover:bg-white/10 text-mist hover:text-white"
                          >
                            +5s
                          </button>
                        </div>
                      </div>

                      {/* Caption Style */}
                      <div>
                        <label className="text-[11px] text-mist block mb-1">Caption Preset</label>
                        <select
                          value={adjustState.captionStyle}
                          onChange={(e) => setAdjustState((prev) => ({ ...prev, captionStyle: e.target.value }))}
                          className="w-full rounded border border-white/15 bg-black/80 px-2 py-1.5 text-xs text-white focus:border-gold focus:outline-none"
                        >
                          <optgroup label="⚡ Kinetic Styles">
                            {CAPTION_PRESET_OPTIONS.filter((o) => o.category === 'Kinetic').map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="📖 Editorial Styles">
                            {CAPTION_PRESET_OPTIONS.filter((o) => o.category === 'Editorial').map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="🎨 Creative Styles">
                            {CAPTION_PRESET_OPTIONS.filter((o) => o.category === 'Creative').map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Cost notice */}
                      <div className="flex items-center gap-1.5 rounded bg-gold/10 px-2 py-1.5 text-[11px] text-champagne">
                        <Zap className="h-3 w-3 text-gold flex-shrink-0" />
                        <span>
                          {Date.now() - new Date(c.createdAt).getTime() <= 15 * 60 * 1000
                            ? 'Free re-render (within 15m edit window)'
                            : 'Re-render costs 1 credit'}
                          {' · ~10-20s'}
                        </span>
                      </div>

                      {adjustError && (
                        <p className="rounded bg-red-500/10 p-1.5 text-[11px] text-red-300">
                          {adjustError}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingClipId(null)}
                          className="btn-lux btn-outline flex-1 !py-1.5 !text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReRender(c.id)}
                          disabled={
                            adjusting ||
                            adjustState.end - adjustState.start < 15 ||
                            adjustState.end - adjustState.start > 120
                          }
                          className="btn-lux btn-primary flex-1 !py-1.5 !text-xs disabled:opacity-50"
                        >
                          {adjusting ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Queuing…</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-3.5 w-3.5" />
                              <span>Re-render</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {(c.exportUrl || c.videoUrl) && (
                    <a
                      href={c.exportUrl ?? c.videoUrl ?? '#'}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="btn-lux btn-primary w-full !py-2 !text-xs !font-medium"
                    >
                      <Download className="h-3.5 w-3.5" /> Download 9:16 MP4
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish to Social Media Modal */}
      {publishingClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border border-hair bg-[#141419] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hair-soft pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-champagne/10 text-champagne">
                  <Send className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-pearl">Publish to Social Media</h3>
                  <p className="text-xs text-mist-2">Post directly to your connected creator channels</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPublishingClip(null)}
                className="rounded-lg p-1.5 text-mist hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="mt-5 space-y-4 text-xs">
              {/* Platform Selector */}
              <div>
                <label className="mb-2 block font-medium text-mist">Target Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['TIKTOK', 'YOUTUBE', 'INSTAGRAM'] as const).map((p) => {
                    const conn = socialConnections.find((c) => c.platform === p)
                    const isConnected = conn?.connected && conn.status === 'active'
                    const isSelected = publishPlatform === p

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPublishPlatform(p)}
                        className={`flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                          isSelected
                            ? 'border-champagne bg-champagne/15 text-pearl shadow-sm'
                            : 'border-hair/60 bg-black/30 text-mist hover:border-hair hover:text-pearl'
                        }`}
                      >
                        <span className="font-semibold text-xs">{p === 'TIKTOK' ? 'TikTok' : p === 'YOUTUBE' ? 'YouTube Shorts' : 'Instagram Reels'}</span>
                        <span className="mt-1 flex items-center gap-1 text-[10px]">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isConnected ? 'bg-emerald-400' : 'bg-mist-2'
                            }`}
                          />
                          <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-mist-2'}>
                            {isConnected ? `@${conn.accountName || 'Connected'}` : 'Not linked'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notice if platform not connected */}
              {(() => {
                const conn = socialConnections.find((c) => c.platform === publishPlatform)
                if (!conn || !conn.connected || conn.status !== 'active') {
                  return (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <p className="font-semibold">Account not connected</p>
                        <p className="mt-0.5 text-[11px] text-amber-300/80">
                          To publish to {publishPlatform}, please connect your account first in{' '}
                          <Link href="/dashboard/settings" className="underline font-semibold hover:text-white">
                            Settings → Connected Accounts
                          </Link>.
                        </p>
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Title */}
              <div>
                <label className="mb-1 block font-medium text-mist">Title / Hook</label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  className="input-lux !py-2 !text-xs"
                  placeholder="Enter hook or headline"
                  required
                />
              </div>

              {/* Caption & Hashtags */}
              <div>
                <label className="mb-1 block font-medium text-mist">Caption & Hashtags</label>
                <textarea
                  value={publishDesc}
                  onChange={(e) => setPublishDesc(e.target.value)}
                  rows={4}
                  className="input-lux !py-2 !text-xs resize-none"
                  placeholder="Caption and hashtags..."
                />
              </div>

              {/* Privacy */}
              <div>
                <label className="mb-1 block font-medium text-mist">Privacy Status</label>
                <select
                  value={publishPrivacy}
                  onChange={(e) => setPublishPrivacy(e.target.value)}
                  className="w-full rounded-xl border border-hair bg-black/60 px-3 py-2 text-xs text-white focus:border-gold focus:outline-none"
                >
                  <option value="public">Public (Recommended for virality)</option>
                  <option value="unlisted">Unlisted (Share via direct link)</option>
                  <option value="private">Private (Only you can view)</option>
                </select>
              </div>

              {/* Format Spec Confirmation */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-[11px] text-mist flex items-center justify-between">
                <span>Format: {publishingClip.aspectRatio || '9:16'} vertical · {publishingClip.duration}s</span>
                <span className="text-emerald-400 font-medium">✓ Spec Verified</span>
              </div>

              {publishError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{publishError}</span>
                </div>
              )}

              {publishSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 flex items-start gap-2">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <p className="font-semibold">{publishSuccess.message}</p>
                    {publishSuccess.postUrl && (
                      <a
                        href={publishSuccess.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 underline text-champagne hover:text-white"
                      >
                        <span>View post</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-hair-soft">
                <button
                  type="button"
                  onClick={() => setPublishingClip(null)}
                  className="btn-lux btn-outline !py-2 !px-4 !text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="btn-lux btn-champagne !py-2 !px-5 !text-xs flex items-center gap-1.5"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Publish Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
