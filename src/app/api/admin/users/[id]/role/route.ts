import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  role: z.enum(['FREE', 'CLIPPER', 'STUDIO', 'ADMIN']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: { id: true, email: true, name: true, role: true, updatedAt: true },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin role update error:', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}