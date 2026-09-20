import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const purgeSchema = z.object({
  keepClipIds: z.array(z.string().min(1)).min(1, 'Please select at least one clip to keep'),
})

export async function POST(
  request: Request,
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
      select: { id: true, title: true, creditsUsed: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = purgeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 }
      )
    }

    const { keepClipIds } = parsed.data

    // Fetch all clips for this project to verify
    const allClips = await prisma.clip.findMany({
      where: { projectId: id },
      select: { id: true },
    })

    const allClipIds = allClips.map((c) => c.id)
    const validKeepIds = keepClipIds.filter((cid) => allClipIds.includes(cid))

    if (validKeepIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid clip must be selected to keep' },
        { status: 400 }
      )
    }

    const clipsToDelete = allClipIds.filter((cid) => !validKeepIds.includes(cid))

    // Credit calculation: 1 credit per chosen final video.
    // The initial project creation covered project.creditsUsed (defaults to 1 credit).
    const totalCost = validKeepIds.length
    const alreadyPaid = Math.max(0, project.creditsUsed ?? 1)
    const diff = totalCost - alreadyPaid

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
      })

      if (!user) throw new Error('User not found')

      if (diff > 0 && user.credits < diff) {
        const err = new Error(
          `Insufficient credits: Keeping ${totalCost} final videos costs ${totalCost} credits (1 credit per final video). You have ${user.credits} credits, but need ${diff} more credit(s).`
        )
        ;(err as unknown as { statusCode: number }).statusCode = 402
        throw err
      }

      if (diff > 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { credits: { decrement: diff } },
        })

        await tx.creditTransaction.create({
          data: {
            userId: session.user.id,
            amount: -diff,
            type: 'usage',
            description: `Final video selection for "${project.title}" (${totalCost} final videos kept, 1 credit each)`,
            metadata: { projectId: id, keptCount: totalCost, additionalCredits: diff },
          },
        })
      } else if (diff < 0) {
        const refund = Math.abs(diff)
        await tx.user.update({
          where: { id: session.user.id },
          data: { credits: { increment: refund } },
        })

        await tx.creditTransaction.create({
          data: {
            userId: session.user.id,
            amount: refund,
            type: 'refund',
            description: `Refund for unselected clips in "${project.title}"`,
            metadata: { projectId: id, refundAmount: refund },
          },
        })
      }

      await tx.project.update({
        where: { id },
        data: { creditsUsed: totalCost },
      })

      let deletedCount = 0
      if (clipsToDelete.length > 0) {
        const delRes = await tx.clip.deleteMany({
          where: {
            projectId: id,
            id: { in: clipsToDelete },
          },
        })
        deletedCount = delRes.count
      }

      const updatedUser = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
      })

      return {
        kept: validKeepIds.length,
        deleted: deletedCount,
        creditsDeducted: diff > 0 ? diff : 0,
        creditsRefunded: diff < 0 ? Math.abs(diff) : 0,
        totalCreditsUsed: totalCost,
        remainingCredits: updatedUser?.credits ?? 0,
      }
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: `Kept ${result.kept} final video(s) (1 credit each). ${
        result.creditsDeducted > 0
          ? `Deducted ${result.creditsDeducted} additional credit(s).`
          : ''
      } ${result.deleted > 0 ? `Deleted ${result.deleted} unselected clip(s).` : ''}`.trim(),
    })
  } catch (error: unknown) {
    console.error('Purge unselected clips error:', error)
    const err = error as { statusCode?: number; message?: string }
    if (err?.statusCode === 402) {
      return NextResponse.json({ error: err.message }, { status: 402 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to purge clips' },
      { status: 500 }
    )
  }
}
