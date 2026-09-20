import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const purgeSchema = z.object({
  keepClipIds: z.array(z.string().min(1)).min(1, 'Please select at least one clip to keep'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const project = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = purgeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 }
      )
    }

    const { keepClipIds } = parsed.data

    // Fetch all clips for this project to verify
    const allClips = await prisma.clip.findMany({
      where: { projectId: id },
      select: { id: true },
    })

    const allClipIds = allClips.map((c) => c.id)
    const validKeepIds = keepClipIds.filter((cid) => allClipIds.includes(cid))

    if (validKeepIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid clip must be selected to keep' },
        { status: 400 }
      )
    }

    const clipsToDelete = allClipIds.filter((cid) => !validKeepIds.includes(cid))

    if (clipsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        kept: validKeepIds.length,
        deleted: 0,
        message: 'All clips kept — none to delete.',
      })
    }

    const deleteResult = await prisma.clip.deleteMany({
      where: {
        projectId: id,
        id: { in: clipsToDelete },
      },
    })

    return NextResponse.json({
      success: true,
      kept: validKeepIds.length,
      deleted: deleteResult.count,
      message: `Kept ${validKeepIds.length} clip(s) and deleted ${deleteResult.count} unselected clip(s).`,
    })
  } catch (error) {
    console.error('Purge unselected clips error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to purge clips' },
      { status: 500 }
    )
  }
}
