'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import {
  X, Play, Pause, Sparkles, Sliders, Type,
  Clock, Check, Loader2, Volume2, VolumeX, Eye,
  Layers, RotateCcw, SkipBack, SkipForward, Shield,
  Maximize2, Film, Wand2, Trash2, Edit3, Search,
} from 'lucide-react'

export type ClipWord = {
  word?: string
  text?: string
  start: number
  end: number
}

export type NormalizedWord = {
  id: number
  text: string
  start: number // absolute source timestamp (seconds)
  end: number   // absolute source timestamp (seconds)
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
    aspectRatio?: string
    framing?: string
  } | null
}

export type StudioEditorSaveParams = {
  start: number
  end: number
  captionStyle: string
  aspectRatio?: '9:16' | '1:1' | '16:9'
  framing?: string
  title?: string
  words?: Array<{ start: number; end: number; text: string }>
}

export type StudioEditorProps = {
  isOpen: boolean
  onClose: () => void
  clip: StudioEditorClip
  projectDuration: number
  projectFraming?: string
  projectAspectRatio?: string
  onSave: (clipId: string, params: StudioEditorSaveParams) => Promise<void>
}

const CAPTION_STYLES = [
  // ARABIC NATIVE
  { id: 'arabic_luxury', name: 'Arabic Luxury', category: 'Arabic Luxury', color: '#FFD700', activeBg: 'rgba(0,0,0,0.65)', uppercase: false, wordsPerCard: 3, sample: 'THE SECRET OF SUCCESS' },
  { id: 'arabic_viral', name: 'Arabic Viral', category: 'Arabic Luxury', color: '#FFE600', activeBg: 'rgba(0,0,0,0.65)', uppercase: false, wordsPerCard: 2, sample: 'WAIT FOR THIS!' },
  { id: 'arabic_clean', name: 'Arabic Clean', category: 'Arabic Luxury', color: '#FFFFFF', activeBg: 'rgba(15,15,20,0.78)', uppercase: false, wordsPerCard: 4, sample: 'WHAT NOBODY TELLS YOU' },
  // KINETIC
  { id: 'hormozi', name: 'Hormozi Pop', category: 'Kinetic', color: '#FFE600', activeBg: 'rgba(0,0,0,0.6)', uppercase: true, wordsPerCard: 3, sample: 'STOP SCROLLING' },
  { id: 'bold_impact', name: 'Bold Impact', category: 'Kinetic', color: '#FFD700', activeBg: 'rgba(0,0,0,0.65)', uppercase: true, wordsPerCard: 2, sample: 'MUST WATCH THIS' },
  { id: 'bounce_side', name: 'Side Bounce', category: 'Kinetic', color: '#FF5A1F', activeBg: 'rgba(0,0,0,0.6)', uppercase: true, wordsPerCard: 3, sample: 'FAST ACTION' },
  { id: 'pill_box', name: 'Pill Box', category: 'Kinetic', color: '#FFFFFF', activeBg: 'rgba(20,20,28,0.9)', uppercase: true, wordsPerCard: 3, sample: 'KEY TAKEAWAY' },
  { id: 'tiktok_classic', name: 'TikTok Big Word', category: 'Kinetic', color: '#FFE600', activeBg: 'rgba(0,0,0,0.7)', uppercase: true, wordsPerCard: 2, sample: 'VIRAL HOOK' },
  // EDITORIAL
  { id: 'clean_minimal', name: 'Clean Minimal', category: 'Editorial', color: '#F3F4F6', activeBg: 'rgba(0,0,0,0.55)', uppercase: false, wordsPerCard: 5, sample: 'The simplest ideas win' },
  { id: 'classic_subtitle', name: 'Classic Subtitle', category: 'Editorial', color: '#FFFFFF', activeBg: 'rgba(0,0,0,0.75)', uppercase: false, wordsPerCard: 6, sample: 'Cinema standard line' },
  { id: 'slow_fade', name: 'Slow Fade', category: 'Editorial', color: '#F8F0E8', activeBg: 'rgba(0,0,0,0.55)', uppercase: false, wordsPerCard: 5, sample: 'Thoughtful reflection' },
  { id: 'cinematic_caps', name: 'Cinematic Caps', category: 'Editorial', color: '#ECE8E8', activeBg: 'rgba(0,0,0,0.7)', uppercase: true, wordsPerCard: 4, sample: 'A NEW HORIZON' },
  { id: 'podcast_soft', name: 'Podcast Soft', category: 'Editorial', color: '#FFD8A0', activeBg: 'rgba(0,0,0,0.65)', uppercase: false, wordsPerCard: 4, sample: 'Warm conversational cadence' },
  // CREATIVE
  { id: 'neon_highlight', name: 'Neon Highlight', category: 'Creative', color: '#00FFFF', activeBg: 'rgba(0,20,35,0.8)', uppercase: true, wordsPerCard: 3, sample: 'ELECTRIC ENERGY' },
  { id: 'highlighter', name: 'Highlighter Marker', category: 'Creative', color: '#111111', activeBg: '#FFE600', uppercase: true, wordsPerCard: 3, sample: 'HIGHLIGHTED TRUTH' },
  { id: 'typewriter', name: 'Typewriter Matrix', category: 'Creative', color: '#50FF50', activeBg: 'rgba(5,15,5,0.85)', uppercase: false, wordsPerCard: 4, sample: 'system.execute()' },
  { id: 'two_tone', name: 'Two-Tone Cadence', category: 'Creative', color: '#FFD700', activeBg: 'rgba(0,0,0,0.65)', uppercase: true, wordsPerCard: 2, sample: 'GOLD & PEARL' },
  { id: 'glitch_flicker', name: 'Glitch Cyberpunk', category: 'Creative', color: '#FF0080', activeBg: 'rgba(15,0,20,0.8)', uppercase: true, wordsPerCard: 2, sample: 'GLITCH REALITY' },
] as const

