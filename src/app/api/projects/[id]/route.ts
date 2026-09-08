import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { r2PresignGet } from '@/lib/r2'

/** Extract the R2 object key from a stored URL (`.../bucket/<key>`). */
function r2KeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // path looks like /<bucket>/<key...> — strip the leading bucket segment.
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return parts.slice(1).join('/')
  } catch {
    return null
  }
}

/** Replace private R2 storage URLs with presigned public-read URLs. */
function signClipMedia<T extends { videoUrl?: string | null; thumbnailUrl?: string | null; exportUrl?: string | null }>(clip: T): T {
  const signed = { ...clip }
  for (const field of ['videoUrl', 'thumbnailUrl', 'exportUrl'] as const) {
    const url = signed[field]
    if (!url) continue
    const key = r2KeyFromUrl(url)
    if (!key) continue
    try {
      signed[field] = r2PresignGet(key)
    } catch {
      /* keep original if signing fails */
    }
  }
  return signed
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const project = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
      include: {
        clips: {
          orderBy: { viralScore: 'desc' },
        },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, progress: true, error: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      project: {
        ...project,
        clips: project.clips.map(signClipMedia),
      },
    })
  } catch (error) {
    console.error('Project fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}
