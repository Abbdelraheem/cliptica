import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { r2PresignGet } from '@/lib/r2'

/** Extract the R2 object key from a stored URL (`.../bucket/<key>`). */
function r2KeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return parts.slice(1).join('/')
  } catch {
    return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, clipId } = await params

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      select: { id: true, creditsUsed: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const clip = await prisma.clip.findFirst({
      where: { id: clipId, projectId: project.id, userId: session.user.id },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        exportUrl: true,
        exportedAt: true,
        captionData: true,
      },
    })

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    const cData = (clip.captionData ?? {}) as { unlocked?: boolean }
    const isUnlocked =
      cData.unlocked === true ||
      (cData.unlocked !== false && (project.creditsUsed ?? 1) > 0)

    if (!isUnlocked) {
      return NextResponse.json(
        { error: 'Please select this clip and confirm credit deduction first to unlock download.' },
        { status: 402 }
      )
    }

    // Signed preview URL helper
    let signedPreviewUrl = clip.videoUrl
    if (clip.videoUrl) {
      const k = r2KeyFromUrl(clip.videoUrl)
      if (k) {
        try {
          signedPreviewUrl = r2PresignGet(k)
        } catch {
          // Keep raw if presigning fails
        }
      }
    }

    // 1. If HD exportUrl already exists and is ready
    if (clip.exportUrl) {
      let signedExportUrl = clip.exportUrl
      const k = r2KeyFromUrl(clip.exportUrl)
      if (k) {
        try {
          signedExportUrl = r2PresignGet(k)
        } catch {
          // Keep raw
        }
      }
      return NextResponse.json({
        ready: true,
        downloadUrl: signedExportUrl,
        previewUrl: signedPreviewUrl,
        title: clip.title,
      })
    }

    // 2. If HD version is not yet rendered, check for an existing in-progress job
    const activeJob = await prisma.processingJob.findFirst({
      where: {
        projectId: project.id,
        type: 'clip_render_hd',
        status: { in: ['queued', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (activeJob && (activeJob.result as { clipId?: string })?.clipId === clip.id) {
      return NextResponse.json({
        ready: false,
        status: activeJob.status,
        progress: activeJob.progress,
        jobId: activeJob.id,
        previewUrl: signedPreviewUrl,
      })
    }

    // 3. Otherwise dispatch a new clip_render_hd job
    const job = await prisma.processingJob.create({
      data: {
        projectId: project.id,
        type: 'clip_render_hd',
        status: 'queued',
        progress: 0,
        result: { clipId: clip.id },
      },
    })

    return NextResponse.json({
      ready: false,
      status: 'queued',
      progress: 0,
      jobId: job.id,
      previewUrl: signedPreviewUrl,
    })
  } catch (error) {
    console.error('Clip download route error:', error)
    return NextResponse.json({ error: 'Failed to process download request' }, { status: 500 })
  }
}
