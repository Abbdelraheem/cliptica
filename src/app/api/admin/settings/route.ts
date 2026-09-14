import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { writeFile, unlink } from 'fs/promises'

type SettingValue = string | boolean | number

const SETTING_KEYS = [
  'pipeline_premium',
  'min_credits_required',
  'max_upload_mb',
  'clips_per_video',
  'clip_target_seconds',
  'clip_min_seconds',
  'clip_max_seconds',
  'render_parallel',
  'stale_job_minutes',
  'groq_score_model',
  'whisper_model',
  'groq_api_key',
  'openai_api_key',
  'free_starting_credits',
  'clipper_monthly_credits',
  'studio_monthly_credits',
  'youtube_cookies',
] as const

type SettingKey = (typeof SETTING_KEYS)[number]

const KNOWN_KEYS: { key: SettingKey; kind: 'bool' | 'number' | 'string'; label: string }[] = [
  { key: 'pipeline_premium', kind: 'bool', label: 'Premium pipeline (InsightFace & Dynamic Crop)' },
  { key: 'min_credits_required', kind: 'number', label: 'Min credits to run a job' },
  { key: 'max_upload_mb', kind: 'number', label: 'Max upload size (MB)' },
  { key: 'clips_per_video', kind: 'number', label: 'Clips generated per video' },
  { key: 'clip_min_seconds', kind: 'number', label: 'Min viral clip duration (s)' },
  { key: 'clip_max_seconds', kind: 'number', label: 'Max viral clip duration (s - up to 90s)' },
  { key: 'clip_target_seconds', kind: 'number', label: 'Default clip duration anchor (s)' },
  { key: 'render_parallel', kind: 'number', label: 'Parallel rendering workers' },
  { key: 'stale_job_minutes', kind: 'number', label: 'Stale job threshold (min)' },
  { key: 'groq_score_model', kind: 'string', label: 'Groq AI Scoring Model' },
  { key: 'whisper_model', kind: 'string', label: 'Transcription Model' },
  { key: 'groq_api_key', kind: 'string', label: 'Groq API Key' },
  { key: 'openai_api_key', kind: 'string', label: 'OpenAI Fallback Key' },
  { key: 'free_starting_credits', kind: 'number', label: 'Free account starting credits' },
  { key: 'clipper_monthly_credits', kind: 'number', label: 'Clipper plan monthly credits' },
  { key: 'studio_monthly_credits', kind: 'number', label: 'Studio plan monthly credits' },
  { key: 'youtube_cookies', kind: 'string', label: 'YouTube Cookies (Netscape format)' },
]

const defaults: Record<string, SettingValue> = {
  pipeline_premium: true,
  min_credits_required: 1,
  max_upload_mb: 500,
  clips_per_video: 3,
  clip_min_seconds: 15,
  clip_max_seconds: 90,
  clip_target_seconds: 45,
  render_parallel: 4,
  stale_job_minutes: 30,
  groq_score_model: 'allam-2-7b',
  whisper_model: 'whisper-large-v3-turbo',
  groq_api_key: '',
  openai_api_key: '',
  free_starting_credits: 40,
  clipper_monthly_credits: 300,
  studio_monthly_credits: 1200,
  youtube_cookies: '',
}

function parseValue(key: string, raw: string | null, kind: 'bool' | 'number' | 'string'): SettingValue {
  if (raw === null) return defaults[key]
  if (kind === 'bool') return raw === 'true'
  if (kind === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  return raw
}

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rows = await prisma.setting.findMany()
    const store = new Map(rows.map((r) => [r.key, r.value]))

    const settings = Object.fromEntries(
      KNOWN_KEYS.map(({ key, kind }) => [key, parseValue(key, store.get(key) ?? null, kind)])
    )

    return NextResponse.json({ settings, keys: KNOWN_KEYS })
  } catch (error) {
    console.error('Admin settings GET error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

const patchSchema = z.record(z.enum(SETTING_KEYS), z.union([z.boolean(), z.number(), z.string()]))

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const entries: { key: SettingKey; kind: 'bool' | 'number' | 'string' }[] = KNOWN_KEYS.filter(
      (k) => parsed.data[k.key] !== undefined
    )

    await prisma.$transaction(
      entries.map(({ key, kind }) => {
        const value = parsed.data[key] as SettingValue
        const stored =
          kind === 'bool' ? (value ? 'true' : 'false') : String(typeof value === 'number' ? value : value)
        return prisma.setting.upsert({
          where: { key },
          update: { value: stored },
          create: { key, value: stored },
        })
      })
    )

    if (parsed.data.youtube_cookies !== undefined) {
      try {
        const content = String(parsed.data.youtube_cookies || '').trim()
        if (content) {
          await writeFile('/opt/nology/cookies.txt', content, 'utf8')
        } else {
          await unlink('/opt/nology/cookies.txt').catch(() => {})
        }
      } catch {
        /* ignore file sync failure on dev environments */
      }
    }

    const rows = await prisma.setting.findMany()
    const store = new Map(rows.map((r) => [r.key, r.value]))
    const settings = Object.fromEntries(
      KNOWN_KEYS.map(({ key, kind }) => [key, parseValue(key, store.get(key) ?? null, kind)])
    )

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Admin settings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
