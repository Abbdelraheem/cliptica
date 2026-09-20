import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  canCreateCampaigns: z.boolean(),
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
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { canCreateCampaigns: parsed.data.canCreateCampaigns },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        canCreateCampaigns: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin campaign permission error:', error)
    return NextResponse.json({ error: 'Failed to update campaign permission' }, { status: 500 })
  }
}
