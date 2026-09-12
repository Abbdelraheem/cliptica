'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Link2, Upload, Loader2, Sparkles, ScanFace, Frame,
  RectangleHorizontal, Shuffle, CloudUpload, CheckCircle2,
  Megaphone, ExternalLink, FileVideo, HardDrive,
} from 'lucide-react'
import { fetchWithTimeout } from '@/lib/utils'
import { cleanUrlString, normaliseVideoUrl } from '@/lib/validation'

const FRAMINGS = [
  { id: 'smart', name: 'Smart framing', desc: 'Crops to the speaker when there is one — center otherwise.', icon: ScanFace },
  { id: 'face', name: 'Face track', desc: 'Fills the frame and follows whoever is talking.', icon: ScanFace },
  { id: 'blur', name: 'Blurred backdrop', desc: 'Original framing with soft-blur bars.', icon: Frame },
  { id: 'letter', name: 'Letterbox', desc: 'Original framing on clean black.', icon: RectangleHorizontal },
  { id: 'variety', name: 'Variety pack', desc: 'Alternates framing across the batch.', icon: Shuffle },
] as const

const ASPECT_RATIOS = [
  { id: '9:16', name: '9:16 Vertical', desc: 'TikTok, Reels, Shorts', icon: '📱' },
  { id: '1:1', name: '1:1 Square', desc: 'Instagram & LinkedIn Feed', icon: '⏹️' },
  { id: '16:9', name: '16:9 Landscape', desc: 'YouTube & Web Desktop', icon: '🖥️' },
] as const

const LANGS = [
  ['auto', 'Auto-detect'],
  ['en', 'English'], ['ar', 'العربية (Arabic)'], ['es', 'Spanish'],
  ['fr', 'French'], ['de', 'German'], ['tr', 'Turkish'],
] as const