const FRAMING_OPTIONS = [
  { id: 'smart', name: 'Smart AI Face Track', desc: 'InsightFace active speaker tracking' },
  { id: 'split', name: '2-Speaker Podcast Split', desc: 'Top/bottom vertical dual speaker stack' },
  { id: 'gaming', name: 'Gaming Facecam Split', desc: 'Top 35% facecam + Bottom 65% gameplay' },
  { id: 'blur', name: 'Cinema Blur Backdrop', desc: 'Full frame over soft Gaussian blur' },
  { id: 'letter', name: 'Studio Letterbox', desc: 'Full widescreen on obsidian matte' },
  { id: 'center', name: 'Locked Center Crop', desc: 'Steady center vertical cut' },
] as const

const COLOR_GRADES = [
  { id: 'none', name: 'Original', filter: 'none' },
  { id: 'cinema', name: 'Cinema Contrast', filter: 'contrast(1.12) saturate(1.15) brightness(1.02)' },
  { id: 'gold', name: 'Warm Champagne', filter: 'contrast(1.08) sepia(0.14) saturate(1.2)' },
  { id: 'vivid', name: 'Viral Pop', filter: 'contrast(1.15) saturate(1.32)' },
  { id: 'noir', name: 'Crisp Noir', filter: 'grayscale(0.85) contrast(1.25)' },
] as const

