import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, CheckoutStatus } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const statusParam = searchParams.get('status')?.trim()?.toUpperCase()
    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const rawLimit = parseInt(searchParams.get('limit') || '25', 10)
    const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 25

    const where: Prisma.CheckoutSessionWhereInput = {}

    if (statusParam && ['INITIATED', 'ABANDONED', 'COMPLETED'].includes(statusParam)) {
      where.status = statusParam as CheckoutStatus
    }

    if (q) {
      where.OR = [
        { userEmail: { contains: q, mode: 'insensitive' } },
        { userName: { contains: q, mode: 'insensitive' } },
        { itemName: { contains: q, mode: 'insensitive' } },
        { itemId: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Try-catch wrapped prisma queries in case table is not yet migrated on the current environment
    let sessions: any[] = []
    let totalSessions = 0
    let totalCount = 0
    let abandonedCount = 0
    let initiatedCount = 0
    let completedCount = 0
    let lostRevenue = 0
    let abandonedEmails: string[] = []

    try {
      const [
        fetchedSessions,
        count,
        allStats,
        abandonedList,
      ] = await Promise.all([
        prisma.checkoutSession.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                credits: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.checkoutSession.count({ where }),
        prisma.checkoutSession.groupBy({
          by: ['status'],
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.checkoutSession.findMany({
          where: { status: 'ABANDONED' },
          select: { userEmail: true, amount: true },
          distinct: ['userEmail'],
          take: 500,
        }),
      ])

      sessions = fetchedSessions
      totalSessions = count

      for (const stat of allStats) {
        totalCount += stat._count._all
        if (stat.status === 'ABANDONED') {
          abandonedCount = stat._count._all
          lostRevenue = Number(stat._sum.amount || 0)
        } else if (stat.status === 'INITIATED') {
          initiatedCount = stat._count._all
        } else if (stat.status === 'COMPLETED') {
          completedCount = stat._count._all
        }
      }

      abandonedEmails = Array.from(new Set(abandonedList.map((item) => item.userEmail).filter(Boolean)))
    } catch (dbErr) {
      console.warn('[admin-checkout-tracking] Table query skipped (needs migration or empty):', dbErr)
    }

    const conversionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    const abandonmentRate = totalCount > 0 ? Math.round((abandonedCount / totalCount) * 100) : 0

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total: totalSessions,
        totalPages: Math.ceil(totalSessions / limit) || 1,
      },
      metrics: {
        total: totalCount,
        initiated: initiatedCount,
        abandoned: abandonedCount,
        completed: completedCount,
        lostRevenue,
        conversionRate,
        abandonmentRate,
      },
      abandonedEmails,
    })
  } catch (error) {
    console.error('Admin checkout tracking error:', error)
    return NextResponse.json({ error: 'Failed to load checkout tracking' }, { status: 500 })
  }
}
