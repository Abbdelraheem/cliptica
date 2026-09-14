import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, clipId } = await params
    const project = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const clip = await prisma.clip.findFirst({
      where: { id: clipId, projectId: id },
    })

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    await prisma.clip.delete({ where: { id: clipId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clip delete error:', error)
    return NextResponse.json({ error: 'Failed to delete clip' }, { status: 500 })
  }
}
