import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type SettingValue = string | boolean | number

const SETTING_KEYS = [
  'motion_fx',
  'pipeline_premium',
  'min_credits_required',
  'max_upload_mb',
  'clips_per_video',
  'clip_target_seconds',
  'render_parallel',
  'stale_job_minutes',
] as const

type SettingKey = (typeof SETTING_KEYS)[number]

const KNOWN_KEYS: { key: SettingKey; kind: 'bool' | 'number' | 'string'; label: string }[] = [
  { key: 'motion_fx', kind: 'bool', label: 'Motion FX enabled' },
  { key: 'pipeline_premium', kind: 'bool', label: 'Premium pipeline' },
  { key: 'min_credits_required', kind: 'number', label: 'Min credits to run a job' },
  { key: 'max_upload_mb', kind: 'number', label: 'Max upload size (MB)' },
  { key: 'clips_per_video', kind: 'number', label: 'Clips per video' },
  { key: 'clip_target_seconds', kind: 'number', label: 'Clip target length (s)' },
  { key: 'render_parallel', kind: 'number', label: 'Parallel renders' },
  { key: 'stale_job_minutes', kind: 'number', label: 'Stale job threshold (min)' },
]

const defaults: Record<string, SettingValue> = {
  motion_fx: true,
  pipeline_premium: true,
  min_credits_required: 10,
  max_upload_mb: 500,
  clips_per_video: 6,
  clip_target_seconds: 38,
  render_parallel: 4,
  stale_job_minutes: 30,
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
