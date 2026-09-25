'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  X, Play, Pause, Scissors, Sparkles, Sliders, Type,
  Clock, Check, Loader2, Volume2, VolumeX, Eye, Flame
} from 'lucide-react'

export type ClipWord = {
  word: string
  start: number
  end: number
}

export type StudioEditorClip = {
  id: string
  title: string
  description?: string | null
  sourceStart: number
  sourceEnd: number
  duration: number
  videoUrl: string | null
  exportUrl?: string | null
  thumbnailUrl?: string | null
  captionStyle: string
  aspectRatio?: string
  captionData?: {
    mode?: string
    emoji?: string
    words?: ClipWord[]
    style?: string
  } | null
}

export type StudioEditorProps = {
  isOpen: boolean
  onClose: () => void
  clip: StudioEditorClip
  projectDuration: number
  onSave: (clipId: string, params: {
    start: number
    end: number
    captionStyle: string
    headline?: string
  }) => Promise<void>
}

const CAPTION_STYLES = [
  // ARABIC NATIVE
  { id: 'arabic_luxury', name: 'Arabic Luxury', category: 'Arabic Luxury', color: '#FFD700', sample: 'SECRET OF SUCCESS' },
  { id: 'arabic_viral', name: 'Arabic Viral', category: 'Arabic Luxury', color: '#FFFFFF', sample: 'WAIT FOR THIS!' },
  { id: 'arabic_clean', name: 'Arabic Clean', category: 'Arabic Luxury', color: '#FFFFFF', sample: 'WHAT NOBODY TELLS YOU' },
  // KINETIC
  { id: 'hormozi', name: 'Hormozi Pop', category: 'Kinetic', color: '#FFE600', sample: 'STOP SCROLLING' },
  { id: 'bold_impact', name: 'Bold Impact', category: 'Kinetic', color: '#FFD700', sample: 'MUST WATCH THIS' },
  { id: 'bounce_side', name: 'Side Bounce', category: 'Kinetic', color: '#FF5A1F', sample: 'FAST ACTION' },
  { id: 'pill_box', name: 'Pill Box', category: 'Kinetic', color: '#FFFFFF', sample: 'KEY TAKEAWAY' },
  { id: 'tiktok_classic', name: 'TikTok Big Word', category: 'Kinetic', color: '#FFFFFF', sample: 'VIRAL HOOK' },
  // EDITORIAL
  { id: 'clean_minimal', name: 'Clean Minimal', category: 'Editorial', color: '#F3F4F6', sample: 'The simplest ideas win' },
  { id: 'classic_subtitle', name: 'Classic Subtitle', category: 'Editorial', color: '#FFFFFF', sample: 'Cinema standard line' },
  { id: 'slow_fade', name: 'Slow Fade', category: 'Editorial', color: '#F8F0E8', sample: 'Thoughtful reflection' },
  { id: 'cinematic_caps', name: 'Cinematic Caps', category: 'Editorial', color: '#ECE8E8', sample: 'A NEW HORIZON' },
  { id: 'podcast_soft', name: 'Podcast Soft', category: 'Editorial', color: '#FFD8A0', sample: 'Warm conversational cadence' },
  // CREATIVE
  { id: 'neon_highlight', name: 'Neon Highlight', category: 'Creative', color: '#00FFFF', sample: 'ELECTRIC ENERGY' },
  { id: 'highlighter', name: 'Highlighter Marker', category: 'Creative', color: '#FFE600', sample: 'HIGHLIGHTED TRUTH' },
  { id: 'typewriter', name: 'Typewriter Matrix', category: 'Creative', color: '#50FF50', sample: 'system.execute()' },
  { id: 'two_tone', name: 'Two-Tone Cadence', category: 'Creative', color: '#FFD700', sample: 'GOLD & PEARL' },
  { id: 'glitch_flicker', name: 'Glitch Cyberpunk', category: 'Creative', color: '#FF0080', sample: 'GLITCH REALITY' },
] as const

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${ms}`
}

export default function StudioVideoEditor({
  isOpen,
  onClose,
  clip,
  projectDuration,
  onSave,
}: StudioEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Timing states
  const [start, setStart] = useState(clip.sourceStart ?? 0)
  const [end, setEnd] = useState(clip.sourceEnd ?? (clip.sourceStart ?? 0) + (clip.duration || 30))
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // Styling states
  const [captionStyle, setCaptionStyle] = useState(clip.captionStyle || 'hormozi')
  const [headline, setHeadline] = useState(clip.description || '')
  const [styleCategory, setStyleCategory] = useState<string>('All')
  const [activeTab, setActiveTab] = useState<'timeline' | 'subtitles' | 'style'>('timeline')

  // Execution states
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clipDuration = Math.max(0, end - start)
  const words: ClipWord[] = clip.captionData?.words ?? []

  // Sync initial state when clip opens
  useEffect(() => {
    if (isOpen) {
      setStart(clip.sourceStart ?? 0)
      setEnd(clip.sourceEnd ?? (clip.sourceStart ?? 0) + (clip.duration || 30))
      setCaptionStyle(clip.captionStyle || 'hormozi')
      setHeadline(clip.description || '')
      setError(null)
      setIsPlaying(false)
    }
  }, [isOpen, clip])

  // Playback control
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [isPlaying])

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)
  }

  const seekTo = (sec: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 9999, sec))
    setCurrentTime(sec)
  }

  // Nudge helpers
  const nudgeStart = (delta: number) => {
    setStart((prev) => {
      const next = Math.max(0, prev + delta)
      return next < end - 15 ? next : prev
    })
  }

  const nudgeEnd = (delta: number) => {
    setEnd((prev) => {
      const maxLimit = projectDuration > 0 ? projectDuration : 99999
      const next = Math.min(maxLimit, prev + delta)
      return next > start + 15 ? next : prev
    })
  }

  const handleSave = async () => {
    if (clipDuration < 15) {
      setError('Minimum clip duration is 15 seconds.')
      return
    }
    if (clipDuration > 60) {
      setError('Maximum clip duration is 60 seconds.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(clip.id, {
        start: Math.round(start),
        end: Math.round(end),
        captionStyle,
        headline: headline.trim() || undefined,
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save and update clip')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const filteredStyles = styleCategory === 'All'
    ? CAPTION_STYLES
    : CAPTION_STYLES.filter((s) => s.category === styleCategory)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-3 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-hair/80 bg-onyx-2 shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-hair/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-pearl flex items-center gap-2">
                <span>Studio Video Editor</span>
                <span className="rounded-full bg-gold/15 border border-gold/30 px-2 py-0.5 font-mono text-[10px] text-champagne">
                  PRO
                </span>
              </h2>
              <p className="text-xs text-mist truncate max-w-md">{clip.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-lux btn-gold !py-2 !px-5 text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Re-rendering…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Save & Re-render Clip</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-hair/60 p-2 text-mist hover:border-hair hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_420px]">
          {/* Left: Video Canvas & Multi-Track Scrubber */}
          <div className="flex flex-col border-b border-hair/40 lg:border-b-0 lg:border-r bg-black/60 p-4 md:p-6 justify-between overflow-y-auto">
            {/* Video Player Canvas */}
            <div className="relative mx-auto flex aspect-[9/14] max-h-[50vh] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-hair/60 bg-black shadow-2xl">
              {clip.videoUrl ? (
                <video
                  ref={videoRef}
                  src={clip.videoUrl}
                  controlsList="nodownload nofullscreen noplaybackrate"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="h-full w-full object-cover select-none"
                  muted={isMuted}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-mist">
                  <Eye className="h-8 w-8 text-mist-2 mb-2" />
                  <p className="text-xs">Video preview unavailable</p>
                </div>
              )}

              {/* Headline Banner Overlay Preview */}
              {headline && (
                <div className="absolute top-4 left-3 right-3 rounded-lg bg-black/85 border border-white/20 px-3 py-1.5 text-center text-xs font-bold text-white shadow-xl backdrop-blur-sm pointer-events-none">
                  {headline}
                </div>
              )}

              {/* Play Overlay Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/80 text-white shadow-2xl border border-white/20">
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
                </div>
              </button>

              {/* Duration Badge */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/80 px-2 py-1 font-mono text-[11px] text-white/90 backdrop-blur border border-white/10">
                <Clock className="h-3 w-3 text-gold" />
                <span>{formatSeconds(currentTime)}</span>
                <span className="text-mist">/</span>
                <span className="text-champagne font-semibold">{clipDuration}s</span>
              </div>
            </div>

            {/* Video Canvas Controls */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => seekTo(Math.max(0, currentTime - 5))}
                className="flex items-center gap-1 rounded-xl border border-hair/50 px-3 py-1.5 text-xs text-mist hover:text-white"
                title="Rewind 5 seconds"
              >
                -5s
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-black shadow-lg shadow-gold/20 hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => seekTo(currentTime + 5)}
                className="flex items-center gap-1 rounded-xl border border-hair/50 px-3 py-1.5 text-xs text-mist hover:text-white"
                title="Forward 5 seconds"
              >
                +5s
              </button>
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-hair/50 text-mist hover:text-white"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            {/* Multi-Track Timeline Scrubber & Trim Sliders */}
            <div className="mt-4 rounded-2xl border border-hair/60 bg-onyx-3 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-pearl flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-gold" />
                  <span>Timeline Trim Range</span>
                </span>
                <span className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
                  clipDuration >= 15 && clipDuration <= 120
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}>
                  Duration: {clipDuration}s (15s–120s)
                </span>
              </div>

              {/* Start & End Sliders */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-mist mb-1">
                    <span>Start Timestamp: <strong className="text-pearl font-mono">{formatSeconds(start)}</strong> ({start}s)</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => nudgeStart(-5)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">-5s</button>
                      <button type="button" onClick={() => nudgeStart(-1)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">-1s</button>
                      <button type="button" onClick={() => nudgeStart(1)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">+1s</button>
                      <button type="button" onClick={() => nudgeStart(5)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">+5s</button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, end - 15)}
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                    className="w-full accent-gold cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-mist mb-1">
                    <span>End Timestamp: <strong className="text-pearl font-mono">{formatSeconds(end)}</strong> ({end}s)</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => nudgeEnd(-5)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">-5s</button>
                      <button type="button" onClick={() => nudgeEnd(-1)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">-1s</button>
                      <button type="button" onClick={() => nudgeEnd(1)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">+1s</button>
                      <button type="button" onClick={() => nudgeEnd(5)} className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-mist hover:text-white">+5s</button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={start + 15}
                    max={projectDuration > 0 ? projectDuration : Math.max(end + 60, 180)}
                    value={end}
                    onChange={(e) => setEnd(Number(e.target.value))}
                    className="w-full accent-gold cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Tabbed Customization Panel */}
          <div className="flex flex-col bg-onyx-2 overflow-hidden">
            {/* Tab navigation */}
            <div className="flex border-b border-hair/50 p-2 gap-1.5">
              {[
                { id: 'timeline', label: 'Timeline & Hooks', icon: Sliders },
                { id: 'subtitles', label: 'Transcript Words', icon: Type },
                { id: 'style', label: '18 Captions Presets', icon: Sparkles },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-semibold transition-all ${
                    activeTab === t.id
                      ? 'bg-gold/15 text-gold border border-gold/30'
                      : 'text-mist hover:text-pearl hover:bg-white/5'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-mist mb-1.5">
                      Top Hook Banner / Headline Overlay
                    </label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Wait till the end 😱 or Secret Revealed!"
                      className="input-lux !text-xs !py-2.5"
                      maxLength={70}
                    />
                    <p className="mt-1 text-[11px] text-mist-2">
                      Renders a high-impact hook headline at the top of the vertical frame to boost first 3-second retention.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-hair/60 bg-black/40 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-pearl flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-gold" />
                      <span>Clip Intelligence</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-hair/40 bg-onyx-3 p-2.5">
                        <span className="text-mist-2 text-[10px] block">Start Point</span>
                        <span className="font-mono font-bold text-pearl">{formatSeconds(start)}</span>
                      </div>
                      <div className="rounded-xl border border-hair/40 bg-onyx-3 p-2.5">
                        <span className="text-mist-2 text-[10px] block">End Point</span>
                        <span className="font-mono font-bold text-pearl">{formatSeconds(end)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'subtitles' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-pearl">Transcript Word Scrubber</h4>
                    <span className="text-[11px] text-mist-2">{words.length} words found</span>
                  </div>
                  <p className="text-xs text-mist leading-relaxed">
                    Click any word below to jump the video preview immediately to that timestamp.
                  </p>

                  <div className="flex flex-wrap gap-1.5 max-h-[55vh] overflow-y-auto rounded-2xl border border-hair/50 bg-black/40 p-3">
                    {words.length === 0 ? (
                      <p className="py-8 text-center text-xs text-mist w-full">No word timing data available for this clip.</p>
                    ) : (
                      words.map((w, idx) => {
                        const isCurrent = currentTime >= w.start && currentTime <= w.end
                        const isInClip = w.start >= start && w.end <= end
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => seekTo(w.start)}
                            className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                              isCurrent
                                ? 'bg-gold text-black font-bold scale-105'
                                : isInClip
                                ? 'bg-white/10 text-pearl hover:bg-gold/20 hover:text-gold'
                                : 'bg-black/40 text-mist-2 opacity-50'
                            }`}
                            title={`${formatSeconds(w.start)} - ${formatSeconds(w.end)}`}
                          >
                            {w.word}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'style' && (
                <div className="space-y-4">
                  {/* Category switcher */}
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {['All', 'Arabic Luxury', 'Kinetic', 'Editorial', 'Creative'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setStyleCategory(cat)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                          styleCategory === cat
                            ? 'bg-gold text-black font-bold'
                            : 'bg-onyx-3 text-mist hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Preset list */}
                  <div className="grid gap-2 max-h-[52vh] overflow-y-auto pr-1">
                    {filteredStyles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCaptionStyle(s.id)}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          captionStyle === s.id
                            ? 'border-gold bg-gold/15 text-gold ring-1 ring-gold shadow-md'
                            : 'border-hair/50 bg-black/30 text-mist hover:border-hair hover:text-pearl'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-pearl block">{s.name}</span>
                          <span className="text-[11px] font-semibold mt-0.5 block" style={{ color: s.color }}>
                            {s.sample}
                          </span>
                        </div>
                        {captionStyle === s.id && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-black">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-hair/50 p-4 bg-onyx-3 flex items-center justify-between">
              <span className="text-xs text-mist">
                Selected style: <strong className="text-gold capitalize">{captionStyle.replace(/_/g, ' ')}</strong>
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-lux btn-gold !py-2 !px-6 text-xs font-bold flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Apply & Re-render</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
