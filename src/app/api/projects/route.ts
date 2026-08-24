import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const MIN_CREDITS_REQUIRED = Number(process.env.MIN_CREDITS_REQUIRED ?? 10)

export const FRAMINGS = ['smart', 'face', 'center', 'blur', 'letter', 'variety'] as const
export const LANGUAGES = ['auto', 'en', 'ar', 'es', 'fr', 'de', 'tr', 'hi', 'pt'] as const

const createSchema = z.object({
  sourceType: z.enum(['url', 'file']),
  url: z.string().url().max(500).optional(),
  fileKey: z.string().max(300).optional(),
  fileName: z.string().max(200).optional(),
  title: z.string().min(1).max(120).optional(),
  instructions: z.string().max(2000).optional(),
  /** "mm:ss" or seconds — start clipping here */
  clipFrom: z.union([z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/), z.number().int().min(0)]).optional(),
  framing: z.enum(FRAMINGS).default('smart'),
  language: z.enum(LANGUAGES).default('auto'),
  motionFx: z.boolean().default(false),
})

function parseClipFrom(v?: string | number): number {
  if (v === undefined) return 0
  if (typeof v === 'number') return v
  const parts = v.split(':').map(Number)
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data

    if (d.sourceType === 'url' && !d.url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }
    // Security: uploads may only reference the user's own R2 prefix.
    if (d.sourceType === 'file') {
      if (!d.fileKey || !d.fileKey.startsWith(`uploads/${session.user.id}/`)) {
        return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Eligibility gate only — actual usage charged by the worker on real duration.
    if (user.credits < MIN_CREDITS_REQUIRED) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: MIN_CREDITS_REQUIRED, available: user.credits },
        { status: 402 }
      )
    }

    const title =
      d.title ??
      (d.sourceType === 'url' && d.url
        ? `Project from ${safeHost(d.url)}`
        : (d.fileName ?? 'Uploaded project'))

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        title,
        sourceUrl: d.sourceType === 'url' ? d.url : null,
        sourceFile: d.sourceType === 'file' ? d.fileKey : null,
        duration: 0, // probed by the worker
        instructions: d.instructions,
        clipFrom: parseClipFrom(d.clipFrom),
        framing: d.framing,
        language: d.language,
        motionFx: d.motionFx,
        status: 'PENDING',
      },
    })

    await prisma.processingJob.create({
      data: { projectId: project.id, type: 'clip_generation', status: 'queued' },
    })

    return NextResponse.json({ id: project.id }, { status: 201 })
  } catch (error) {
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
