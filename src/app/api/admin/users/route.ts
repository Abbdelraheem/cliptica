import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const roleEnum = z.enum(['FREE', 'CLIPPER', 'STUDIO', 'ADMIN'])

export async function GET(request: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const roleParam = searchParams.get('role')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Prisma.UserWhereInput = {}
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }
    const role = roleEnum.safeParse(roleParam)
    if (role.success) where.role = role.data

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          credits: true,
          subscriptionStatus: true,
          stripePriceId: true,
          emailVerified: true,
          createdAt: true,
          _count: {
            select: {
              projects: true,
              clips: true,
              payouts: true,
              campaigns: true,
              devices: true,
              creditTransactions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Admin users fetch error:', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}