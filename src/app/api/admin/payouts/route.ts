import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const statusEnum = z.enum(['PENDING', 'APPROVED', 'PAID'])

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const statusParam = searchParams.get('status')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Prisma.PayoutWhereInput = {}
    if (q) {
      where.OR = [{ user: { email: { contains: q, mode: 'insensitive' } } }]
    }
    const status = statusEnum.safeParse(statusParam)
    if (status.success) where.status = status.data

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
          campaign: { select: { name: true } },
          clip: { select: { title: true, projectId: true } },
        },
      }),
      prisma.payout.count({ where }),
    ])

    return NextResponse.json({
      payouts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Admin payouts fetch error:', error)
    return NextResponse.json({ error: 'Failed to load payouts' }, { status: 500 })
  }
}