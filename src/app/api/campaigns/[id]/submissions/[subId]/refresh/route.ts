import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { verifyAndTrackSubmission } from '@/lib/campaign-tracker'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId, subId } = await params

    const submission = await prisma.campaignSubmission.findUnique({
      where: { id: subId },
      include: { campaign: true },
    })

    if (!submission || submission.campaignId !== campaignId) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const isOwnerOrAdmin =
      session.user.role === 'ADMIN' ||
      submission.campaign.userId === session.user.id ||
      submission.userId === session.user.id

    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const limited = await enforceRateLimit(apiMutationLimiter, `sub-ref:${session.user.id}`)
    if (limited) return limited

    const refreshed = await verifyAndTrackSubmission(subId)

    return NextResponse.json({
      success: true,
      submission: refreshed,
      message: 'Views updated and requirements verified successfully.',
    })
  } catch (error) {
    console.error('Submission refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh submission views' }, { status: 500 })
  }
}
