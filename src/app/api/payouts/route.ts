import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'
import { payoutCreateSchema } from '@/lib/validation'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const status = z.enum(['PENDING', 'APPROVED', 'PAID']).safeParse(statusParam)
    const campaignId = searchParams.get('campaignId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Prisma.PayoutWhereInput = { userId: session.user.id }
    if (status.success) where.status = status.data
    if (campaignId) where.campaignId = campaignId

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          campaign: { select: { id: true, name: true } },
          clip: { select: { id: true, title: true, projectId: true } },
        },
      }),
      prisma.payout.count({ where }),
    ])

    return NextResponse.json({
      payouts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Payouts fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await enforceRateLimit(apiMutationLimiter, `pay:${session.user.id}`)
    if (limited) return limited

    const body = await request.json()
    const validated = payoutCreateSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { campaignId, clipId, amount, periodStart, periodEnd, notes } = validated.data

    if (periodEnd < periodStart) {
      return NextResponse.json({ error: 'Period end must be after period start' }, { status: 400 })
    }

    const payout = await prisma.payout.create({
      data: {
        userId: session.user.id,
        campaignId: campaignId || null,
        clipId: clipId || null,
        amount,
        status: 'PENDING',
        periodStart,
        periodEnd,
        notes,
      },
    })

    return NextResponse.json({ payout })
  } catch (error) {
    console.error('Payout creation error:', error)
    return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 })
  }
}