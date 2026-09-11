import { getAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  plan: z.enum(['FREE', 'CLIPPER', 'STUDIO']),
  addPlanCredits: z.boolean().default(true),
  customCredits: z.number().int().min(0).max(100000).optional(),
  reason: z.string().trim().max(200).optional(),
})

const DEFAULT_PLAN_CREDITS = {
  FREE: 0,
  CLIPPER: 100,
  STUDIO: 400,
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { plan, addPlanCredits, customCredits, reason } = parsed.data

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, credits: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let creditsToAdd = 0
    if (customCredits !== undefined) {
      creditsToAdd = customCredits
    } else if (addPlanCredits) {
      creditsToAdd = DEFAULT_PLAN_CREDITS[plan]
    }

    const newSubStatus = plan === 'FREE' ? null : 'active'

    const [, updatedUser] = await prisma.$transaction([
      ...(creditsToAdd > 0
        ? [
            prisma.creditTransaction.create({
              data: {
                userId: id,
                amount: creditsToAdd,
                type: 'bonus',
                description: reason || `Admin granted ${plan} subscription (+${creditsToAdd} credits)`,
              },
            }),
          ]
        : []),
      prisma.user.update({
        where: { id },
        data: {
          role: plan,
          subscriptionStatus: newSubStatus,
          ...(creditsToAdd > 0 ? { credits: { increment: creditsToAdd } } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          credits: true,
          subscriptionStatus: true,
          updatedAt: true,
        },
      }),
    ])

    return NextResponse.json({ user: updatedUser, grantedCredits: creditsToAdd })
  } catch (error) {
    console.error('Admin grant plan error:', error)
    return NextResponse.json({ error: 'Failed to grant plan' }, { status: 500 })
  }
}
