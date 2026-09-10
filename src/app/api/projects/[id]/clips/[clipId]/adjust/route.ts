import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'
import { clipAdjustSchema, calcClipAdjustCost } from '@/lib/validation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimited = await enforceRateLimit(apiMutationLimiter, session.user.id)
    if (rateLimited) return rateLimited

    const { id: projectId, clipId } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = clipAdjustSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { start, end, captionStyle } = parseResult.data

    // Fetch project and clip, ensuring user owns both
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      select: { id: true, duration: true, captionStyle: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const clip = await prisma.clip.findFirst({
      where: { id: clipId, projectId: project.id, userId: session.user.id },
    })

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Boundary check: clip end cannot exceed source video duration (+2s tolerance for floating point rounding)
    if (project.duration > 0 && Math.round(end) > project.duration + 2) {
      return NextResponse.json(
        {
          error: `End time (${Math.round(end)}s) exceeds source video duration (${project.duration}s)`,
        },
        { status: 400 }
      )
    }

    // Credit policy: free within 15 minutes of clip creation, 1 credit thereafter
    const cost = calcClipAdjustCost(clip.createdAt)

    if (cost > 0) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
      })
      if (!user || user.credits < cost) {
        return NextResponse.json(
          {
            error: 'Insufficient credits. Clip adjustment costs 1 credit after the initial 15-minute free edit window.',
            requiredCredits: cost,
            currentCredits: user?.credits ?? 0,
          },
          { status: 402 }
        )
      }
    }

    const finalStyle = captionStyle || clip.captionStyle || project.captionStyle || 'hormozi'

    const job = await prisma.$transaction(async (tx) => {
      if (cost > 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { credits: { decrement: cost } },
        })
        await tx.creditTransaction.create({
          data: {
            userId: session.user.id,
            amount: -cost,
            type: 'usage',
            description: `Clip re-trim adjustment for "${clip.title}" (${Math.round(start)}s-${Math.round(end)}s)`,
            metadata: {
              projectId: project.id,
              clipId: clip.id,
              start: Math.round(start),
              end: Math.round(end),
            },
          },
        })
      }

      await tx.clip.update({
        where: { id: clip.id },
        data: {
          status: 'GENERATING',
          captionStyle: finalStyle,
        },
      })

      return tx.processingJob.create({
        data: {
          projectId: project.id,
          type: 'clip_adjust',
          status: 'queued',
          progress: 0,
          result: {
            clipId: clip.id,
            start: Math.round(start),
            end: Math.round(end),
            captionStyle: finalStyle,
            chargedCredits: cost,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Clip adjustment queued for fast re-trim',
      jobId: job.id,
      clipId: clip.id,
      start: Math.round(start),
      end: Math.round(end),
      duration: Math.round(end - start),
      captionStyle: finalStyle,
      chargedCredits: cost,
    })
  } catch (error) {
    console.error('Clip adjust error:', error)
    return NextResponse.json({ error: 'Failed to queue clip adjustment' }, { status: 500 })
  }
}
