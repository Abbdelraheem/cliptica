import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { PrismaClient, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getPaddleInstance,
  getPlanFromPaddlePriceId,
  getCreditPackFromPaddlePriceId,
} from '@/lib/paddle'
import { PLANS } from '@/lib/stripe'
import type { EventEntity } from '@paddle/paddle-node-sdk'

const webhookSecret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET || ''

type Tx = Pick<
  PrismaClient,
  'user' | 'creditTransaction' | 'processedWebhookEvent' | 'referralConversion'
>

interface PaddleCustomData {
  userId?: string
  [key: string]: unknown
}

interface PaddleItem {
  price?: {
    id?: string
  }
}

interface PaddleSubscriptionData {
  id?: string
  customerId?: string
  status?: string
  customData?: PaddleCustomData
  items?: PaddleItem[]
}

interface PaddleTransactionData {
  id?: string
  customerId?: string
  status?: string
  origin?: string
  customData?: PaddleCustomData
  items?: PaddleItem[]
  details?: {
    totals?: {
      total?: string
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('paddle-signature') || ''

    if (!webhookSecret) {
      console.error('[paddle-webhook] Missing PADDLE_NOTIFICATION_WEBHOOK_SECRET')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const paddle = getPaddleInstance()
    let event: EventEntity

    try {
      event = await paddle.webhooks.unmarshal(body, webhookSecret, signature)
    } catch (err) {
      console.error('[paddle-webhook] Signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Atomic idempotency lock: duplicate events fail on unique paddleEventId constraint
        await tx.processedWebhookEvent.create({
          data: { paddleEventId: event.eventId },
        })

        const eventData = event.data as unknown

        switch (event.eventType) {
          case 'subscription.created':
          case 'subscription.updated': {
            await handleSubscriptionUpdated(tx, eventData as PaddleSubscriptionData)
            break
          }

          case 'subscription.canceled': {
            await handleSubscriptionCanceled(tx, eventData as PaddleSubscriptionData)
            break
          }

          case 'transaction.completed': {
            await handleTransactionCompleted(tx, eventData as PaddleTransactionData)
            break
          }

          default:
            // Unhandled event type acknowledged safely
            break
        }
      })

      return NextResponse.json({ received: true })
    } catch (dbErr) {
      const prismaError = dbErr as { code?: string }
      // P2002: Unique constraint violation on paddleEventId -> already processed (idempotent 200)
      if (prismaError?.code === 'P2002') {
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.error('[paddle-webhook] Transaction processing error:', dbErr)
      return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
    }
  } catch (error) {
    console.error('[paddle-webhook] Unhandled error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function findUserForPaddle(tx: Tx, customData?: PaddleCustomData, customerId?: string) {
  const userId = typeof customData?.userId === 'string' ? customData.userId : undefined
  if (userId) {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (user) return user
  }

  if (customerId) {
    const user = await tx.user.findFirst({ where: { paddleCustomerId: customerId } })
    if (user) return user
  }

  return null
}

async function handleSubscriptionUpdated(tx: Tx, subscription: PaddleSubscriptionData) {
  const customerId = subscription.customerId
  const user = await findUserForPaddle(tx, subscription.customData, customerId)
  if (!user) {
    console.warn('[paddle-webhook] User not found for subscription:', subscription.id)
    return
  }

  const primaryItem = subscription.items?.[0]
  const priceId = primaryItem?.price?.id || ''
  const planKey = getPlanFromPaddlePriceId(priceId)

  let role: UserRole = user.role
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    if (planKey === 'clipper') role = 'CLIPPER'
    if (planKey === 'studio') role = 'STUDIO'
  } else if (subscription.status === 'canceled' || subscription.status === 'past_due') {
    role = 'FREE'
  }

  await tx.user.update({
    where: { id: user.id },
    data: {
      paddleCustomerId: customerId,
      paddleSubscriptionId: subscription.id,
      paddlePriceId: priceId,
      subscriptionStatus: subscription.status,
      role,
    },
  })
}

async function handleSubscriptionCanceled(tx: Tx, subscription: PaddleSubscriptionData) {
  const user = await findUserForPaddle(tx, subscription.customData, subscription.customerId)
  if (!user) return

  await tx.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'canceled',
      role: 'FREE',
    },
  })
}

async function handleTransactionCompleted(tx: Tx, transaction: PaddleTransactionData) {
  const customerId = transaction.customerId
  const user = await findUserForPaddle(tx, transaction.customData, customerId)
  if (!user) {
    console.warn('[paddle-webhook] User not found for transaction:', transaction.id)
    return
  }

  const primaryItem = transaction.items?.[0]
  const priceId = primaryItem?.price?.id || ''
  const creditPack = getCreditPackFromPaddlePriceId(priceId)
  const planKey = getPlanFromPaddlePriceId(priceId)

  let creditsToAdd = 0
  let description = 'Paddle Purchase'

  if (creditPack) {
    // One-off credit pack purchase
    creditsToAdd = creditPack.credits
    description = `Paddle: Purchased ${creditPack.name} (+${creditPack.credits} credits)`
  } else if (planKey && (transaction.origin === 'subscription_recurring' || transaction.origin === 'subscription_charge')) {
    // Subscription cycle payment
    const plan = PLANS[planKey]
    creditsToAdd = plan.credits
    description = `Paddle: Monthly ${plan.name} plan renewal (+${plan.credits} credits)`
  }

  if (creditsToAdd > 0) {
    await tx.user.update({
      where: { id: user.id },
      data: {
        credits: { increment: creditsToAdd },
        paddleCustomerId: customerId || user.paddleCustomerId,
      },
    })

    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        amount: creditsToAdd,
        type: 'purchase',
        description,
      },
    })
  }

  // Affiliate commission calculation if user was referred
  if (user.referredByAffiliateId) {
    const amountInCents = parseInt(transaction.details?.totals?.total || '0', 10)
    const revenueDollars = amountInCents / 100

    if (revenueDollars > 0) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: user.referredByAffiliateId },
      })

      if (affiliate && affiliate.isActive) {
        const rate = Number(affiliate.commissionRate) / 100
        const commissionDollars = Math.round(revenueDollars * rate * 100) / 100

        await tx.referralConversion.create({
          data: {
            affiliateId: affiliate.id,
            userId: user.id,
            type: 'SUBSCRIPTION',
            revenue: revenueDollars,
            commission: commissionDollars,
            paddleEventId: transaction.id,
          },
        })
      }
    }
  }
}
