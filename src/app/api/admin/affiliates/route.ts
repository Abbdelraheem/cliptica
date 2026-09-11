import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createAffiliateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Code must contain only letters, numbers, hyphens or underscores'),
  commissionRate: z.number().min(0).max(100).default(20),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
})

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            clicks: true,
            referredUsers: true,
          },
        },
        conversions: {
          select: {
            type: true,
            revenue: true,
            commission: true,
            createdAt: true,
          },
        },
      },
    })

    const rows = affiliates.map((a) => {
      const signups = a.conversions.filter((c) => c.type === 'SIGNUP').length || a._count.referredUsers
      const firstProjects = a.conversions.filter((c) => c.type === 'FIRST_PROJECT').length
      const subscriptions = a.conversions.filter((c) => c.type === 'SUBSCRIPTION').length
      const totalRevenue = a.conversions.reduce((acc, c) => acc + Number(c.revenue), 0)
      const totalCommission = a.conversions.reduce((acc, c) => acc + Number(c.commission), 0)

      return {
        id: a.id,
        name: a.name,
        code: a.code,
        email: a.email,
        commissionRate: Number(a.commissionRate),
        isActive: a.isActive,
        notes: a.notes,
        clicks: a._count.clicks,
        signups,
        firstProjects,
        subscriptions,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
        createdAt: a.createdAt,
      }
    })

    // Aggregate global referral funnel
    const totalClicks = rows.reduce((acc, r) => acc + r.clicks, 0)
    const totalSignups = rows.reduce((acc, r) => acc + r.signups, 0)
    const totalFirstProjects = rows.reduce((acc, r) => acc + r.firstProjects, 0)
    const totalSubscriptions = rows.reduce((acc, r) => acc + r.subscriptions, 0)
    const grandRevenue = rows.reduce((acc, r) => acc + r.totalRevenue, 0)
    const grandCommission = rows.reduce((acc, r) => acc + r.totalCommission, 0)

    const funnel = {
      clicks: totalClicks,
      signups: totalSignups,
      signupRate: totalClicks > 0 ? Number(((totalSignups / totalClicks) * 100).toFixed(1)) : 0,
      firstProjects: totalFirstProjects,
      projectDropoff: totalSignups > 0 ? Number((((totalSignups - totalFirstProjects) / totalSignups) * 100).toFixed(1)) : 0,
      subscriptions: totalSubscriptions,
      subscriptionRate: totalSignups > 0 ? Number(((totalSubscriptions / totalSignups) * 100).toFixed(1)) : 0,
      totalRevenue: Number(grandRevenue.toFixed(2)),
      totalCommission: Number(grandCommission.toFixed(2)),
    }

    return NextResponse.json({ affiliates: rows, funnel })
  } catch (error) {
    console.error('Affiliates GET error:', error)
    return NextResponse.json({ error: 'Failed to load affiliates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createAffiliateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, code, commissionRate, email, notes } = parsed.data
    const normalizedCode = code.toLowerCase()

    const existing = await prisma.affiliate.findUnique({
      where: { code: normalizedCode },
    })

    if (existing) {
      return NextResponse.json(
        { error: `Referral code "${normalizedCode}" is already in use.` },
        { status: 409 }
      )
    }

    const affiliate = await prisma.affiliate.create({
      data: {
        name,
        code: normalizedCode,
        commissionRate,
        email: email || null,
        notes: notes || null,
      },
    })

    return NextResponse.json({ affiliate }, { status: 201 })
  } catch (error) {
    console.error('Affiliate create error:', error)
    return NextResponse.json({ error: 'Failed to create affiliate' }, { status: 500 })
  }
}
