import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['WHOP_CONTENT_REWARDS', 'BRAND_DEAL', 'OWN_CHANNEL']).optional(),
  platform: z.string().optional(),
  ratePer1k: z.number().positive().optional(),
  flatFee: z.number().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
  deadline: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const limited = await enforceRateLimit(apiMutationLimiter, `camp-patch:${session.user.id}`)
    if (limited) return limited

    const body = await request.json()
    const validated = updateSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.flatten() }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = { ...validated.data }
    if (validated.data.deadline !== undefined) {
      data.deadline = validated.data.deadline ? new Date(validated.data.deadline) : null
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data,
    })

    return NextResponse.json({ campaign: updated })
  } catch (error) {
    console.error('Campaign update error:', error)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.campaign.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    await prisma.campaign.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Campaign delete error:', error)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
