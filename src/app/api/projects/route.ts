import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'
import { parseClipFrom } from '@/lib/validation'
import { planForRole } from '@/lib/stripe'
import { getSettingNumber } from '@/lib/settings'

const FRAMINGS = ['smart', 'face', 'center', 'blur', 'letter', 'variety'] as const
const LANGUAGES = ['auto', 'en', 'ar', 'es', 'fr', 'de', 'tr', 'hi', 'pt'] as const
const CAPTION_STYLES = [
  'hormozi',
  'bold_impact',
  'bounce_side',
  'pill_box',
  'tiktok_classic',
  'clean_minimal',
  'classic_subtitle',
  'slow_fade',
  'cinematic_caps',
  'podcast_soft',
  'neon_highlight',
  'highlighter',
  'typewriter',
  'two_tone',
  'glitch_flicker',
] as const
const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const

const createSchema = z.object({
  sourceType: z.enum(['url', 'file']),
  // Lenient: trim whitespace and append a protocol when the user pastes a bare
  // domain/short-link (e.g. "youtu.be/xyz") — otherwise zod .url() rejects it
  // with a confusing "Invalid input".
  url: z
    .string()
    .max(500)
    .transform((v) => v.trim())
    .refine((v) => v.length === 0 || /^[0-9a-zA-Z.\-/?:&=+%_~#@]+$/.test(v), 'Invalid URL characters')
    .optional(),
  fileKey: z.string().max(300).optional(),
  fileName: z.string().max(200).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  instructions: z.string().max(2000).optional(),
  /** "mm:ss" or seconds — start clipping here */
  clipFrom: z.union([z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/), z.number().int().min(0)]).optional(),
  framing: z.enum(FRAMINGS).default('smart'),
  language: z.enum(LANGUAGES).default('auto'),
  captionStyle: z.enum(CAPTION_STYLES).default('hormozi'),
  aspectRatio: z.enum(ASPECT_RATIOS).default('9:16'),
  motionFx: z.boolean().default(false),
})

/** Normalise a pasted link into an absolute https URL. Returns null if invalid. */
function normaliseUrl(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        duration: true,
        createdAt: true,
        _count: { select: { clips: true } },
        clips: { select: { viralScore: true }, orderBy: { viralScore: 'desc' }, take: 1 },
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Projects list error:', error)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await enforceRateLimit(apiMutationLimiter, `proj:${session.user.id}`)
    if (limited) return limited

    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data

    let sourceUrl: string | null = null
    if (d.sourceType === 'url') {
      const url = d.url ? normaliseUrl(d.url) : null
      if (!url) {
        return NextResponse.json({ error: 'Paste a valid video link' }, { status: 400 })
      }
      sourceUrl = url
    }
    // Security: uploads may only reference the user's own R2 prefix.
    if (d.sourceType === 'file') {
      if (!d.fileKey || !d.fileKey.startsWith(`uploads/${session.user.id}/`)) {
        return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Run the independent gate checks in parallel (each is a DB round-trip to a
    // remote database; sequential execution would compound ~1s each).
    const plan = planForRole(user.role)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [minCredits, todaysCount] = await Promise.all([
      getSettingNumber('min_credits_required', process.env.MIN_CREDITS_REQUIRED, 10),
      plan
        ? prisma.project.count({ where: { userId: session.user.id, createdAt: { gte: startOfDay } } })
        : Promise.resolve(0),
    ])

    if (user.credits < minCredits) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: minCredits, available: user.credits },
        { status: 402 }
      )
    }

    // Per-plan daily cap — keeps one account from monopolising the worker.
    if (plan && todaysCount >= plan.maxDailyVideos) {
      return NextResponse.json(
        { error: 'Daily project limit reached', limit: plan.maxDailyVideos },
        { status: 429 }
      )
    }

    // AI motion graphics is an admin-only feature with a global kill switch.
    let motionFx = d.motionFx
    if (motionFx) {
      if (user.role !== 'ADMIN') {
        motionFx = false
      } else {
        const setting = await prisma.setting.findUnique({ where: { key: 'motion_fx' } })
        if (setting && setting.value !== 'true') motionFx = false
      }
    }

    const title =
      d.title ??
      (d.sourceType === 'url' && sourceUrl
        ? `Project from ${safeHost(sourceUrl)}`
        : (d.fileName ?? 'Uploaded project'))

    // Atomic credit reservation: hold minCredits upfront so concurrent requests
    // cannot overdraft the balance. The worker deducts any remaining balance
    // upon completion or refunds minCredits if the job fails.
    const project = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
      })
      if (!u || u.credits < minCredits) {
        throw new Error('INSUFFICIENT_CREDITS')
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: minCredits } },
      })

      await tx.creditTransaction.create({
        data: {
          userId: session.user.id,
          amount: -minCredits,
          type: 'usage',
          description: `Credit reservation for "${title.slice(0, 60)}"`,
          metadata: { minCreditsReserved: minCredits },
        },
      })

      const p = await tx.project.create({
        data: {
          userId: session.user.id,
          title,
          sourceUrl: d.sourceType === 'url' ? sourceUrl : null,
          sourceFile: d.sourceType === 'file' ? d.fileKey : null,
          duration: 0, // probed by the worker
          instructions: d.instructions,
          clipFrom: parseClipFrom(d.clipFrom),
          framing: d.framing,
          language: d.language,
          captionStyle: d.captionStyle,
          aspectRatio: d.aspectRatio,
          motionFx,
          status: 'PENDING',
          creditsUsed: minCredits, // tracks reserved credits
        },
      })

      await tx.processingJob.create({
        data: { projectId: p.id, type: 'clip_generation', status: 'queued' },
      })

      return p
    })

    return NextResponse.json({ id: project.id }, { status: 201 })
  } catch (error) {
    if ((error as Error)?.message === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }
    console.error('Project creation error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}