const CAPTION_PRESETS = [
  // === KINETIC CATEGORY ===
  {
    id: 'hormozi',
    category: 'Kinetic',
    name: 'Hormozi Pop',
    desc: 'Kinetic 1-3 word cards with aggressive spring scale pop.',
    badge: 'Popular',
    sample: 'STOP SCROLLING',
    sampleStyle: {
      color: '#FFFFFF',
      textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 2px #000',
      fontWeight: 900,
    },
  },
  {
    id: 'bold_impact',
    category: 'Kinetic',
    name: 'Bold Impact',
    desc: 'Heavy uppercase gold text with deep shadow.',
    badge: 'High Impact',
    sample: 'MUST WATCH THIS',
    sampleStyle: {
      color: '#FFD700',
      textShadow: '0 3px 6px rgba(0,0,0,1), 0 0 3px #000',
      fontWeight: 900,
      letterSpacing: '0.05em',
    },
  },
  {
    id: 'bounce_side',
    category: 'Kinetic',
    name: 'Side Bounce',
    desc: 'Slide-in from left with spring bounce settle.',
    badge: 'Motion',
    sample: 'FAST ACTION',
    sampleStyle: {
      color: '#FF5A1F',
      textShadow: '0 2px 4px rgba(0,0,0,0.9)',
      fontWeight: 900,
    },
  },
  {
    id: 'pill_box',
    category: 'Kinetic',
    name: 'Pill Box',
    desc: 'Crisp typography in a dark obsidian slate pill badge.',
    badge: 'Badge',
    sample: 'KEY TAKEAWAY',
    sampleStyle: {
      color: '#FFFFFF',
      backgroundColor: '#181410',
      padding: '3px 8px',
      borderRadius: '9999px',
      border: '1px solid rgba(255,255,255,0.15)',
      fontWeight: 800,
    },
  },
  {
    id: 'tiktok_classic',
    category: 'Kinetic',
    name: 'TikTok Big Word',
    desc: 'Single-word center punch at jumbo scale for max retention.',
    badge: 'Trending',
    sample: 'VIRAL',
    sampleStyle: {
      color: '#FFFFFF',
      textShadow: '0 4px 10px rgba(0,0,0,0.95), 0 0 3px #000',
      fontWeight: 900,
      fontSize: '15px',
      letterSpacing: '0.08em',
    },
  },

  // === EDITORIAL CATEGORY ===
  {
    id: 'clean_minimal',
    category: 'Editorial',
    name: 'Clean Minimal',
    desc: 'Understated lower-third lines with smooth fade.',
    badge: 'Clean',
    sample: 'The simplest ideas win.',
    sampleStyle: {
      color: '#F3F4F6',
      fontWeight: 400,
      fontSize: '11px',
    },
  },
  {
    id: 'classic_subtitle',
    category: 'Editorial',
    name: 'Classic Subtitle',
    desc: 'Documentary safe-zone lines at bottom edge.',
    badge: 'Cinema',
    sample: 'Every detail was planned in advance.',
    sampleStyle: {
      color: '#FFFFFF',
      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      fontWeight: 400,
      fontSize: '11px',
    },
  },
  {
    id: 'slow_fade',
    category: 'Editorial',
    name: 'Slow Fade',
    desc: 'Gentle breathing fade with warm ivory serif typography.',
    badge: 'Thoughtful',
    sample: 'Reflections on what matters.',
    sampleStyle: {
      color: '#F8F0E8',
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontWeight: 500,
      fontSize: '11px',
    },
  },
  {
    id: 'cinematic_caps',
    category: 'Editorial',
    name: 'Cinematic Caps',
    desc: 'Widescreen letterbox tracked caps with silver luminescence.',
    badge: 'Widescreen',
    sample: 'A NEW HORIZON BECKONS',
    sampleStyle: {
      color: '#ECE8E8',
      fontWeight: 600,
      fontSize: '10px',
      letterSpacing: '0.14em',
    },
  },
  {
    id: 'podcast_soft',
    category: 'Editorial',
    name: 'Podcast Soft',
    desc: 'Warm peach-cream rounded geometry for friendly cadence.',
    badge: 'Podcast',
    sample: 'Here is what they never tell you.',
    sampleStyle: {
      color: '#FFD8A0',
      fontWeight: 600,
      fontSize: '11px',
    },
  },

  // === CREATIVE CATEGORY ===
  {
    id: 'neon_highlight',
    category: 'Creative',
    name: 'Neon Highlight',
    desc: 'Electric cyan with glowing magenta shadow pulse.',
    badge: 'Glow',
    sample: 'PURE ENERGY',
    sampleStyle: {
      color: '#00FFFF',
      textShadow: '0 0 8px rgba(255,0,128,0.9), 0 0 2px #FF0080',
      fontWeight: 800,
    },
  },
  {
    id: 'highlighter',
    category: 'Creative',
    name: 'Highlighter',
    desc: 'Fluorescent yellow marker box with black text.',
    badge: 'Marker',
    sample: 'HIGHLIGHTED TRUTH',
    sampleStyle: {
      color: '#000000',
      backgroundColor: '#FFE600',
      fontWeight: 800,
      padding: '2px 6px',
      borderRadius: '2px',
    },
  },
  {
    id: 'typewriter',
    category: 'Creative',
    name: 'Typewriter',
    desc: 'Retro mechanical monospace in terminal matrix green.',
    badge: 'Code/Retro',
    sample: 'system.init()',
    sampleStyle: {
      color: '#50FF50',
      fontFamily: 'monospace',
      backgroundColor: '#121612',
      padding: '2px 6px',
      borderRadius: '3px',
      border: '1px solid rgba(80,255,80,0.3)',
      fontWeight: 700,
      fontSize: '11px',
    },
  },
  {
    id: 'two_tone',
    category: 'Creative',
    name: 'Two-Tone Alternate',
    desc: 'Alternating golden yellow and crisp pearl cadence.',
    badge: 'Dual Tone',
    sample: 'BREAK THE PATTERN',
    sampleStyle: {
      color: '#FFFFFF',
      textShadow: '0 2px 4px rgba(0,0,0,0.8)',
      fontWeight: 900,
      borderBottom: '2px solid #FFD700',
    },
  },
  {
    id: 'glitch_flicker',
    category: 'Creative',
    name: 'Glitch Accent',
    desc: 'Cyber pink with electric cyan edges and rapid pulse.',
    badge: 'Cyberpunk',
    sample: 'GLITCH REALITY',
    sampleStyle: {
      color: '#C832FF',
      textShadow: '0 0 6px rgba(0,255,255,0.9), 0 0 2px #00FFFF',
      fontWeight: 900,
      letterSpacing: '0.04em',
    },
  },
] as const

