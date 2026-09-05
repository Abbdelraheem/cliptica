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
    const job = await prisma.processingJob.findUnique({ where: { id } })
    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.processingJob.update({
      where: { id },
      data: {
        status: 'queued',
        progress: 0,
        error: null,
        startedAt: null,
        completedAt: null,
      },
      select: { id: true, type: true, status: true, progress: true, error: true },
    })

    await prisma.project.update({ where: { id: job.projectId }, data: { status: 'PENDING' } })

    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error('Admin job retry error:', error)
    return NextResponse.json({ error: 'Failed to requeue job' }, { status: 500 })
  }
}