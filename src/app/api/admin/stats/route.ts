import { getAdminSession } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

async function trend(table: 'User' | 'Project' | 'Clip', days = 14) {
  try {
    const tableSql =
      table === 'User'
        ? Prisma.sql`"User"`
        : table === 'Project'
          ? Prisma.sql`"Project"`
          : Prisma.sql`"Clip"`

    const sql = Prisma.sql`
      SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*)::int AS total
      FROM ${tableSql}
      WHERE "createdAt" >= now() - (${days}::int * interval '1 day')
      GROUP BY 1 ORDER BY 1
    `
    return await withDbRetry(() => prisma.$queryRaw<{ day: Date; total: number }[]>(sql))
  } catch (e) {
    console.warn(`Trend query failed for ${table}:`, e)
    return []
  }
}

async function sumCreditsPerPeriod() {
  try {
    const rows = await withDbRetry(() =>
      prisma.$queryRaw<{ type: string; total: Prisma.Decimal }[]>(Prisma.sql`
        SELECT type, COALESCE(SUM(amount), 0) AS total
        FROM "CreditTransaction"
        GROUP BY type
      `)
    )
    const byType: Record<string, number> = {}
    for (const r of rows) byType[r.type] = Number(r.total)
    return byType
  } catch (e) {
    console.warn('sumCreditsPerPeriod failed:', e)
    return {}
  }
}

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Batch 1: Totals
    const [
      userCount,
      projectCount,
      clipCount,
      campaignCount,
      payoutCount,
      deviceCount,
      webhookCount,
    ] = await withDbRetry(() =>
      Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.clip.count(),
        prisma.campaign.count(),
        prisma.payout.count(),
        prisma.device.count(),
        prisma.processedWebhookEvent.count(),
      ])
    )

    // Batch 2: Aggregations & breakdowns
    const [usersByRole, projectsByStatus, clipsByStatus, payouts] = await withDbRetry(() =>
      Promise.all([
        prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.clip.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.payout.findMany({ select: { status: true, amount: true } }),
      ])
    )

    // Batch 3: Recent activity records
    const [recentUsers, recentProjects, recentClips] = await withDbRetry(() =>
      Promise.all([
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            credits: true,
            createdAt: true,
          },
        }),
        prisma.project.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            user: { select: { email: true, name: true } },
            _count: { select: { clips: true, processingJobs: true } },
          },
        }),
        prisma.clip.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            user: { select: { email: true, name: true } },
            project: { select: { title: true } },
          },
        }),
      ])
    )

    // Batch 4: Trends & credit telemetry
    const [signupsTrend, projectsTrend, clipsTrend, creditsByType] = await Promise.all([
      trend('User', 14),
      trend('Project', 14),
      trend('Clip', 14),
      sumCreditsPerPeriod(),
    ])

    const money = (status: string) =>
      payouts
        .filter((p) => p.status === status)
        .reduce((a, p) => a + Number(p.amount), 0)

    return NextResponse.json({
      totals: {
        users: userCount,
        projects: projectCount,
        clips: clipCount,
        campaigns: campaignCount,
        payouts: payoutCount,
        devices: deviceCount,
        webhooks: webhookCount,
      },
      revenue: {
        total: payouts.reduce((a, p) => a + Number(p.amount), 0),
        paid: money('PAID'),
        approved: money('APPROVED'),
        pending: money('PENDING'),
      },
      credits: creditsByType,
      breakdown: {
        usersByRole,
        projectsByStatus,
        clipsByStatus,
      },
      trend: {
        signups: signupsTrend,
        projects: projectsTrend,
        clips: clipsTrend,
      },
      recent: {
        users: recentUsers,
        projects: recentProjects,
        clips: recentClips,
      },
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Failed to load admin stats' }, { status: 500 })
  }
}