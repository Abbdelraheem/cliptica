'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Loader2, AlertTriangle, Download, Sparkles,
  Captions, ScanFace, Clock, Flame,
  Copy, Check, CheckCircle2, Share2, Scissors, Zap, Send, ExternalLink, X, Trash2,
} from 'lucide-react'
import { ConnectionSummary } from '@/lib/social/types'
import StudioVideoEditor from '@/components/studio-video-editor'
import { toast } from 'sonner'

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
  creditsUsed?: number
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
  // === ARABIC NATIVE ===
  { id: 'arabic_luxury', category: 'Arabic Luxury', name: 'Arabic Luxury (Royal Gold)' },
  { id: 'arabic_viral', category: 'Arabic Luxury', name: 'Arabic Viral (TikTok Kinetic)' },
  { id: 'arabic_clean', category: 'Arabic Luxury', name: 'Arabic Clean (Classic Subtitle)' },
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
  const [studioEditorClip, setStudioEditorClip] = useState<Clip | null>(null)

  const [editingClipId, setEditingClipId] = useState<string | null>(null)
  const [adjustState, setAdjustState] = useState<{ start: number; end: number; captionStyle: string }>({
    start: 0,
    end: 30,
    captionStyle: 'hormozi',
  })
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // Viral Export Kit Modal state
  const [exportKitClip, setExportKitClip] = useState<Clip | null>(null)
  const [copiedKitField, setCopiedKitField] = useState<string | null>(null)

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
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set())
  const [purging, setPurging] = useState(false)
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)

  // Initialize selected clips when project clips load
  useEffect(() => {
    if (project?.clips && project.clips.length > 0) {
      setSelectedClipIds((prev) => {
        if (prev.size === 0) {
          return new Set(project.clips.map((c) => c.id))
        }
        const valid = new Set<string>()
        project.clips.forEach((c) => {
          if (prev.has(c.id)) valid.add(c.id)
        })
        return valid.size > 0 ? valid : new Set(project.clips.map((c) => c.id))
      })
    }
  }, [project?.clips])

  const toggleSelectClip = (clipId: string) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev)
      if (next.has(clipId)) {
        next.delete(clipId)
      } else {
        next.add(clipId)
      }
      return next
    })
  }

  const handleSelectAllClips = () => {
    if (!project) return
    setSelectedClipIds(new Set(project.clips.map((c) => c.id)))
  }

  const handleDeselectAllClips = () => {
    setSelectedClipIds(new Set())
  }

  const handlePurgeUnselected = async () => {
    if (!project) return
    const total = project.clips.length
    const keepCount = selectedClipIds.size
    const deleteCount = total - keepCount

    if (keepCount === 0) {
      toast.error('Please select at least 1 clip to keep.')
      return
    }
    if (deleteCount <= 0) {
      toast.info('All clips are selected. To delete unwanted clips, unselect them first.')
      return
    }

    const alreadyPaid = project.creditsUsed ?? 1
    const additionalCost = Math.max(0, keepCount - alreadyPaid)

    const costDetails =
      additionalCost > 0
        ? `Keeping ${keepCount} final videos costs ${keepCount} credits (1 credit per final video).\nThis will deduct ${additionalCost} additional credit(s) from your balance.`
        : `Keeping ${keepCount} final video is covered by your initial project credit.`

    const msg = `Final Video Confirmation:\n\n• Final Videos Kept: ${keepCount}\n• Pricing: 1 credit per final video\n• ${costDetails}\n• Clips to Discard: ${deleteCount}\n\nProceed to save your selected videos and delete the rest?`
    if (!confirm(msg)) return

    setPurging(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/clips/purge-unselected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepClipIds: Array.from(selectedClipIds) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to purge unselected clips')

      setProject((cur) => {
        if (!cur) return cur
        return {
          ...cur,
          creditsUsed: data.totalCreditsUsed ?? keepCount,
          clips: cur.clips.filter((c) => selectedClipIds.has(c.id)),
        }
      })

      // Dispatch event to instantly update navbar credit counter
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('credits-updated'))
      }

      toast.success(
        `Success! Kept ${data.kept} final video(s) (1 credit each). ${
          data.creditsDeducted > 0 ? `Deducted ${data.creditsDeducted} additional credit(s).` : ''
        }`.trim()
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not purge unselected clips')
    } finally {
      setPurging(false)
    }
  }

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
    setPublishDesc(`${hook}\n\n#Shorts #Reels #Viral #Clipzila`)
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
    setStudioEditorClip(c)
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

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm('Are you sure you want to discard this clip?')) return
    try {
      const res = await fetch(`/api/projects/${projectId}/clips/${clipId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete clip')
      setProject((cur) => {
        if (!cur) return cur
        return {
          ...cur,
          clips: cur.clips.filter((c) => c.id !== clipId),
        }
      })
      toast.success('Clip deleted')
    } catch {
      toast.error('Could not delete clip')
    }
  }

  const handleDownload = async (c: Clip) => {
    if (c.exportUrl) {
      const link = document.createElement('a')
      link.href = c.exportUrl
      link.download = `${(c.title || 'clip').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')}.mp4`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }

    setDownloadingClipId(c.id)
    setDownloadProgress(10)
    toast.info('جاري تجهيز الماستر عالي الدقة HD...')

    try {
      let attempts = 0
      const maxAttempts = 40
      while (attempts < maxAttempts) {
        attempts++
        const res = await fetch(`/api/projects/${projectId}/clips/${c.id}/download`)
        if (!res.ok) throw new Error('Download request failed')
        const data = await res.json()
        if (data.ready && data.downloadUrl) {
          setProject((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              clips: prev.clips.map((clip) =>
                clip.id === c.id ? { ...clip, exportUrl: data.downloadUrl } : clip
              ),
            }
          })
          toast.success('تم تجهيز الفيديو بدقة HD! جاري التحميل...')
          const link = document.createElement('a')
          link.href = data.downloadUrl
          link.download = `${(c.title || 'clip').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')}.mp4`
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          return
        }
        if (typeof data.progress === 'number' && data.progress > 0) {
          setDownloadProgress(data.progress)
        } else {
          setDownloadProgress((prev) => Math.min(92, (prev || 15) + 6))
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      if (c.videoUrl) {
        toast.info('تم تحميل نسخة المعاينة')
        const link = document.createElement('a')
        link.href = c.videoUrl
        link.download = `${(c.title || 'clip').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')}.mp4`
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      console.error('HD download error:', err)
      if (c.videoUrl) {
        window.open(c.videoUrl, '_blank')
      } else {
        toast.error('فشل تجهيز التنزيل')
      }
    } finally {
      setDownloadingClipId(null)
      setDownloadProgress(null)
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
      <div className="mt-12 mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-mist">
          <Flame className="h-4 w-4 text-gold" /> Generated Clips ({project.clips.length})
        </h2>
      </div>

      {project.clips.length > 1 && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-onyx-2/95 p-4 shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Clip Curation & Selection</h4>
              <p className="text-xs text-mist-2">
                Choose 1 or more clips you like. Discard the rest with one click to keep your project clean.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-hair/80 bg-black/40 px-3 py-1.5 font-mono text-xs text-pearl flex items-center gap-1.5">
              <span>Final Videos:</span>
              <span className="font-bold text-gold">{selectedClipIds.size}</span>
              <span className="text-mist-2">({selectedClipIds.size} credit{selectedClipIds.size === 1 ? '' : 's'} — 1 credit each)</span>
            </span>

            {selectedClipIds.size > (project.creditsUsed ?? 1) && (
              <span className="rounded-lg bg-gold/15 border border-gold/40 px-2.5 py-1 text-[11px] font-medium text-champagne">
                +{selectedClipIds.size - (project.creditsUsed ?? 1)} credit(s) from balance
              </span>
            )}

            <button
              type="button"
              onClick={handleSelectAllClips}
              className="btn-lux btn-outline !py-1.5 !px-3 !text-xs !font-normal"
            >
              Select All
            </button>

            <button
              type="button"
              onClick={handleDeselectAllClips}
              className="btn-lux btn-outline !py-1.5 !px-3 !text-xs !font-normal text-mist-2 hover:text-white"
            >
              Clear
            </button>

            {selectedClipIds.size < project.clips.length && selectedClipIds.size > 0 && (
              <button
                type="button"
                onClick={handlePurgeUnselected}
                disabled={purging}
                className="btn-lux btn-gold !py-1.5 !px-3.5 !text-xs !font-semibold flex items-center gap-1.5 shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:scale-[1.02] transition-transform"
                title="Keep only the selected clips and permanently delete the unselected ones"
              >
                {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Keep Selected & Discard {project.clips.length - selectedClipIds.size} Remaining</span>
              </button>
            )}
          </div>
        </div>
      )}

      {project.clips.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hair/50 px-6 py-14 text-center text-sm font-light text-mist">
          {working ? 'Moments are being scored — clips appear here as they finish rendering.' : 'No clips yet.'}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {project.clips.map((c, _cIndex) => {
            const isSelectedToKeep = selectedClipIds.has(c.id)
            return (
            <div
              key={c.id}
              className={`glass-card group !p-0 overflow-hidden transition-all duration-300 ${
                isSelectedToKeep
                  ? 'border-2 border-gold shadow-[0_0_35px_rgba(212,175,55,0.25)] ring-1 ring-gold/60'
                  : 'border border-hair/50 opacity-80 hover:opacity-100 hover:-translate-y-1'
              }`}
            >
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
                  <video
                    src={c.videoUrl}
                    poster={c.thumbnailUrl ?? undefined}
                    controls
                    controlsList="nodownload nofullscreen noplaybackrate"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    preload="metadata"
                    className="h-full w-full object-cover select-none"
                  />
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
                {isSelectedToKeep ? (
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-lg border border-gold bg-black/90 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-gold backdrop-blur z-20 shadow-lg">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold" /> Selected to Keep
                  </span>
                ) : (
                  <span className="absolute left-2.5 top-2.5 rounded-lg border border-red-500/30 bg-black/75 px-2 py-0.5 font-mono text-[10px] text-red-300 backdrop-blur z-20">
                    Unselected (Will be deleted)
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
                  {/* Multi-Clip Selection Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleSelectClip(c.id)}
                    disabled={c.status === 'GENERATING'}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all ${
                      isSelectedToKeep
                        ? 'bg-gradient-to-r from-gold to-champagne text-black shadow-[0_0_15px_rgba(212,175,55,0.35)]'
                        : 'border border-hair/80 bg-white/5 text-mist hover:text-white hover:border-gold/50'
                    }`}
                  >
                    {isSelectedToKeep ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                        <span>Selected to Keep (مُختار للحفظ)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-mist-2" />
                        <span>Select to Keep (اختر للحفظ)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-mist-2">
                    {isSelectedToKeep ? '✓ Saved clip' : '⚠ Will be deleted if you discard unselected'}
                  </p>

                  {/* Primary Actions: Download HD & Viral Kit */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {(c.exportUrl || c.videoUrl) && (
                      isSelectedToKeep ? (
                        <button
                          type="button"
                          onClick={() => handleDownload(c)}
                          disabled={downloadingClipId === c.id}
                          className="btn-lux btn-gold !py-2 !px-3 !text-xs !font-bold flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.3)] min-h-[40px] disabled:opacity-75"
                          title="تنزيل الفيديو بدقة عالية (HD)"
                        >
                          {downloadingClipId === c.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-champagne shrink-0" />
                              <span className="truncate">HD {downloadProgress ? `${downloadProgress}%` : '...'}</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">تنزيل HD</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            toggleSelectClip(c.id)
                            toast.success('تم تحديد المقطع للحفظ وتأكيد اختياره — أصبح زر التنزيل متاحاً لك الآن!')
                          }}
                          className="btn-lux btn-outline !py-2 !px-2.5 !text-xs !font-medium flex items-center justify-center gap-1.5 text-mist hover:text-white border-hair/60 min-h-[40px]"
                          title="يجب تحديد المقطع للحفظ وتأكيد اختياره قبل التنزيل"
                        >
                          <Download className="h-3.5 w-3.5 text-gold/60 shrink-0" />
                          <span className="truncate">تنزيل (احفظ أولاً)</span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => setExportKitClip(c)}
                      disabled={c.status === 'GENERATING'}
                      className="btn-lux btn-outline !py-2 !px-2.5 !text-xs !font-medium flex items-center justify-center gap-1.5 text-gold border-gold/30 hover:!border-gold hover:bg-gold/10 min-h-[40px]"
                      title="Viral Social Kit (Hooks, Description, Hashtags & Best Times)"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-gold shrink-0" />
                      <span className="truncate">Viral Kit</span>
                    </button>
                  </div>

                  {/* Secondary Actions: Studio Editor, Direct Publish, Share Link, Discard */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => openAdjust(c)}
                      disabled={c.status === 'GENERATING'}
                      className={`btn-lux btn-outline flex-1 !py-1.5 !px-2 !text-xs !font-normal min-h-[38px] flex items-center justify-center gap-1 ${
                        editingClipId === c.id ? '!border-gold !text-gold' : ''
                      }`}
                      title="Adjust clip start/end timestamps and caption style"
                    >
                      <Scissors className="h-3.5 w-3.5 text-champagne shrink-0" />
                      <span className="truncate">{editingClipId === c.id ? 'Close' : 'Editor'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openPublishModal(c)}
                      disabled={c.status === 'GENERATING'}
                      className="btn-lux btn-outline flex-1 !py-1.5 !px-2 !text-xs !font-normal min-h-[38px] flex items-center justify-center gap-1 text-champagne hover:!border-champagne"
                      title="Direct publish clip to TikTok, YouTube Shorts, or Instagram Reels"
                    >
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Publish</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyVideoLink(c)}
                      className="btn-lux btn-outline !py-1.5 !px-2.5 !text-xs min-h-[38px] shrink-0"
                      title="Copy direct video stream link"
                    >
                      {copiedId === `link-${c.id}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="h-3.5 w-3.5 text-mist-2 hover:text-white" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClip(c.id)}
                      disabled={c.status === 'GENERATING'}
                      className="btn-lux btn-outline !py-1.5 !px-2.5 !text-xs !font-normal text-mist-2 hover:!border-red-400/50 hover:!text-red-400 min-h-[38px] shrink-0"
                      title="Discard / Delete this clip"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(c)}
                        disabled={downloadingClipId === c.id}
                        className="btn-lux btn-primary w-full !py-2 !text-xs !font-medium flex items-center justify-center gap-1.5"
                      >
                        {downloadingClipId === c.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Generating HD Master ({downloadProgress ? `${downloadProgress}%` : '...'})</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" /> Download HD 9:16 MP4
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openPublishModal(c)}
                        className="btn-lux btn-outline w-full !py-2 !text-xs !font-medium flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5 text-gold" />
                        <span>Direct Publish</span>
                        <span className="rounded-full bg-gold/15 text-champagne text-[10px] font-bold px-2 py-0.5 border border-gold/30">
                          Coming Soon
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )})}
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
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-pearl">
                    Publish to Social Media
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-champagne">
                      Coming Soon
                    </span>
                  </h3>
                  <p className="text-xs text-mist-2">Automated posting to TikTok, YouTube Shorts, and Reels is in final testing.</p>
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

      {/* Viral Social Export Kit Modal */}
      {exportKitClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl border border-gold/30 bg-onyx-2 p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setExportKitClip(null)}
              className="absolute right-5 top-5 rounded-full p-2 text-mist hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold">Viral Social Kit</span>
                <h3 className="font-display text-xl font-bold text-pearl mt-0.5">
                  Viral Social Export Kit
                </h3>
              </div>
            </div>

            <p className="mt-2 text-xs sm:text-sm text-mist font-light leading-relaxed">
              Everything you need to publish this clip to TikTok, Instagram Reels, and YouTube Shorts for maximum reach and engagement.
            </p>

            {(() => {
              const capData = (exportKitClip.captionData as Record<string, unknown>) || {}
              const titles: string[] = Array.isArray(capData.titleOptions) && capData.titleOptions.length
                ? (capData.titleOptions as string[])
                : [exportKitClip.title]
              const hashtags: string[] = Array.isArray(capData.hashtags) && capData.hashtags.length
                ? (capData.hashtags as string[])
                : ['#Shorts', '#Reels', '#TikTok', '#Viral', '#Trending', '#VideoOfTheDay', '#fyp', '#explore']
              const ctaText: string = typeof capData.cta === 'string' && capData.cta
                ? capData.cta
                : '💬 شاركنا رأيك في التعليقات — هل تتفق مع هذا الطرح؟\n🔥 تابع الحساب لمزيد من المقاطع اليومية!'
              const fullDesc = `${exportKitClip.description || exportKitClip.title}\n\n${ctaText}`

              return (
                <div className="mt-6 space-y-4">
                  {/* 1. Viral Title Options */}
                  <div className="rounded-2xl border border-hair/60 bg-black/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-champagne flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-gold" />
                        1. High-Impact Hook Titles ({titles.length} AI Variations)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {titles.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] p-2.5 border border-hair-soft hover:border-gold/40 transition-colors">
                          <span className="text-xs font-medium text-pearl leading-relaxed">
                            <strong className="text-gold mr-1.5">{idx + 1}.</strong> {t}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(t)
                              setCopiedKitField(`title-${idx}`)
                              setTimeout(() => setCopiedKitField(null), 2000)
                            }}
                            className="btn-lux btn-outline !py-1 !px-2 !text-[11px] shrink-0 inline-flex items-center gap-1 text-champagne"
                          >
                            {copiedKitField === `title-${idx}` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. SEO Video Description & CTA */}
                  <div className="rounded-2xl border border-hair/60 bg-black/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                        2. High-Retention Description & CTA
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fullDesc)
                          setCopiedKitField('desc')
                          setTimeout(() => setCopiedKitField(null), 2000)
                        }}
                        className="btn-lux btn-outline !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1 text-champagne"
                      >
                        {copiedKitField === 'desc' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Description</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-mist font-light whitespace-pre-line leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-hair-soft">
                      {fullDesc}
                    </p>
                  </div>

                  {/* 3. Trending & Niche Hashtags */}
                  <div className="rounded-2xl border border-hair/60 bg-black/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-champagne">
                        3. AI Targeted Hashtags
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const tagStr = hashtags.join(' ')
                          navigator.clipboard.writeText(tagStr)
                          setCopiedKitField('tags')
                          setTimeout(() => setCopiedKitField(null), 2000)
                        }}
                        className="btn-lux btn-outline !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1 text-champagne"
                      >
                        {copiedKitField === 'tags' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy All Hashtags</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {hashtags.map((tag) => (
                        <span key={tag} className="rounded-lg bg-gold/10 border border-gold/20 px-2 py-0.5 text-xs font-mono text-gold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 4. Best Posting Times */}
                  <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
                    <div className="flex items-center gap-2 mb-1 text-gold">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Optimal Posting Windows for Maximum Reach:
                      </span>
                    </div>
                    <p className="text-xs text-mist leading-relaxed mt-1">
                      • <strong>Evening Peak:</strong> Between 06:00 PM and 09:30 PM (Local Audience Time).
                      <br />
                      • <strong>Afternoon Window:</strong> Between 01:00 PM and 03:30 PM.
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Action Buttons */}
            <div className="mt-6 pt-4 border-t border-hair-soft flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const allBundle = `${exportKitClip.title}\n\n${exportKitClip.description || exportKitClip.title}\n\n💬 Drop your thoughts below!\n🔥 Follow for more clips daily\n\n#Shorts #Reels #TikTok #Viral #explore #fyp`
                  navigator.clipboard.writeText(allBundle)
                  setCopiedKitField('all')
                  setTimeout(() => setCopiedKitField(null), 2500)
                }}
                className="btn-lux btn-gold !py-2.5 !px-5 text-xs font-semibold inline-flex items-center gap-2"
              >
                {copiedKitField === 'all' ? (
                  <>
                    <Check className="h-4 w-4 text-black" />
                    <span>Bundle Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-black" />
                    <span>Copy Complete Bundle (Title + Desc + Tags)</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                {exportKitClip.videoUrl || exportKitClip.exportUrl ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(exportKitClip)}
                    disabled={downloadingClipId === exportKitClip.id}
                    className="btn-lux btn-outline !py-2.5 !px-4 text-xs inline-flex items-center gap-2"
                  >
                    {downloadingClipId === exportKitClip.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-champagne" />
                        <span>Generating HD ({downloadProgress ? `${downloadProgress}%` : '...'})</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 text-champagne" />
                        <span>Download HD MP4</span>
                      </>
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExportKitClip(null)}
                  className="btn-lux btn-outline !py-2.5 !px-4 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Studio Video Editor Modal */}
      {studioEditorClip && (
        <StudioVideoEditor
          isOpen={Boolean(studioEditorClip)}
          onClose={() => setStudioEditorClip(null)}
          clip={studioEditorClip}
          projectDuration={project.duration}
          onSave={async (clipId, params) => {
            const res = await fetch(`/api/projects/${projectId}/clips/${clipId}/adjust`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
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
            load()
          }}
        />
      )}
    </div>
  )
}
