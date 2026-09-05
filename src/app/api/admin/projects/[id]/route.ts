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
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        clips: {
          orderBy: { viralScore: 'desc' },
          include: {
            _count: { select: { campaignLinks: true, payouts: true } },
          },
        },
        processingJobs: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Admin project detail error:', error)
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }
}