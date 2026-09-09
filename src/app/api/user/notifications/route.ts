import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const notificationSchema = z.object({
  notifyOnComplete: z.boolean().optional(),
  notifyOnLowCredits: z.boolean().optional(),
  notifyOnWeeklyDigest: z.boolean().optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notifyOnComplete: true,
        notifyOnLowCredits: true,
        notifyOnWeeklyDigest: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json({ error: 'Failed to fetch notification preferences' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validated = notificationSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: validated.data,
      select: {
        notifyOnComplete: true,
        notifyOnLowCredits: true,
        notifyOnWeeklyDigest: true,
      },
    })

    return NextResponse.json({ success: true, preferences: updated })
  } catch (error) {
    console.error('Update notifications error:', error)
    return NextResponse.json({ error: 'Failed to update notification preferences' }, { status: 500 })
  }
}
