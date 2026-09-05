import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [, , updated] = await prisma.$transaction([
      prisma.processingJob.updateMany({
        where: { projectId: id, status: { in: ['failed', 'running', 'queued'] } },
        data: {
          status: 'queued',
          progress: 0,
          error: null,
          startedAt: null,
          completedAt: null,
        },
      }),
      prisma.clip.updateMany({
        where: { projectId: id, status: { in: ['GENERATING', 'EXPORTING'] } },
        data: { status: 'GENERATING' },
      }),
      prisma.project.update({
        where: { id },
        data: { status: 'PENDING' },
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
    ])

    return NextResponse.json({ project: updated })
  } catch (error) {
    console.error('Admin project retry error:', error)
    return NextResponse.json({ error: 'Failed to requeue project' }, { status: 500 })
  }
}