const ALLOWED_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm',
])
const MAX_MB = 500

type Tab = 'upload' | 'link' | 'campaign'

export default function NewProjectPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [uploadedKey, setUploadedKey] = useState('')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [clipFrom, setClipFrom] = useState('')
  const [framing, setFraming] = useState<(typeof FRAMINGS)[number]['id']>('smart')
  const [captionCategory, setCaptionCategory] = useState<'All' | 'Kinetic' | 'Editorial' | 'Creative'>('All')
  const [captionStyle, setCaptionStyle] = useState<(typeof CAPTION_PRESETS)[number]['id']>('hormozi')
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]['id']>('9:16')
  const [language, setLanguage] = useState('auto')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Campaign state (Whop / ContentReward / Google Drive assets)
  const [campaignUrl, setCampaignUrl] = useState('')
  const [analyzingCampaign, setAnalyzingCampaign] = useState(false)
  const [campaignData, setCampaignData] = useState<{
    platform: string
    title: string
    payout: string | null
    guidelines: string[]
    requiredHashtags: string[]
    recommendedInstructions: string
    assets: Array<{ type: string; url: string; label: string }>
  } | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)

  async function handleAnalyzeCampaign() {
    const clean = campaignUrl.trim()
    if (!clean) return setError('Please enter a Whop or ContentReward campaign URL.')
    setError('')
    setAnalyzingCampaign(true)
    try {
      const res = await fetchWithTimeout('/api/campaigns/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean }),
      }, 25000)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.error ?? 'Failed to inspect campaign')
      }
      setCampaignData(data.campaign)
      if (!title) setTitle(data.campaign.title)
      if (data.campaign.recommendedInstructions) {
        setInstructions(data.campaign.recommendedInstructions)
      }
      if (data.campaign.assets?.length) {
        setSelectedAsset(data.campaign.assets[0].url)
        setUrl(data.campaign.assets[0].url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze campaign URL')
    } finally {
      setAnalyzingCampaign(false)
    }
  }

  async function pickFile(f: File | undefined | null) {
    setError('')
    if (!f) return
    if (!ALLOWED_TYPES.has(f.type)) return setError('Format not supported — use mp4, mov, mkv or webm.')
    if (f.size > MAX_MB * 1024 * 1024) return setError(`File exceeds ${MAX_MB}MB.`)
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))

    // presign → PUT to R2 with progress
    try {
      setPct(0)
      const sign = await fetchWithTimeout('/api/projects/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.name, contentType: f.type, sizeMb: +(f.size / 1048576).toFixed(1) }),
      }, 20000)
      if (!sign.ok) throw new Error((await sign.json().catch(() => null))?.error ?? 'Sign failed')
      const { uploadUrl, key } = await sign.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', f.type)
        xhr.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100))
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(f)
      })
      setUploadedKey(key)
      setPct(100)
    } catch (e) {
      setFile(null)
      setPct(null)
      setUploadedKey('')
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  function validate(): string | null {
    if (tab === 'upload' && !uploadedKey) return 'Wait for the upload to finish first.'
    if (tab === 'link') {
      const s = cleanUrlString(url)
      if (!s) return 'Paste a video link.'
      const normalised = normaliseVideoUrl(s)
      if (!normalised) return 'Paste a valid video link (e.g. YouTube URL).'
    }
    if (tab === 'campaign') {
      const targetUrl = selectedAsset || url
      if (!targetUrl) return 'Analyze the campaign and select a footage asset or paste a source URL.'
    }
    if (clipFrom && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(clipFrom)) return 'Start time format: mm:ss'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) return setError(v)
    setError('')
    setSubmitting(true)
    const targetUrl = tab === 'campaign' ? (selectedAsset || url) : url
    try {
      const res = await fetchWithTimeout('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: tab === 'upload' ? 'file' : 'url',
          url: tab !== 'upload' ? cleanUrlString(targetUrl) : undefined,
          fileKey: tab === 'upload' ? uploadedKey : undefined,
          fileName: tab === 'upload' ? file?.name : undefined,
          title: title || undefined,
          instructions: instructions || undefined,
          clipFrom: clipFrom || undefined,
          framing,
          language,
          captionStyle,
          aspectRatio,
        }),
      }, 20000)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to start clipping')
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('credits-updated'))
      }
      router.push('/dashboard/projects')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">New project</p>
      <h1 className="display-md mt-2.5">
        Drop in the <span className="italic-accent gold-text">long video</span>
      </h1>
      <p className="mt-3 font-light text-mist">
        Uploads are instant and never blocked. Links work for YouTube — files always win when you have them.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-3xl border border-hair bg-gradient-to-b from-pearl/[0.05] to-pearl/[0.01] p-8 backdrop-blur-xl">

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-hair/60 bg-black/30 p-1">
          {([
            { id: 'upload', label: 'Upload file', icon: CloudUpload },
            { id: 'link', label: 'YouTube link', icon: Link2 },
            { id: 'campaign', label: 'Campaign (Whop / ContentReward)', icon: Megaphone },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setError('') }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm transition-all ${
                tab === t.id ? 'bg-champagne/15 font-semibold text-gold' : 'text-mist hover:text-pearl'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'upload' && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime,video/x-matroska,video/webm"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hair/70 py-10 text-mist transition-colors hover:border-champagne hover:text-gold"
            >
              {pct !== null ? (
                pct === 100 ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <span className="text-sm">{file?.name} — uploaded ✓</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Uploading… {pct}%</span>
                    <span className="mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-gradient-to-r from-gold to-champagne transition-all" style={{ width: `${pct}%` }} />
                    </span>
                  </>
                )
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span className="text-sm font-light">Drop your video here, or click to browse</span>
                  <span className="font-mono text-[11px] text-mist-2">mp4 · mov · mkv · webm — up to {MAX_MB}MB</span>
                </>
              )}
            </button>
            <p className="-mt-2 text-xs leading-relaxed text-mist-2">
              Recommended — an uploaded file is processed instantly and never gets blocked.
            </p>
          </>
        )}

        {tab === 'link' && (
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-2" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="input-lux !pl-11"
            />
            <p className="mt-2 text-xs leading-relaxed text-mist-2">
              Heads up: YouTube limits automated downloads, so links can fail or stall.
              If it does — download the video and upload it above; that always works.
            </p>
          </div>
        )}

        {tab === 'campaign' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Megaphone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-champagne" />
                <input
                  type="url"
                  value={campaignUrl}
                  onChange={(e) => setCampaignUrl(e.target.value)}
                  placeholder="Paste Whop, ContentReward, or clipping campaign URL…"
                  className="input-lux !pl-11"
                />
              </div>
              <button
                type="button"
                onClick={handleAnalyzeCampaign}
                disabled={analyzingCampaign || !campaignUrl.trim()}
                className="btn-lux btn-gold !py-2.5 !px-5 shrink-0 disabled:opacity-50 flex items-center gap-2"
              >
                {analyzingCampaign ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Inspect Assets</span>
                  </>
                )}
              </button>
            </div>

            {campaignData && (
              <div className="rounded-2xl border border-champagne/40 bg-black/40 p-5 space-y-4 shadow-[0_0_25px_rgba(212,175,55,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-champagne/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-champagne border border-champagne/30">
                      {campaignData.platform}
                    </span>
                    <h3 className="text-sm font-semibold text-pearl">{campaignData.title}</h3>
                  </div>
                  {campaignData.payout && (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 font-mono text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                      💰 {campaignData.payout}
                    </span>
                  )}
                </div>

                {/* Campaign Guidelines */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-mist-2 mb-2">Campaign Guidelines &amp; Criteria</p>
                  <ul className="space-y-1.5 text-xs text-mist">
                    {campaignData.guidelines.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-gold mt-0.5">✦</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Extracted Media Assets (Drive / YouTube / Video) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-mist-2">
                      Detected Assets &amp; Footage ({campaignData.assets.length})
                    </p>
                    <span className="text-[11px] text-champagne">Select one to clip</span>
                  </div>

                  {campaignData.assets.length === 0 ? (
                    <div className="rounded-xl border border-hair/50 bg-black/20 p-3 text-xs text-mist-2">
                      No direct Drive or video links detected on the page. Paste your source video link manually:
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://drive.google.com/... or https://youtube.com/..."
                        className="input-lux mt-2"
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {campaignData.assets.map((asset, idx) => {
                        const isChosen = (selectedAsset || url) === asset.url
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedAsset(asset.url)
                              setUrl(asset.url)
                            }}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                              isChosen
                                ? 'border-champagne bg-champagne/15 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                                : 'border-hair/60 bg-black/30 hover:border-hair hover:bg-black/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {asset.type === 'drive' ? (
                                <HardDrive className={`h-5 w-5 shrink-0 ${isChosen ? 'text-gold' : 'text-mist'}`} />
                              ) : asset.type === 'youtube' ? (
                                <Link2 className={`h-5 w-5 shrink-0 ${isChosen ? 'text-gold' : 'text-mist'}`} />
                              ) : (
                                <FileVideo className={`h-5 w-5 shrink-0 ${isChosen ? 'text-gold' : 'text-mist'}`} />
                              )}
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold truncate ${isChosen ? 'text-pearl' : 'text-mist'}`}>
                                  {asset.label}
                                </p>
                                <p className="text-[11px] text-mist-2 truncate">{asset.url}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={asset.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 text-mist-2 hover:text-pearl"
                                title="Open asset in new tab"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${isChosen ? 'bg-gold text-black font-semibold' : 'bg-white/5 text-mist'}`}>
                                {isChosen ? 'Selected ✓' : 'Select'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Campaign Tags */}
                {campaignData.requiredHashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {campaignData.requiredHashtags.map((tag, idx) => (
                      <span key={idx} className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-champagne/90">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs leading-relaxed text-mist-2">
              Automatically ingests campaign rules, extracts Google Drive media assets, and tunes AI scoring to match the payout requirements.
            </p>
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-light text-mist">Project name</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Podcast ep. 42"
            className="input-lux"
          />
        </div>

        {/* Clip from */}
        <div>
          <label htmlFor="clipFrom" className="mb-2 block text-sm font-light text-mist">
            Start clipping from <span className="text-mist-2">(mm:ss — leave empty to clip from the beginning)</span>
          </label>
          <input
            id="clipFrom"
            type="text"
            value={clipFrom}
            onChange={(e) => setClipFrom(e.target.value)}
            placeholder="12:30"
            className="input-lux !w-40 font-mono"
          />
        </div>

        {/* Instructions */}
        <div>
          <label htmlFor="instructions" className="mb-2 block text-sm font-light text-mist">
            Clipping instructions <span className="text-mist-2">(optional)</span>
          </label>
          <textarea
            id="instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder='e.g. "Focus on the most emotional moments", "Only clips about pricing", "Avoid the sponsor segment"…'
            className="input-lux resize-none"
          />
        </div>

        {/* Aspect Ratio */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-light text-mist">Target Aspect Ratio</p>
            <span className="font-mono text-xs text-champagne">3 Formats Available</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.id}
                type="button"
                onClick={() => setAspectRatio(ar.id)}
                className={`flex flex-col items-center rounded-xl border p-3.5 text-center transition-all ${
                  aspectRatio === ar.id
                    ? 'border-champagne/70 bg-champagne/10 shadow-[0_0_15px_rgba(212,175,55,0.12)]'
                    : 'border-hair/60 bg-black/25 hover:border-hair hover:bg-black/40'
                }`}
              >
                <span className="mb-1.5 text-xl">{ar.icon}</span>
                <p className={`text-xs font-semibold ${aspectRatio === ar.id ? 'text-pearl' : 'text-mist'}`}>{ar.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-mist-2">{ar.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Framing */}
        <div>
          <p className="mb-3 text-sm font-light text-mist">Framing</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FRAMINGS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFraming(f.id)}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  framing === f.id
                    ? 'border-champagne/60 bg-champagne/10'
                    : 'border-hair/60 bg-black/20 hover:border-hair'
                }`}
              >
                <f.icon className={`h-4 w-4 ${framing === f.id ? 'text-gold' : 'text-mist-2'}`} />
                <p className={`mt-2 text-xs font-semibold ${framing === f.id ? 'text-pearl' : 'text-mist'}`}>{f.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-mist-2">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Caption Style Preset Visual Picker */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-light text-mist">Caption Style Preset</p>
            <span className="font-mono text-xs text-champagne">15 Styles Available</span>
          </div>

          {/* Category Filter Tabs */}
          <div className="mb-3.5 flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['All', 'Kinetic', 'Editorial', 'Creative'] as const).map((cat) => {
              const count = cat === 'All' ? CAPTION_PRESETS.length : CAPTION_PRESETS.filter((p) => p.category === cat).length
              const label =
                cat === 'All'
                  ? `All (${count})`
                  : cat === 'Kinetic'
                  ? `⚡ Kinetic (${count})`
                  : cat === 'Editorial'
                  ? `📖 Editorial (${count})`
                  : `🎨 Creative (${count})`
              const isSelected = captionCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCaptionCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'border border-champagne/60 bg-champagne/20 text-pearl shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                      : 'border border-hair/60 bg-black/30 text-mist hover:border-hair hover:text-pearl'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPTION_PRESETS.filter((p) => captionCategory === 'All' || p.category === captionCategory).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCaptionStyle(preset.id)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3.5 text-left transition-all ${
                  captionStyle === preset.id
                    ? 'border-champagne/70 bg-champagne/10 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
                    : 'border-hair/60 bg-black/25 hover:border-hair hover:bg-black/40'
                }`}
              >
                {/* Visual Sample Card */}
                <div className="mb-3 flex h-14 w-full items-center justify-center rounded-lg border border-hair/40 bg-black/60 px-2 text-center">
                  <span style={preset.sampleStyle} className="transition-transform group-hover:scale-105">
                    {preset.sample}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold ${captionStyle === preset.id ? 'text-pearl' : 'text-mist'}`}>
                      {preset.name}
                    </p>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mist-2">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-mist-2">{preset.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label htmlFor="lang" className="mb-2 block text-sm font-light text-mist">Spoken language</label>
          <select
            id="lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input-lux"
          >
            {LANGS.map(([v, label]) => (
              <option key={v} value={v} className="bg-[#111] text-white">{label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-mist-2">
            Leave on Auto unless captions come out wrong — forcing the language fixes Arabic transcribed as English.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">{error}</p>
        )}

        {/* Cost note */}
        <div className="flex items-center justify-between rounded-xl border border-hair/50 bg-onyx-2/60 px-5 py-4">
          <span className="text-sm font-light text-mist">التكلفة / Cost</span>
          <span className="font-display text-base sm:text-lg italic text-gold">
            1 كريديت لكل فيديو نهائي (1 credit per final video)
          </span>
        </div>

        <button type="submit" disabled={submitting} className="btn-lux btn-gold w-full !py-4 disabled:opacity-60">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Find the moments worth posting
            </>
          )}
        </button>

        <p className="text-center text-xs font-light text-mist-2">
          By submitting you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-gold">terms</Link>.
        </p>
      </form>
    </div>
  )
}
