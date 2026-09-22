'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Radio, Plus, Trash2, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, Youtube, Pause, Play, Lock, Sparkles
} from 'lucide-react'

type AutoPilotChannel = {
  id: string
  channelUrl: string
  channelTitle: string | null
  lastCheckedAt: string | null
  lastVideoId: string | null
  isActive: boolean
  clipsPerVideo: number
  captionStyle: string
  framing: string
  aspectRatio: string
  createdAt: string
}

const CAPTION_OPTIONS = [
  { id: 'arabic_luxury', name: 'Arabic Luxury (Royal Gold)' },
  { id: 'arabic_viral', name: 'Arabic Viral (TikTok Kinetic)' },
  { id: 'hormozi', name: 'Hormozi Pop (Yellow Punch)' },
  { id: 'bold_impact', name: 'Bold Impact (Punchy Gold)' },
  { id: 'clean_minimal', name: 'Clean Minimal (Soft Subtitle)' },
]

const FRAMING_OPTIONS = [
  { id: 'smart', name: 'Smart Face Tracking' },
  { id: 'split', name: 'Podcast Split Screen' },
  { id: 'blur', name: 'Blurred Backdrop' },
]

export default function AutoPilotPage() {
  const { data: session, status } = useSession()
  const [channels, setChannels] = useState<AutoPilotChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [channelUrl, setChannelUrl] = useState('')
  const [channelTitle, setChannelTitle] = useState('')
  const [captionStyle, setCaptionStyle] = useState('arabic_luxury')
  const [framing, setFraming] = useState('smart')
  const [userRole, setUserRole] = useState<string | null>(null)

  const fetchChannels = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/user/autopilot')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
      }
    } catch {
      setError('Failed to load Auto-Pilot channels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChannels()
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.role) setUserRole(d.user.role)
      })
      .catch(() => {})
  }, [])

  const sessionRole = (session?.user as { role?: string })?.role
  const effectiveRole = sessionRole || userRole || (status === 'loading' ? null : 'FREE')
  const isStudioOrAdmin = effectiveRole === 'STUDIO' || effectiveRole === 'ADMIN'

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelUrl.trim()) return
    setAdding(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/user/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl: channelUrl.trim(),
          channelTitle: channelTitle.trim() || undefined,
          captionStyle,
          framing,
          aspectRatio: '9:16',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add channel')
      }

      setSuccess('Channel added successfully! Auto-Pilot is now monitoring for new uploads.')
      setChannelUrl('')
      setChannelTitle('')
      fetchChannels()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this channel from Auto-Pilot?')) return
    try {
      const res = await fetch(`/api/user/autopilot?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {
      alert('Failed to remove channel')
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/user/autopilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: id, isActive: !currentActive }),
      })
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: !currentActive } : c))
        )
      } else {
        const d = await res.json()
        alert(d.error || 'Failed to update channel status')
      }
    } catch {
      alert('Failed to update channel status')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gold">
            <Radio className="h-4 w-4 animate-pulse text-gold" />
            <span>Autonomous Ingestion Engine</span>
          </div>
          <h1 className="display-md mt-2">Auto-Pilot Channel Ingestion</h1>
          <p className="mt-1 text-sm font-light text-mist max-w-2xl leading-relaxed">
            Connect your favorite YouTube channels or your own. Whenever a new video drops, our automated processing pipeline ingests it, transcribes, and renders 3–6 viral clips ready to post!
          </p>
        </div>
      </div>

      {/* Studio Tier Locked Banner if not Studio or Admin */}
      {effectiveRole !== null && !isStudioOrAdmin ? (
        <div className="mt-8 rounded-3xl border border-gold/40 bg-gradient-to-b from-onyx-2 via-black/80 to-onyx-2 p-8 shadow-[0_0_50px_rgba(212,175,55,0.12)] text-center relative overflow-hidden">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 border border-gold/30 text-gold mb-4 shadow-lg">
            <Lock className="h-6 w-6 text-gold" />
          </div>
          <span className="inline-block rounded-full bg-gold/10 border border-gold/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-champagne">
            Exclusive Studio Tier Feature ($59/mo)
          </span>
          <h2 className="display-md mt-3 text-2xl font-bold">Autonomous Auto-Pilot Ingestion</h2>
          <p className="mt-2 text-sm font-light text-mist max-w-xl mx-auto leading-relaxed">
            Continuous channel ingestion, automated transcription, and hands-free viral clip rendering are exclusive to <span className="font-semibold text-pearl">Studio ($59/mo)</span> and Administrator accounts. Connect your YouTube channels and our AI pipeline will instantly convert any newly published video into ready-to-post Shorts and Reels with zero manual work!
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/dashboard/billing"
              className="btn-lux btn-gold !py-3 !px-8 text-sm font-bold inline-flex items-center gap-2 shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform"
            >
              <Sparkles className="h-4 w-4" />
              <span>Upgrade Account to Studio ($59/mo)</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Add New Channel Form */
        <div className="mt-8 rounded-3xl border border-hair/60 bg-onyx-2 p-6 md:p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Youtube className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-pearl">
              Add Channel for Automated Monitoring
            </h2>
          </div>

        <form onSubmit={handleAdd} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">
                YouTube Channel URL or @handle
              </label>
              <input
                type="text"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://youtube.com/@ChannelName"
                required
                className="input-lux !py-2.5 !text-xs font-mono"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">
                Channel Display Name (Optional)
              </label>
              <input
                type="text"
                value={channelTitle}
                onChange={(e) => setChannelTitle(e.target.value)}
                placeholder="e.g. My Favorite Podcast"
                className="input-lux !py-2.5 !text-xs"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">
                Default Caption Preset
              </label>
              <select
                value={captionStyle}
                onChange={(e) => setCaptionStyle(e.target.value)}
                className="w-full rounded-xl border border-hair bg-black/60 px-3 py-2.5 text-xs text-pearl focus:border-gold focus:outline-none"
              >
                {CAPTION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">
                Framing Mode
              </label>
              <select
                value={framing}
                onChange={(e) => setFraming(e.target.value)}
                className="w-full rounded-xl border border-hair bg-black/60 px-3 py-2.5 text-xs text-pearl focus:border-gold focus:outline-none"
              >
                {FRAMING_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={adding}
              className="btn-lux btn-gold !py-2.5 !px-6 text-xs font-semibold inline-flex items-center gap-2"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span>Adding Channel…</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-black" />
                  <span>Enable Auto-Pilot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Active Watchlist */}
      <div className="mt-12">
        <h2 className="font-display text-xl font-bold text-pearl">
          Monitored Channels ({channels.length})
        </h2>

        {loading ? (
          <div className="mt-6 flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : channels.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-hair/50 bg-black/20 p-12 text-center">
            <Radio className="mx-auto h-8 w-8 text-mist opacity-50" />
            <p className="mt-3 text-sm font-light text-mist">
              No channels added yet. Enter a YouTube channel URL above to start autonomous ingestion.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hair/50 bg-onyx-2 p-5 transition-all hover:border-gold/30"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    ch.isActive ? 'bg-gold/10 text-gold border-gold/20' : 'bg-onyx-3 text-mist/60 border-hair/40'
                  }`}>
                    <Radio className={`h-5 w-5 ${ch.isActive ? 'animate-pulse' : 'opacity-40'}`} />
                    <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-black ${
                      ch.isActive ? 'bg-emerald-500' : 'bg-amber-500/80'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-pearl">
                        {ch.channelTitle || 'YouTube Channel'}
                      </h3>
                      {ch.isActive ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                          Paused
                        </span>
                      )}
                    </div>
                    <a
                      href={ch.channelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-mono text-mist hover:text-white"
                    >
                      <span>{ch.channelUrl}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-mist">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-mist-2">Style & Framing</p>
                    <p className="font-medium text-champagne mt-0.5">
                      {ch.captionStyle} · {ch.framing}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-mist-2">Last Checked</p>
                    <p className="font-medium text-pearl mt-0.5">
                      {ch.lastCheckedAt ? new Date(ch.lastCheckedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(ch.id, ch.isActive)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                        ch.isActive
                          ? 'border-hair/40 bg-black/40 text-mist hover:border-amber-400/40 hover:text-amber-400'
                          : 'border-gold/30 bg-gold/10 text-champagne hover:bg-gold/20'
                      }`}
                      title={ch.isActive ? 'Pause monitoring' : 'Resume monitoring'}
                    >
                      {ch.isActive ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>Resume</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ch.id)}
                      className="rounded-xl border border-hair/40 bg-black/40 p-2 text-mist hover:border-red-400/40 hover:text-red-400"
                      title="Remove from Auto-Pilot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