function formatSeconds(sec: number): string {
  const safe = Math.max(0, sec)
  const m = Math.floor(safe / 60)
  const s = Math.floor(safe % 60)
  const ms = Math.floor((safe % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${ms}`
}

export default function StudioVideoEditor({
  isOpen,
  onClose,
  clip,
  projectDuration,
  projectFraming = 'smart',
  projectAspectRatio = '9:16',
  onSave,
}: StudioEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const baseSourceStart = clip.sourceStart ?? 0
  const baseSourceEnd = clip.sourceEnd ?? baseSourceStart + (clip.duration || 30)

  // Editable NLE States
  const [title, setTitle] = useState(clip.title || 'Viral Clip')
  const [start, setStart] = useState(baseSourceStart)
  const [end, setEnd] = useState(Math.min(baseSourceStart + 60, baseSourceEnd))
  const [currentTime, setCurrentTime] = useState(0) // relative video time (0 .. clip.duration)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<number>(1)

  // Composition & Styling States
  const [captionStyle, setCaptionStyle] = useState(clip.captionStyle || 'hormozi')
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>(
    (clip.captionData?.aspectRatio as '9:16' | '1:1' | '16:9') ||
      (clip.aspectRatio as '9:16' | '1:1' | '16:9') ||
      (projectAspectRatio as '9:16' | '1:1' | '16:9') ||
      '9:16'
  )
  const [framing, setFraming] = useState<string>(clip.captionData?.framing || projectFraming || 'smart')
  const [colorGrade, setColorGrade] = useState<string>('none')
  const [showLiveOverlay, setShowLiveOverlay] = useState<boolean>(true)
  const [showSafeZones, setShowSafeZones] = useState<boolean>(false)
  const [styleCategory, setStyleCategory] = useState<string>('All')
  const [activeTab, setActiveTab] = useState<'subtitles' | 'style' | 'framing'>('subtitles')

  // Editable Transcript Words
  const [editableWords, setEditableWords] = useState<NormalizedWord[]>([])
  const [editingWordId, setEditingWordId] = useState<number | null>(null)
  const [wordSearch, setWordSearch] = useState('')

  // Execution states
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clipDuration = Math.max(0, Math.round(end - start))

  // Initialize normalized words & states when modal opens
  useEffect(() => {
    if (isOpen) {
      const s0 = clip.sourceStart ?? 0
      const e0 = Math.min(s0 + 60, clip.sourceEnd ?? s0 + (clip.duration || 30))
      setTitle(clip.title || 'Viral Clip')
      setStart(s0)
      setEnd(e0)
      setCaptionStyle(clip.captionStyle || 'hormozi')
      setAspectRatio(
        (clip.captionData?.aspectRatio as '9:16' | '1:1' | '16:9') ||
          (clip.aspectRatio as '9:16' | '1:1' | '16:9') ||
          (projectAspectRatio as '9:16' | '1:1' | '16:9') ||
          '9:16'
      )
      setFraming(clip.captionData?.framing || projectFraming || 'smart')
      setError(null)
      setIsPlaying(false)
      setCurrentTime(0)
      setEditingWordId(null)

      const rawWords = clip.captionData?.words ?? []
      const normalized: NormalizedWord[] = rawWords
        .map((w, idx) => ({
          id: idx,
          text: String(w.text ?? w.word ?? '').trim(),
          start: Number(w.start ?? 0),
          end: Number(w.end ?? 0),
        }))
        .filter((w) => w.text.length > 0)
      setEditableWords(normalized)
    }
  }, [isOpen, clip, projectAspectRatio, projectFraming])

  // Absolute playhead position in source video seconds
  const currentSourceTime = baseSourceStart + currentTime

  // Group words into Remotion-style karaoke cards (2-5 words per card) matching worker/caption-styles.mjs
  const activeStylePreset = useMemo(
    () => CAPTION_STYLES.find((s) => s.id === captionStyle) ?? CAPTION_STYLES[0],
    [captionStyle]
  )

  const captionCards = useMemo(() => {
    const inWin = editableWords.filter((w) => w.end > start && w.start < end && w.text.trim().length > 0)
    const cards: Array<{ id: number; start: number; end: number; words: NormalizedWord[] }> = []
    let cur: NormalizedWord[] = []
    for (const w of inWin) {
      if (cur.length > 0 && w.start - cur[cur.length - 1].end > 0.6) {
        cards.push({
          id: cards.length,
          start: cur[0].start,
          end: cur[cur.length - 1].end,
          words: cur,
        })
        cur = []
      }
      cur.push(w)
      if (cur.length >= activeStylePreset.wordsPerCard) {
        cards.push({
          id: cards.length,
          start: cur[0].start,
          end: cur[cur.length - 1].end,
          words: cur,
        })
        cur = []
      }
    }
    if (cur.length > 0) {
      cards.push({
        id: cards.length,
        start: cur[0].start,
        end: cur[cur.length - 1].end,
        words: cur,
      })
    }
    return cards
  }, [editableWords, start, end, activeStylePreset.wordsPerCard])

  const activeCard = useMemo(() => {
    return captionCards.find((c) => currentSourceTime >= c.start - 0.08 && currentSourceTime <= c.end + 0.25) ?? null
  }, [captionCards, currentSourceTime])

  // Playback control
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const seekRelative = useCallback((relSec: number) => {
    if (!videoRef.current) return
    const maxVid = videoRef.current.duration || clip.duration || 60
    const clamped = Math.max(0, Math.min(maxVid, relSec))
    videoRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }, [clip.duration])

  const seekToSourceSec = useCallback((sourceSec: number) => {
    const rel = Math.max(0, sourceSec - baseSourceStart)
    seekRelative(rel)
  }, [baseSourceStart, seekRelative])

  // Keyboard shortcuts (Space = Play/Pause, Left/Right = Frame Step)
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        seekRelative(currentTime - (e.shiftKey ? 1 : 0.1))
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        seekRelative(currentTime + (e.shiftKey ? 1 : 0.1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, togglePlay, seekRelative, currentTime])

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate)
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
    }
  }

  // Nudge helpers with strict 15s–60s enforcement
  const nudgeStart = (delta: number) => {
    setStart((prev) => {
      const next = Math.max(0, Math.round((prev + delta) * 10) / 10)
      if (end - next < 15) return Math.max(0, end - 15)
      if (end - next > 60) return end - 60
      return next
    })
  }

  const nudgeEnd = (delta: number) => {
    setEnd((prev) => {
      const maxLimit = projectDuration > 0 ? projectDuration : 99999
      const next = Math.min(maxLimit, Math.round((prev + delta) * 10) / 10)
      if (next - start < 15) return Math.min(maxLimit, start + 15)
      if (next - start > 60) return start + 60
      return next
    })
  }

  const updateWordText = (id: number, newText: string) => {
    setEditableWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, text: newText } : w))
    )
  }

  const deleteWord = (id: number) => {
    setEditableWords((prev) => prev.filter((w) => w.id !== id))
    if (editingWordId === id) setEditingWordId(null)
  }

  const resetEdits = () => {
    const s0 = clip.sourceStart ?? 0
    const e0 = Math.min(s0 + 60, clip.sourceEnd ?? s0 + (clip.duration || 30))
    setTitle(clip.title || 'Viral Clip')
    setStart(s0)
    setEnd(e0)
    setCaptionStyle(clip.captionStyle || 'hormozi')
    const rawWords = clip.captionData?.words ?? []
    setEditableWords(
      rawWords
        .map((w, idx) => ({
          id: idx,
          text: String(w.text ?? w.word ?? '').trim(),
          start: Number(w.start ?? 0),
          end: Number(w.end ?? 0),
        }))
        .filter((w) => w.text.length > 0)
    )
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const totalDur = Math.max(1, clip.duration || clipDuration || 30)
    seekRelative(ratio * totalDur)
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
        aspectRatio,
        framing,
        title: title.trim() || clip.title,
        words: editableWords
          .filter((w) => w.text.trim().length > 0)
          .map((w) => ({
            start: w.start,
            end: w.end,
            text: w.text.trim(),
          })),
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save and render clip')
    } finally {
      setSaving(false)
    }
  }

  const filteredStyles =
    styleCategory === 'All'
      ? CAPTION_STYLES
      : CAPTION_STYLES.filter((s) => s.category === styleCategory)

  const filteredWords = wordSearch.trim()
    ? editableWords.filter((w) => w.text.toLowerCase().includes(wordSearch.trim().toLowerCase()))
    : editableWords

  const activeGradeFilter = COLOR_GRADES.find((g) => g.id === colorGrade)?.filter ?? 'none'
  const totalTimelineDuration = Math.max(1, clip.duration || clipDuration || 30)
  const playheadPercent = Math.min(100, Math.max(0, (currentTime / totalTimelineDuration) * 100))

  // Generate deterministic audio waveform bars for Track A1
  const waveformBars = useMemo(() => {
    const count = 72
    const bars: number[] = []
    for (let i = 0; i < count; i++) {
      const t = baseSourceStart + (i / count) * totalTimelineDuration
      const hasSpeech = editableWords.some((w) => t >= w.start - 0.15 && t <= w.end + 0.15)
      const seed = Math.sin(i * 12.9898 + baseSourceStart) * 43758.5453
      const frac = seed - Math.floor(seed)
      bars.push(hasSpeech ? Math.round(40 + frac * 58) : Math.round(14 + frac * 18))
    }
    return bars
  }, [baseSourceStart, totalTimelineDuration, editableWords])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-2 md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[96vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-gold/25 bg-[#0B0B0F] shadow-[0_0_90px_rgba(0,0,0,0.95)]">
        {/* ==================== TOP NLE HEADER BAR ==================== */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111117] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/25 to-champagne/10 text-gold border border-gold/40 shadow-inner">
              <Film className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 max-w-md">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-white tracking-wide">
                  Cliptica Studio NLE
                </span>
                <span className="rounded-md bg-gold/15 border border-gold/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                  Remotion × OpenMontage Engine
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-xs font-medium text-champagne/90 focus:text-white focus:outline-none border-b border-transparent focus:border-gold/50 truncate"
                placeholder="Enter viral clip title..."
                title="Click to edit clip title"
              />
            </div>
          </div>

          {/* Aspect Ratio Quick Switcher */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1">
            {(['9:16', '1:1', '16:9'] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition-all ${
                  aspectRatio === ratio
                    ? 'bg-gold text-black shadow'
                    : 'text-mist hover:text-white'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetEdits}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-mist hover:text-white hover:border-white/20 transition-colors"
              title="Reset all unsaved changes"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-lux btn-gold !py-2 !px-5 text-xs font-bold flex items-center gap-2 shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:scale-[1.02] transition-transform"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Rendering Master MP4…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Save & Render Master MP4</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-mist hover:border-white/25 hover:text-white transition-colors"
              title="Close Editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ==================== MAIN WORKSPACE (LEFT INSPECTOR + RIGHT CANVAS) ==================== */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[410px_1fr]">
          {/* LEFT PANEL: NLE INSPECTOR (TRANSCRIPT, 18 PRESETS, FRAMING) */}
          <div className="flex flex-col border-b border-white/10 lg:border-b-0 lg:border-r bg-[#111117] overflow-hidden">
            {/* Inspector Tabs */}
            <div className="grid grid-cols-3 gap-1 border-b border-white/10 p-2 bg-black/30">
              {[
                { id: 'subtitles', label: 'Transcript', icon: Type },
                { id: 'style', label: '18 Captions', icon: Wand2 },
                { id: 'framing', label: 'Framing & Look', icon: Layers },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition-all ${
                    activeTab === t.id
                      ? 'bg-gold text-black shadow-md'
                      : 'text-mist hover:text-white hover:bg-white/5'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: INTERACTIVE WORD-BY-WORD TRANSCRIPT EDITOR */}
              {activeTab === 'subtitles' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Edit3 className="h-3.5 w-3.5 text-gold" />
                        <span>Interactive Word Scrubber & Editor</span>
                      </h4>
                      <p className="text-[11px] text-mist-2 mt-0.5">
                        Click any word to jump video, or double-click a word to edit its spelling live.
                      </p>
                    </div>
                    <span className="rounded-lg bg-white/5 border border-white/10 px-2 py-0.5 font-mono text-[10px] text-champagne">
                      {editableWords.length} words
                    </span>
                  </div>

                  {/* Search Filter */}
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-mist absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={wordSearch}
                      onChange={(e) => setWordSearch(e.target.value)}
                      placeholder="Search words in transcript..."
                      className="w-full rounded-xl border border-white/10 bg-black/50 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-mist-2 focus:border-gold focus:outline-none"
                    />
                  </div>

                  {/* Active Word Inline Editor Box */}
                  {editingWordId !== null && (
                    <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gold font-semibold">
                        <span>Editing Selected Word</span>
                        <button
                          type="button"
                          onClick={() => setEditingWordId(null)}
                          className="text-mist hover:text-white text-[10px]"
                        >
                          Done
                        </button>
                      </div>
                      {(() => {
                        const target = editableWords.find((w) => w.id === editingWordId)
                        if (!target) return null
                        return (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={target.text}
                              onChange={(e) => updateWordText(target.id, e.target.value)}
                              className="flex-1 rounded-lg border border-gold/50 bg-black px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => deleteWord(target.id)}
                              className="rounded-lg border border-red-400/40 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"
                              title="Remove word from captions"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Word Cloud */}
                  <div className="flex flex-wrap gap-1.5 max-h-[42vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/50 p-3">
                    {filteredWords.length === 0 ? (
                      <p className="py-8 text-center text-xs text-mist w-full">
                        No transcript words available for this clip.
                      </p>
                    ) : (
                      filteredWords.map((w) => {
                        const isCurrent = currentSourceTime >= w.start - 0.05 && currentSourceTime <= w.end + 0.1
                        const isInTrim = w.start >= start && w.end <= end
                        const isEditing = editingWordId === w.id
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => seekToSourceSec(w.start)}
                            onDoubleClick={() => setEditingWordId(w.id)}
                            className={`group relative rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                              isEditing
                                ? 'ring-2 ring-gold bg-gold/25 text-white font-bold'
                                : isCurrent
                                ? 'bg-gold text-black font-bold scale-105 shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                                : isInTrim
                                ? 'bg-white/10 text-pearl hover:bg-gold/20 hover:text-gold'
                                : 'bg-black/40 text-mist-2 opacity-40'
                            }`}
                            title={`${formatSeconds(Math.max(0, w.start - baseSourceStart))} — Click to seek, Double-click to edit text`}
                          >
                            {w.text}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: 18 CAPTION PRESETS */}
              {activeTab === 'style' && (
                <div className="space-y-3">
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {['All', 'Arabic Luxury', 'Kinetic', 'Editorial', 'Creative'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setStyleCategory(cat)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                          styleCategory === cat
                            ? 'bg-gold text-black'
                            : 'bg-white/5 text-mist hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    <span>All 18 presets are locked to the 82% lower-third safe zone (never covers faces).</span>
                  </div>

                  <div className="grid gap-2 max-h-[44vh] overflow-y-auto pr-1">
                    {filteredStyles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCaptionStyle(s.id)}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          captionStyle === s.id
                            ? 'border-gold bg-gold/15 ring-1 ring-gold shadow-md'
                            : 'border-white/10 bg-black/40 text-mist hover:border-white/25 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{s.name}</span>
                            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-mist">
                              {s.wordsPerCard}w/card
                            </span>
                          </div>
                          <span
                            className="text-xs font-extrabold mt-1 inline-block rounded px-2 py-0.5"
                            style={{
                              color: s.color,
                              backgroundColor: s.activeBg,
                              textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                            }}
                          >
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

              {/* TAB 3: CAMERA FRAMING, ASPECT RATIO & COLOR LOOK */}
              {activeTab === 'framing' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white mb-2">
                      Camera Reframe & Layout Mode
                    </label>
                    <div className="grid gap-2">
                      {FRAMING_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFraming(f.id)}
                          className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                            framing === f.id
                              ? 'border-gold bg-gold/15 text-white'
                              : 'border-white/10 bg-black/40 text-mist hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold block">{f.name}</span>
                            <span className="text-[11px] text-mist-2">{f.desc}</span>
                          </div>
                          {framing === f.id && <Check className="h-4 w-4 text-gold shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-2">
                      Live Preview Color Grade
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COLOR_GRADES.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setColorGrade(g.id)}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium text-left transition-all ${
                            colorGrade === g.id
                              ? 'border-gold bg-gold/15 text-gold font-bold'
                              : 'border-white/10 bg-black/40 text-mist hover:text-white'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: REMOTION LIVE COMPOSITION STAGE */}
          <div className="flex flex-col justify-between bg-[#08080C] p-3 md:p-5 overflow-y-auto">
            {/* Stage Top Overlay Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLiveOverlay(!showLiveOverlay)}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                    showLiveOverlay
                      ? 'border-gold/50 bg-gold/15 text-gold'
                      : 'border-white/10 bg-white/5 text-mist'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Remotion Live Captions: {showLiveOverlay ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSafeZones(!showSafeZones)}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                    showSafeZones
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-mist'
                  }`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Safe Zone Grid</span>
                </button>
              </div>

              {/* Speed Selector */}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 p-1">
                {[0.5, 1, 1.25, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleSpeedChange(spd)}
                    className={`rounded-lg px-2 py-0.5 font-mono text-[10px] transition-all ${
                      playbackRate === spd ? 'bg-gold text-black font-bold' : 'text-mist hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Video Composition Viewport */}
            <div className="flex-1 flex items-center justify-center min-h-[280px] py-1">
              <div
                className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_0_60px_rgba(0,0,0,0.9)] transition-all ${
                  aspectRatio === '9:16'
                    ? 'aspect-[9/16] h-full max-h-[48vh]'
                    : aspectRatio === '1:1'
                    ? 'aspect-square h-full max-h-[46vh]'
                    : 'aspect-video w-full max-w-2xl max-h-[46vh]'
                }`}
              >
                {clip.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={clip.videoUrl}
                    controlsList="nodownload nofullscreen noplaybackrate"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    onTimeUpdate={() => {
                      if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    style={{ filter: activeGradeFilter }}
                    className="h-full w-full object-cover select-none"
                    muted={isMuted}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-mist">
                    <Eye className="h-8 w-8 text-mist-2 mb-2" />
                    <p className="text-xs">Video stream unavailable</p>
                  </div>
                )}

                {/* Safe Zone Guide Overlay (TikTok / Reels / Shorts UI Boundaries) */}
                {showSafeZones && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Top Safe Margin */}
                    <div className="absolute top-0 inset-x-0 h-[12%] border-b border-dashed border-emerald-400/40 bg-emerald-500/5 flex items-center justify-center">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-300/80">
                        Top Platform Bar Safe Zone
                      </span>
                    </div>
                    {/* Right Action Icons Exclusion Zone */}
                    <div className="absolute right-0 top-[35%] bottom-[18%] w-[16%] border-l border-dashed border-amber-400/40 bg-amber-500/5 flex items-center justify-center">
                      <span className="font-mono text-[8px] -rotate-90 whitespace-nowrap text-amber-300/80">
                        TikTok/Reels Icons
                      </span>
                    </div>
                    {/* Fixed Lower-Third Caption Anchor Line (82% Y) */}
                    <div
                      className="absolute inset-x-4 border-b-2 border-emerald-400/80 flex justify-between items-end pb-0.5"
                      style={{ top: '76%', height: '8%' }}
                    >
                      <span className="rounded bg-emerald-500/90 px-1.5 py-0.5 font-mono text-[8px] font-bold text-black">
                        LOCKED CAPTION SAFE ZONE (82% Y)
                      </span>
                    </div>
                    {/* Bottom Platform Description Exclusion */}
                    <div className="absolute bottom-0 inset-x-0 h-[14%] border-t border-dashed border-red-400/40 bg-red-500/5 flex items-center justify-center">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-red-300/80">
                        Platform Metadata Zone
                      </span>
                    </div>
                  </div>
                )}

                {/* REMOTION LIVE LOWER-THIRD CAPTION OVERLAY (Anchored strictly at 82% Y) */}
                {showLiveOverlay && activeCard && (
                  <div
                    className="absolute inset-x-4 z-30 flex justify-center pointer-events-none transition-all duration-75"
                    style={{ bottom: '16%' }}
                  >
                    <div
                      className="rounded-xl px-3.5 py-1.5 text-center shadow-2xl border border-white/15 backdrop-blur-md max-w-[90%]"
                      style={{ backgroundColor: activeStylePreset.activeBg }}
                    >
                      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                        {activeCard.words.map((w, idx) => {
                          const isWordActive =
                            currentSourceTime >= w.start - 0.05 && currentSourceTime <= w.end + 0.12
                          const displayWord = activeStylePreset.uppercase ? w.text.toUpperCase() : w.text
                          const wordColor =
                            activeStylePreset.id === 'two_tone'
                              ? idx % 2 === 0
                                ? '#FFFFFF'
                                : '#FFD700'
                              : isWordActive
                              ? activeStylePreset.color
                              : '#FFFFFF'

                          return (
                            <span
                              key={w.id}
                              onClick={() => {
                                setEditingWordId(w.id)
                                setActiveTab('subtitles')
                              }}
                              className={`pointer-events-auto cursor-pointer font-display text-sm md:text-base font-extrabold tracking-wide transition-transform duration-75 ${
                                isWordActive ? 'scale-105' : 'opacity-90'
                              }`}
                              style={{
                                color: wordColor,
                                textShadow:
                                  activeStylePreset.id === 'highlighter'
                                    ? 'none'
                                    : '0 2px 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
                              }}
                            >
                              {displayWord}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Framing / Ratio Status Pill */}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-lg bg-black/75 px-2.5 py-1 font-mono text-[10px] text-champagne border border-white/10 backdrop-blur">
                  <span>{aspectRatio}</span>
                  <span>·</span>
                  <span className="capitalize">{framing}</span>
                </div>
              </div>
            </div>

            {/* Transport Control Bar */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111117] px-4 py-2.5">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Clock className="h-3.5 w-3.5 text-gold" />
                <span className="text-white font-bold">{formatSeconds(currentTime)}</span>
                <span className="text-mist">/</span>
                <span className="text-champagne">{formatSeconds(totalTimelineDuration)}</span>
                <span className="hidden sm:inline text-[10px] text-mist-2 ml-2">
                  (Source: {formatSeconds(start)} – {formatSeconds(end)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => seekRelative(currentTime - 1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-mist hover:text-white"
                  title="Step back 1 second"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => seekRelative(currentTime - 0.1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-mist hover:text-white"
                  title="Previous frame (-0.1s)"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold text-black shadow-lg shadow-gold/25 hover:scale-105 transition-transform"
                  title="Play / Pause (Space)"
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => seekRelative(currentTime + 0.1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-mist hover:text-white"
                  title="Next frame (+0.1s)"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  onClick={() => seekRelative(currentTime + 1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-mist hover:text-white"
                  title="Step forward 1 second"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-mist hover:text-white"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== BOTTOM DOCK: OPENMONTAGE MULTI-TRACK NLE TIMELINE ==================== */}
        <div className="border-t border-white/15 bg-[#0D0D12] px-4 py-3 select-none">
          {/* Trim Controls Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-display font-bold text-white flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-gold" />
                <span>Multi-Track Timeline</span>
              </span>

              {/* Start Trim Control */}
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 px-2 py-1">
                <span className="text-[10px] text-mist mr-1">IN:</span>
                <button type="button" onClick={() => nudgeStart(-1)} className="px-1 text-[10px] text-mist hover:text-white">-1s</button>
                <span className="font-mono text-xs font-bold text-gold">{formatSeconds(start)}</span>
                <button type="button" onClick={() => nudgeStart(1)} className="px-1 text-[10px] text-mist hover:text-white">+1s</button>
              </div>

              {/* End Trim Control */}
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 px-2 py-1">
                <span className="text-[10px] text-mist mr-1">OUT:</span>
                <button type="button" onClick={() => nudgeEnd(-1)} className="px-1 text-[10px] text-mist hover:text-white">-1s</button>
                <span className="font-mono text-xs font-bold text-gold">{formatSeconds(end)}</span>
                <button type="button" onClick={() => nudgeEnd(1)} className="px-1 text-[10px] text-mist hover:text-white">+1s</button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                  clipDuration >= 15 && clipDuration <= 60
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/15 text-red-300'
                }`}
              >
                Clip Duration: {clipDuration}s (15s–60s limit)
              </span>
            </div>
          </div>

          {/* Interactive Multi-Track Timeline Area */}
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            className="relative cursor-pointer rounded-xl border border-white/10 bg-[#07070A] p-2.5 overflow-hidden"
          >
            {/* Playhead Vertical Needle */}
            <div
              className="absolute top-0 bottom-0 z-30 w-0.5 bg-gold shadow-[0_0_10px_#FFD700] pointer-events-none"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="h-3 w-3 -translate-x-[5px] rotate-45 rounded-xs bg-gold shadow" />
            </div>

            {/* Time Ruler Marks */}
            <div className="flex justify-between text-[9px] font-mono text-mist-2 pb-1.5 border-b border-white/5">
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((pct) => (
                <span key={pct}>{formatSeconds(pct * totalTimelineDuration)}</span>
              ))}
            </div>

            {/* TRACK V1: Video & Framing Track */}
            <div className="mt-1.5 flex items-center gap-2 h-7">
              <span className="w-16 shrink-0 font-mono text-[10px] font-semibold text-champagne flex items-center gap-1">
                <Film className="h-3 w-3 text-gold" /> V1 Video
              </span>
              <div className="relative flex-1 h-full rounded-lg bg-gradient-to-r from-indigo-950/80 via-indigo-900/50 to-indigo-950/80 border border-indigo-400/30 overflow-hidden flex items-center px-3 justify-between">
                <span className="text-[10px] font-medium text-indigo-200 truncate">
                  {title} ({aspectRatio} · {framing})
                </span>
                <span className="font-mono text-[10px] text-indigo-300">
                  {formatSeconds(start)} → {formatSeconds(end)}
                </span>
              </div>
            </div>

            {/* TRACK T1: Karaoke Subtitles Track */}
            <div className="mt-1.5 flex items-center gap-2 h-7">
              <span className="w-16 shrink-0 font-mono text-[10px] font-semibold text-gold flex items-center gap-1">
                <Type className="h-3 w-3 text-gold" /> T1 Subs
              </span>
              <div className="relative flex-1 h-full rounded-lg bg-black/70 border border-white/10 overflow-hidden">
                {captionCards.map((card) => {
                  const relStart = Math.max(0, card.start - baseSourceStart)
                  const relEnd = Math.min(totalTimelineDuration, card.end - baseSourceStart)
                  const leftPct = (relStart / totalTimelineDuration) * 100
                  const widthPct = Math.max(1.5, ((relEnd - relStart) / totalTimelineDuration) * 100)
                  const isCardCurrent = activeCard?.id === card.id
                  return (
                    <div
                      key={card.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        seekToSourceSec(card.start)
                      }}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1 bottom-1 rounded px-1 flex items-center overflow-hidden text-[9px] font-mono whitespace-nowrap transition-colors ${
                        isCardCurrent
                          ? 'bg-gold text-black font-bold z-10'
                          : 'bg-gold/20 text-champagne border border-gold/30 hover:bg-gold/35'
                      }`}
                      title={card.words.map((w) => w.text).join(' ')}
                    >
                      {card.words.map((w) => w.text).join(' ')}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* TRACK A1: Audio Loudness Waveform Track */}
            <div className="mt-1.5 flex items-center gap-2 h-7">
              <span className="w-16 shrink-0 font-mono text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                <Volume2 className="h-3 w-3 text-emerald-400" /> A1 Audio
              </span>
              <div className="relative flex-1 h-full rounded-lg bg-emerald-950/25 border border-emerald-500/20 px-2 flex items-center justify-between gap-[2px]">
                {waveformBars.map((h, i) => {
                  const barPct = (i / waveformBars.length) * 100
                  const isPlayed = barPct <= playheadPercent
                  return (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className={`flex-1 rounded-full transition-colors ${
                        isPlayed ? 'bg-emerald-400' : 'bg-emerald-500/30'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
