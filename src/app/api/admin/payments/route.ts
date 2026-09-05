import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const typeParam = searchParams.get('type')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Prisma.CreditTransactionWhereInput = {}
    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ]
    }
    const type = z.enum(['purchase', 'usage', 'refund', 'bonus']).safeParse(typeParam)
    if (type.success) where.type = type.data

    const [transactions, transactionTotal, subscriptionUsers, webhooks, processedToday] =
      await Promise.all([
        prisma.creditTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { user: { select: { id: true, email: true, name: true } } },
        }),
        prisma.creditTransaction.count({ where }),
        prisma.user.count({ where: { subscriptionStatus: { equals: 'active' } } }),
        prisma.processedWebhookEvent.findMany({
          orderBy: { processedAt: 'desc' },
          take: 10,
          select: { stripeEventId: true, processedAt: true },
        }),
        prisma.processedWebhookEvent.count({
          where: {
            processedAt: {
              gte: new Date(new Date().setUTCHours(0, 0, 0, 0)),
            },
          },
        }),
      ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total: transactionTotal,
        totalPages: Math.ceil(transactionTotal / limit),
      },
      summary: {
        activeSubscriptions: subscriptionUsers,
        webhooksTotal: await prisma.processedWebhookEvent.count(),
        webhooksToday: processedToday,
      },
      recentWebhooks: webhooks,
    })
  } catch (error) {
    console.error('Admin payments fetch error:', error)
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 })
  }
}