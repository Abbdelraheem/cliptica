import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            projects: true,
            clips: true,
            payouts: true,
            campaigns: true,
            devices: true,
            apiKeys: true,
            creditTransactions: true,
            sessions: true,
          },
        },
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 20 },
        creditTransactions: { orderBy: { createdAt: 'desc' }, take: 25 },
        projects: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { _count: { select: { clips: true, processingJobs: true } } },
        },
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { campaign: { select: { name: true } } },
        },
        campaigns: { orderBy: { createdAt: 'desc' }, take: 15 },
        clips: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { project: { select: { title: true } } },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin user detail error:', error)
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 })
  }
}