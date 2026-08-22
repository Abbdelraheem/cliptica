import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { userId: session.user.id }
    if (status) where.status = status
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

    const body = await request.json()
    const { campaignId, clipId, amount, periodStart, periodEnd, notes } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const payout = await prisma.payout.create({
      data: {
        userId: session.user.id,
        campaignId: campaignId || null,
        clipId: clipId || null,
        amount,
        status: 'PENDING',
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        notes,
      },
    })

    return NextResponse.json({ payout })
  } catch (error) {
    console.error('Payout creation error:', error)
    return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 })
  }
}