'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle, Save, RotateCcw, Sparkles, Cpu, Coins,
  Shield, CheckCircle2, Loader2, Play, Layers, Megaphone
} from 'lucide-react'

type SettingsState = Record<string, boolean | number | string>

const DEFAULTS: SettingsState = {
  pipeline_premium: true,
  min_credits_required: 1,
  max_upload_mb: 500,
  clips_per_video: 3,
  clip_min_seconds: 15,
  clip_max_seconds: 90,
  clip_target_seconds: 45,
  render_parallel: 4,
  stale_job_minutes: 30,
  nvidia_api_key: '',
  nvidia_score_model: 'deepseek-ai/deepseek-v4.1-flash',
  groq_score_model: 'allam-2-7b',
  whisper_model: 'whisper-large-v3-turbo',
  groq_api_key: '',
  openai_api_key: '',
  free_starting_credits: 15,
  clipper_monthly_credits: 150,
  studio_monthly_credits: 400,
  youtube_cookies: '',
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [aiResult, setAiResult] = useState<{ success?: boolean; latencyMs?: number; error?: string; provider?: string; testedProvider?: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((d) => {
        setSettings(d.settings)
      })
      .catch(() => toast.error('Could not load settings'))
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: (d) => {
      setSettings(d.settings)
      setDirty(false)
      toast.success('Settings saved and synchronized with worker')
    },
    onError: () => toast.error('Could not save settings'),
  })

  const testAi = async (provider: 'nvidia' | 'groq' = 'nvidia') => {
    setTestingAi(true)
    setAiResult(null)
    try {
      const key = provider === 'nvidia' ? settings?.nvidia_api_key : settings?.groq_api_key
      const model = provider === 'nvidia' ? settings?.nvidia_score_model : settings?.groq_score_model
      const res = await fetch('/api/admin/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: key || undefined, model: model || undefined }),
      })
      const data = await res.json()
      setAiResult({ ...data, testedProvider: provider })
      if (data.success) {
        toast.success(`${provider === 'nvidia' ? 'NVIDIA NIM' : 'Groq'} operational! Latency: ${data.latencyMs}ms`)
      } else {
        toast.error(`${provider.toUpperCase()} failed: ${data.error || 'Check failed'}`)
      }
    } catch {
      toast.error('Network error reaching AI test endpoint')
    } finally {
      setTestingAi(false)
    }
  }

  const setValue = (key: string, value: boolean | number | string) => {
    setSettings((s) => ({ ...s, [key]: value }))
    setDirty(true)
  }

  const reset = () => {
    setSettings(DEFAULTS)
    setDirty(true)
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="h-6 w-48 animate-pulse rounded bg-surface" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hair/50 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">Platform Command Center</p>
          <h1 className="display-md mt-2">Engine & System Settings</h1>
          <p className="mt-1 text-xs text-mist font-light">
            Granular control over AI models, NVIDIA NIM & Groq failover, worker scaling, and campaign boundaries.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={reset} className="btn-lux flex items-center gap-2 border border-hair/50 text-mist hover:text-pearl">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="btn-lux btn-gold flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-6">

        {/* 1. AI Scoring & Transcription Engine */}
        <section className="glass-card !p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair/30 pb-4">
            <div className="flex items-center gap-2.5">
              <Cpu className="h-5 w-5 text-gold" />
              <div>
                <h2 className="font-display text-lg font-semibold">AI Intelligence Engine</h2>
                <p className="text-xs text-mist font-light">NVIDIA NIM Primary with Groq Instant Fast-Failover</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => testAi('nvidia')}
                disabled={testingAi}
                className="btn-lux btn-gold flex items-center gap-1.5 !py-1.5 !px-3 text-xs"
              >
                {testingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>Test NVIDIA (1st)</span>
              </button>
              <button
                type="button"
                onClick={() => testAi('groq')}
                disabled={testingAi}
                className="btn-lux btn-outline flex items-center gap-1.5 !py-1.5 !px-3 text-xs"
              >
                {testingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>Test Groq (2nd)</span>
              </button>
            </div>
          </div>

          {aiResult && (
            <div className={`mt-4 rounded-xl p-3 text-xs border ${aiResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              <div className="flex items-center gap-2 font-medium">
                {aiResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-red-400" />}
                <span>{aiResult.success ? `${aiResult.provider?.toUpperCase()} is verified and active (Response time: ${aiResult.latencyMs}ms)` : `Connection failed: ${aiResult.error}`}</span>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-gold">NVIDIA NIM API Key (1st Priority)</label>
                <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">Primary</span>
              </div>
              <p className="text-[11px] text-mist-2 mt-0.5">Primary engine for viral moment evaluation</p>
              <input
                type="password"
                value={String(settings.nvidia_api_key || '')}
                onChange={(e) => setValue('nvidia_api_key', e.target.value)}
                placeholder="nvapi-..."
                className="input-lux mt-2 font-mono text-xs w-full"
              />
            </div>

            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-gold">NVIDIA Model Identifier</label>
              <p className="text-[11px] text-mist-2 mt-0.5">Any NVIDIA NIM model (default: meta/llama-3.3-70b-instruct)</p>
              <input
                type="text"
                value={String(settings.nvidia_score_model || 'meta/llama-3.3-70b-instruct')}
                onChange={(e) => setValue('nvidia_score_model', e.target.value)}
                placeholder="meta/llama-3.3-70b-instruct"
                className="input-lux mt-2 font-mono text-xs w-full"
              />
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-mist">Groq API Key (Fallback)</label>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-mist">Instant Fallback</span>
              </div>
              <p className="text-[11px] text-mist-2 mt-0.5">Instant failover if NVIDIA is slow, rate-limited, or unavailable</p>
              <input
                type="password"
                value={String(settings.groq_api_key || '')}
                onChange={(e) => setValue('groq_api_key', e.target.value)}
                placeholder="gsk_..."
                className="input-lux mt-2 font-mono text-xs w-full"
              />
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Groq AI Scoring Model</label>
              <p className="text-[11px] text-mist-2 mt-0.5">Model used when falling back to Groq</p>
              <select
                value={String(settings.groq_score_model || 'allam-2-7b')}
                onChange={(e) => setValue('groq_score_model', e.target.value)}
                className="input-lux mt-2 w-full text-xs"
              >
                <option value="allam-2-7b">allam-2-7b (Arabic & English Optimized · Ultra Fast ~300ms)</option>
                <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Multi-lingual Deep Reasoning ~160ms)</option>
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Large Versatile)</option>
              </select>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Transcription Model</label>
              <p className="text-[11px] text-mist-2 mt-0.5">High-accuracy audio-to-text with word timestamp tokens</p>
              <select
                value={String(settings.whisper_model || 'whisper-large-v3-turbo')}
                onChange={(e) => setValue('whisper_model', e.target.value)}
                className="input-lux mt-2 w-full text-xs"
              >
                <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Groq API · 250ms)</option>
                <option value="whisper-large-v3">whisper-large-v3 (Standard Large)</option>
                <option value="base">Local CPU Whisper (base)</option>
              </select>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">OpenAI Fallback Key</label>
              <p className="text-[11px] text-mist-2 mt-0.5">Tertiary fallback for candidate scoring if Groq is offline</p>
              <input
                type="password"
                value={String(settings.openai_api_key || '')}
                onChange={(e) => setValue('openai_api_key', e.target.value)}
                placeholder="sk-..."
                className="input-lux mt-2 font-mono text-xs w-full"
              />
            </div>
          </div>
        </section>

        {/* 2. Dynamic Viral Moments & Pacing */}
        <section className="glass-card !p-6">
          <div className="flex items-center gap-2.5 border-b border-hair/30 pb-4">
            <Sparkles className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-display text-lg font-semibold">Dynamic Viral Moment Pacing</h2>
              <p className="text-xs text-mist font-light">
                Allows the AI to dynamically adapt each clip to its natural narrative length (15s to 90s) without rigid cuts
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Min Clip Length</label>
              <p className="text-[10px] text-mist-2">Minimum duration in seconds</p>
              <input
                type="number"
                min={5}
                max={40}
                value={Number(settings.clip_min_seconds ?? 15)}
                onChange={(e) => setValue('clip_min_seconds', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Default: 15s</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Max Clip Length</label>
              <p className="text-[10px] text-mist-2">Storytelling ceiling in seconds</p>
              <input
                type="number"
                min={30}
                max={180}
                value={Number(settings.clip_max_seconds ?? 90)}
                onChange={(e) => setValue('clip_max_seconds', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-gold font-medium mt-1 block">Up to 90s for Shorts/Reels</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Target Anchor</label>
              <p className="text-[10px] text-mist-2">Median target length in seconds</p>
              <input
                type="number"
                min={15}
                max={120}
                value={Number(settings.clip_target_seconds ?? 45)}
                onChange={(e) => setValue('clip_target_seconds', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Default: 45s</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Clips Per Video</label>
              <p className="text-[10px] text-mist-2">Moments selected by AI</p>
              <input
                type="number"
                min={1}
                max={10}
                value={Number(settings.clips_per_video ?? 3)}
                onChange={(e) => setValue('clips_per_video', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Default: 3 clips</span>
            </div>
          </div>
        </section>

        {/* 3. Credit Rules & Plan Allocations */}
        <section className="glass-card !p-6">
          <div className="flex items-center gap-2.5 border-b border-hair/30 pb-4">
            <Coins className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-display text-lg font-semibold">Credit Economics & Plan Balances</h2>
              <p className="text-xs text-mist font-light">Controls credit allocations and progress bar baselines across plans</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Free Starting Credits</label>
              <p className="text-[10px] text-mist-2">Initial deposit for new signups</p>
              <input
                type="number"
                min={0}
                value={Number(settings.free_starting_credits ?? 40)}
                onChange={(e) => setValue('free_starting_credits', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-gold mt-1 block">Shows as 40/40 (100% full)</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Clipper Monthly</label>
              <p className="text-[10px] text-mist-2">$19/mo plan credit allocation</p>
              <input
                type="number"
                min={1}
                value={Number(settings.clipper_monthly_credits ?? 300)}
                onChange={(e) => setValue('clipper_monthly_credits', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Default: 300 credits</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Studio Monthly</label>
              <p className="text-[10px] text-mist-2">$49/mo plan credit allocation</p>
              <input
                type="number"
                min={1}
                value={Number(settings.studio_monthly_credits ?? 1200)}
                onChange={(e) => setValue('studio_monthly_credits', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Default: 1,200 credits</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Min Credits To Run</label>
              <p className="text-[10px] text-mist-2">Minimum required balance</p>
              <input
                type="number"
                min={1}
                value={Number(settings.min_credits_required ?? 1)}
                onChange={(e) => setValue('min_credits_required', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">1 credit = 1 final video</span>
            </div>
          </div>
        </section>

        {/* 4. Rendering Engine & Server Specs */}
        <section className="glass-card !p-6">
          <div className="flex items-center gap-2.5 border-b border-hair/30 pb-4">
            <Layers className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-display text-lg font-semibold">Video Rendering & Processing Engine</h2>
              <p className="text-xs text-mist font-light">FFmpeg encoding concurrency and facial tracking controls</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Parallel Workers</label>
              <p className="text-[10px] text-mist-2">Concurrent FFmpeg render lanes</p>
              <input
                type="number"
                min={1}
                max={8}
                value={Number(settings.render_parallel ?? 4)}
                onChange={(e) => setValue('render_parallel', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Optimized for EC2 CPU cores</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Max Direct Upload (MB)</label>
              <p className="text-[10px] text-mist-2">Max allowed video file size</p>
              <input
                type="number"
                min={50}
                max={4000}
                value={Number(settings.max_upload_mb ?? 500)}
                onChange={(e) => setValue('max_upload_mb', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Default: 500 MB (Cloudflare R2)</span>
            </div>

            <div className="rounded-xl border border-hair/40 bg-surface/40 p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-mist">Stale Job Threshold</label>
              <p className="text-[10px] text-mist-2">Minutes before auto-cleanup</p>
              <input
                type="number"
                min={5}
                max={120}
                value={Number(settings.stale_job_minutes ?? 30)}
                onChange={(e) => setValue('stale_job_minutes', Number(e.target.value))}
                className="input-lux mt-2 font-mono"
              />
              <span className="text-[10px] text-mist-2 mt-1 block">Auto-recovers interrupted jobs</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-hair/40 bg-surface/40 p-4">
            <div>
              <p className="font-medium text-sm">InsightFace AI Dominant-Speaker Tracking</p>
              <p className="text-xs text-mist-2">Follows moving speakers dynamically across 9:16 vertical canvas</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(settings.pipeline_premium)}
              onClick={() => setValue('pipeline_premium', !settings.pipeline_premium)}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                settings.pipeline_premium ? 'bg-gradient-to-r from-champagne to-gold' : 'bg-surface'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  settings.pipeline_premium ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </section>

        {/* 5. YouTube Bot Wall Bypass Cookies */}
        <section className="glass-card !p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair/30 pb-4">
            <div className="flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-gold" />
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <span>YouTube Bot Wall Bypass</span>
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold uppercase tracking-wider">
                    {settings.youtube_cookies ? 'Active' : 'Unconfigured'}
                  </span>
                </h2>
                <p className="text-xs text-mist font-light">
                  Paste your exported YouTube <code className="text-gold">cookies.txt</code> to bypass YouTube datacenter bot detection completely
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              rows={5}
              value={String(settings.youtube_cookies || '')}
              onChange={(e) => setValue('youtube_cookies', e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;# Exported using 'Get cookies.txt LOCALLY' extension&#10;.youtube.com  TRUE  /  TRUE  1789322654  LOGIN_INFO  ..."
              className="input-lux font-mono text-xs w-full leading-relaxed resize-y"
            />
            <p className="mt-2 text-[11px] text-mist-2">
              💡 <strong>How to get this:</strong> Install the free Chrome/Edge extension <span className="text-champagne font-medium">Get cookies.txt LOCALLY</span>, visit YouTube while logged in, click Export, and paste the text above. Automatically synced to <code className="text-white/80">/opt/nology/cookies.txt</code> on save.
            </p>
          </div>
        </section>

        {/* 6. Clipping Campaigns & Bounty Pools */}
        <section className="glass-card !p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair/30 pb-4">
            <div className="flex items-center gap-2.5">
              <Megaphone className="h-5 w-5 text-gold" />
              <div>
                <h2 className="font-display text-lg font-semibold">Clipping Campaigns & Bounty Pools</h2>
                <p className="text-xs text-mist font-light">
                  Add and configure creator reward programs (Whop Content Rewards, Brand Deals, and Bounties)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/settings"
                className="btn-lux btn-gold !py-2 !px-3.5 !text-xs flex items-center gap-1.5"
              >
                <span>Add & Manage Campaigns</span>
              </Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-mist leading-relaxed font-light">
            Creators on Clipzila can link videos to active campaigns and submit clips. You can configure campaigns with custom rates ($/1K views), total budgets, platforms (TikTok, YouTube Shorts, Reels), and deadlines.
          </p>
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-champagne/20 bg-champagne/5 px-4 py-3 text-xs font-light text-mist">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-champagne" />
          Settings are read in real-time by the worker and web app. Changes apply immediately to subsequent video clipping jobs.
        </p>
      </div>
    </div>
  )
}