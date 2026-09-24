import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { detectPlatform, verifyAndTrackSubmission } from '@/lib/campaign-tracker'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'

const submitSchema = z.object({
  postUrl: z.string().url(),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, userId: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const isOwnerOrAdmin = session.user.role === 'ADMIN' || campaign.userId === session.user.id

    const submissions = await prisma.campaignSubmission.findMany({
      where: isOwnerOrAdmin ? { campaignId } : { campaignId, userId: session.user.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ submissions, isOwnerOrAdmin })
  } catch (error) {
    console.error('Submissions fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign || !campaign.isActive) {
      return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 404 })
    }

    const limited = await enforceRateLimit(apiMutationLimiter, `sub:${session.user.id}`)
    if (limited) return limited

    const body = await req.json().catch(() => null)
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please provide a valid video link' }, { status: 400 })
    }

    const cleanUrl = parsed.data.postUrl.trim()
    const platform = detectPlatform(cleanUrl)

    if (platform === 'UNKNOWN') {
      return NextResponse.json(
        { error: 'Unsupported link. Please submit a valid video post from TikTok, Instagram Reels, or YouTube Shorts.' },
        { status: 400 }
      )
    }

    // Check if user already submitted this URL
    const existing = await prisma.campaignSubmission.findFirst({
      where: { campaignId, postUrl: cleanUrl },
    })
    if (existing) {
      return NextResponse.json({ error: 'This video link has already been submitted to this campaign.' }, { status: 409 })
    }

    // Create submission record
    const submission = await prisma.campaignSubmission.create({
      data: {
        campaignId,
        userId: session.user.id,
        postUrl: cleanUrl,
        platform,
        status: 'PENDING',
      },
    })

    // Run view verification in background or await immediate snapshot
    const verified = await verifyAndTrackSubmission(submission.id).catch((e) => {
      console.warn('Initial tracking failed:', e)
      return submission
    })

    return NextResponse.json({
      success: true,
      submission: verified ?? submission,
      message: 'Video submission recorded successfully. Views are now being tracked automatically.',
    })
  } catch (error) {
    console.error('Submission creation error:', error)
    return NextResponse.json({ error: 'Failed to submit video' }, { status: 500 })
  }
}
