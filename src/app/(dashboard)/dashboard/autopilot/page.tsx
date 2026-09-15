'use client'

import { useEffect, useState } from 'react'
import {
  Radio, Plus, Trash2, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, Youtube
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
  { id: 'arabic_luxury', name: 'عربي ملكي ذهبي (Arabic Luxury)' },
  { id: 'arabic_viral', name: 'عربي تيك توك فايرال (Arabic Viral)' },
  { id: 'hormozi', name: 'Hormozi Pop (Yellow Punch)' },
  { id: 'bold_impact', name: 'Bold Impact (Punchy Gold)' },
  { id: 'clean_minimal', name: 'Clean Minimal (Soft Subtitle)' },
]

const FRAMING_OPTIONS = [
  { id: 'smart', name: 'Smart Face Tracking (ذكي)' },
  { id: 'split', name: 'Podcast Split Screen (تقسيم شخصين)' },
  { id: 'blur', name: 'Blurred Backdrop (خلفية مموهة)' },
]

export default function AutoPilotPage() {
  const [channels, setChannels] = useState<AutoPilotChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [channelUrl, setChannelUrl] = useState('')
  const [channelTitle, setChannelTitle] = useState('')
  const [captionStyle, setCaptionStyle] = useState('arabic_luxury')
  const [framing, setFraming] = useState('smart')

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
  }, [])

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

      setSuccess('تمت إضافة القناة بنجاح! الطيار الآلي يراقب الآن أي فيديو جديد.')
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
    if (!confirm('هل أنت متأكد من حذف هذه القناة من الطيار الآلي؟')) return
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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gold">
            <Radio className="h-4 w-4 animate-pulse text-gold" />
            <span>Autonomous Ingestion Engine</span>
          </div>
          <h1 className="display-md mt-2">نظام الطيار الآلي للقنوات (Auto-Pilot)</h1>
          <p className="mt-1 text-sm font-light text-mist max-w-2xl leading-relaxed">
            اربط قنوات YouTube المفضلة أو قناتك الخاصة. عندما يتم نشر أي فيديو جديد على القناة، يقوم سيرفر المعالجة الذاتي بسحبه فوراً وإنتاج 3-6 مقاطع ريلز وشورتس جاهزة للنشر تلقائياً!
          </p>
        </div>
      </div>

      {/* Add New Channel Form */}
      <div className="mt-8 rounded-3xl border border-hair/60 bg-onyx-2 p-6 md:p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <Youtube className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-pearl">
            إضافة قناة جديدة للمراقبة الآلية
          </h2>
        </div>

        <form onSubmit={handleAdd} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">
                رابط القناة أو المعرف (YouTube Channel URL / @handle)
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
                اسم تعريفي للقناة (اختياري)
              </label>
              <input
                type="text"
                value={channelTitle}
                onChange={(e) => setChannelTitle(e.target.value)}
                placeholder="مثال: بودكاست فنجان"
                className="input-lux !py-2.5 !text-xs"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mist">
                نمط الترجمة التلقائي (Auto Caption Style)
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
                طريقة الاقتصاص والتأطير (Framing Mode)
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
                  <span>جاري الإضافة...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-black" />
                  <span>تفعيل الطيار الآلي للقناة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Active Watchlist */}
      <div className="mt-12">
        <h2 className="font-display text-xl font-bold text-pearl">
          القنوات قيد المراقبة الآلية ({channels.length})
        </h2>

        {loading ? (
          <div className="mt-6 flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : channels.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-hair/50 bg-black/20 p-12 text-center">
            <Radio className="mx-auto h-8 w-8 text-mist opacity-50" />
            <p className="mt-3 text-sm font-light text-mist">
              لم تقم بإضافة أي قناة بعد. أضف رابط قناة يوتيوب أعلاه ليبدأ الذكاء الاصطناعي برصدها آلياً.
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
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20">
                    <Radio className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-black" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-pearl">
                        {ch.channelTitle || 'قناة يوتيوب'}
                      </h3>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        مراقبة نشطة
                      </span>
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
                    <p className="text-[10px] uppercase tracking-wider text-mist-2">الترجمة والتأطير</p>
                    <p className="font-medium text-champagne mt-0.5">
                      {ch.captionStyle} · {ch.framing}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-mist-2">آخر فحص تلقائي</p>
                    <p className="font-medium text-pearl mt-0.5">
                      {ch.lastCheckedAt ? new Date(ch.lastCheckedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'قيد الانتظار'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(ch.id)}
                    className="rounded-xl border border-hair/40 bg-black/40 p-2 text-mist hover:border-red-400/40 hover:text-red-400"
                    title="حذف من الطيار الآلي"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
