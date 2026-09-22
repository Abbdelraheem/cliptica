import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateNameSchema = z.object({
  name: z.string().trim().min(1).max(80),
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
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        canCreateCampaigns: true,
        credits: true,
        createdAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        paddleCustomerId: true,
        paddleSubscriptionId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isAdmin = user.role === 'ADMIN' || isAdminEmail(user.email)
    const payload = {
      ...user,
      role: isAdmin ? 'ADMIN' : user.role,
      credits: isAdmin ? 999999 : user.credits,
      canCreateCampaigns: isAdmin || Boolean(user.canCreateCampaigns),
    }

    return NextResponse.json({ user: payload })
  } catch (error) {
    console.error('Me fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = updateNameSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: validated.data.name },
    })

    return NextResponse.json({ user: { id: user.id, name: user.name } })
  } catch (error) {
    console.error('Me update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}