import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANS, CREDIT_PACKS } from '@/lib/stripe'
import { PADDLE_PLAN_PRICES, PADDLE_PACK_PRICES } from '@/lib/paddle'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action as 'initiated' | 'abandoned' | 'completed' | undefined
    const checkoutSessionId = body.checkoutSessionId as string | undefined

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      select: { id: true, email: true, name: true },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, skipped: true })
    }

    const userId = dbUser.id
    const userEmail = dbUser.email || session.user.email
    const userName = dbUser.name || session.user.name || null

    if (action === 'initiated') {
      const plan = typeof body.plan === 'string' ? body.plan.toLowerCase() : undefined
      const packId = typeof body.packId === 'string' ? body.packId : undefined

      let itemType = 'PLAN'
      let itemId = plan || 'unknown'
      let itemName = 'Subscription Plan'
      let amount: number | null = null
      let paddlePriceId: string | null = null

      if (plan) {
        itemType = 'PLAN'
        itemId = plan
        const planKey = plan === 'starter' ? 'clipper' : plan === 'pro' ? 'studio' : plan
        const planDef = PLANS[planKey as keyof typeof PLANS]
        if (planDef) {
          itemName = `${planDef.name} Plan`
          amount = planDef.price / 100
        }
        paddlePriceId = PADDLE_PLAN_PRICES[plan] || null
      } else if (packId) {
        itemType = 'CREDIT_PACK'
        itemId = packId
        const packDef = CREDIT_PACKS[packId]
        if (packDef) {
          itemName = `${packDef.name} Pack`
          amount = packDef.price / 100
        }
        paddlePriceId = PADDLE_PACK_PRICES[packId] || null
      }

      // Check if there is already an INITIATED session created in the last 15 minutes for this user & item
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
      const existing = await prisma.checkoutSession.findFirst({
        where: {
          userId,
          itemId,
          status: 'INITIATED',
          createdAt: { gte: fifteenMinutesAgo },
        },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)

      if (existing) {
        return NextResponse.json({
          success: true,
          checkoutSessionId: existing.id,
          status: existing.status,
        })
      }

      const newSession = await prisma.checkoutSession.create({
        data: {
          userId,
          userEmail,
          userName,
          itemType,
          itemId,
          itemName,
          amount: amount !== null ? amount : undefined,
          currency: 'USD',
          paddlePriceId,
          status: 'INITIATED',
          notes: body.notes || null,
        },
      })

      return NextResponse.json({
        success: true,
        checkoutSessionId: newSession.id,
        status: newSession.status,
      })
    }

    if (action === 'abandoned') {
      if (checkoutSessionId) {
        await prisma.checkoutSession.update({
          where: { id: checkoutSessionId },
          data: { status: 'ABANDONED' },
        }).catch(() => null)
      } else {
        // Fallback to updating the most recent INITIATED session for this user
        const latest = await prisma.checkoutSession.findFirst({
          where: { userId, status: 'INITIATED' },
          orderBy: { createdAt: 'desc' },
        }).catch(() => null)

        if (latest) {
          await prisma.checkoutSession.update({
            where: { id: latest.id },
            data: { status: 'ABANDONED' },
          }).catch(() => null)
        }
      }

      return NextResponse.json({ success: true, status: 'ABANDONED' })
    }

    if (action === 'completed') {
      const paddleTxId = body.paddleTxId || null
      if (checkoutSessionId) {
        await prisma.checkoutSession.update({
          where: { id: checkoutSessionId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            paddleTxId: paddleTxId || undefined,
          },
        }).catch(() => null)
      } else {
        const latest = await prisma.checkoutSession.findFirst({
          where: {
            userId,
            status: { in: ['INITIATED', 'ABANDONED'] },
          },
          orderBy: { createdAt: 'desc' },
        }).catch(() => null)

        if (latest) {
          await prisma.checkoutSession.update({
            where: { id: latest.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              paddleTxId: paddleTxId || undefined,
            },
          }).catch(() => null)
        }
      }

      return NextResponse.json({ success: true, status: 'COMPLETED' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[track-checkout] Error:', error)
    // Always return safe 200 or 500 without crashing client flow
    return NextResponse.json({ error: 'Failed to record checkout tracking' }, { status: 500 })
  }
}
