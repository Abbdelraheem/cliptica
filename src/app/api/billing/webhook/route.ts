import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stripe, PLANS, getPlanFromPriceId } from '@/lib/stripe'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/** Models the webhook handlers touch inside the idempotency transaction. */
type Tx = Pick<PrismaClient, 'user' | 'creditTransaction' | 'processedWebhookEvent' | 'referralConversion'>

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    // Pre-retrieve subscription from Stripe API outside the DB transaction to avoid
    // holding DB connection locks during external network calls.
    let invoiceSubscription: Stripe.Subscription | null = null
    if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        try {
          invoiceSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
        } catch (subErr) {
          console.error('Failed to pre-retrieve subscription from Stripe:', subErr)
        }
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Atomic idempotency lock. Recording the event FIRST means a
        // concurrent retry of the same event fails on the unique constraint
        // (P2002) before any side effects run. Because the marker commits in
        // the SAME transaction as every business effect below, a failure
        // mid-processing rolls back both — Stripe's retry then finds no
        // marker and safely reprocesses instead of silently dropping credits.
        await tx.processedWebhookEvent.create({
          data: { stripeEventId: event.id },
        })

        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session
            await handleCheckoutCompleted(tx, session)
            break
          }

          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription
            await handleSubscriptionUpdated(tx, subscription)
            break
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription
            await handleSubscriptionDeleted(tx, subscription)
            break
          }

          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice
            await handleInvoicePaymentSucceeded(tx, invoice, invoiceSubscription)
            break
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice
            await handleInvoicePaymentFailed(tx, invoice, invoiceSubscription)
            break
          }
        }
      })
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        return NextResponse.json({ received: true, duplicate: true })
      }
      throw err
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(tx: Tx, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const planKey = session.metadata?.plan as keyof typeof PLANS

  if (!userId || !planKey) return

  // Role + subscription mapping only. Credits are granted by the initial
  // invoice via `invoice.payment_succeeded` — granting here would double the
  // first period, because checkout.session.completed AND the initial invoice
  // both fire on a non-trial signup.
  await tx.user.update({
    where: { id: userId },
    data: {
      role: planKey.toUpperCase() as never,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      stripePriceId: PLANS[planKey].priceId,
      subscriptionStatus: 'active',
    },
  })
}

async function handleSubscriptionUpdated(tx: Tx, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  const priceId = subscription.items.data[0]?.price.id
  const planKey = getPlanFromPriceId(priceId)

  if (!planKey) return

  // Non-paying statuses must not keep premium plan limits. `canceled` is
  // handled by customer.subscription.deleted; these cover the rest.
  const unpaid = ['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(subscription.status)

  await tx.user.update({
    where: { id: userId },
    data: {
      role: unpaid ? 'FREE' : (planKey.toUpperCase() as never),
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
    },
  })
}

async function handleSubscriptionDeleted(tx: Tx, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  await tx.user.update({
    where: { id: userId },
    data: {
      role: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'canceled',
    },
  })
}

async function handleInvoicePaymentSucceeded(
  tx: Tx,
  invoice: Stripe.Invoice,
  cachedSub: Stripe.Subscription | null
) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  let subscription = cachedSub
  if (!subscription) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId)
    } catch {
      subscription = null
    }
  }

  let userId = subscription?.metadata?.userId
  if (!userId) {
    // Robust fallback: locate user by subscription ID or customer ID in database
    const user = await tx.user.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscriptionId },
          ...(invoice.customer ? [{ stripeCustomerId: invoice.customer as string }] : []),
        ],
      },
      select: { id: true },
    })
    userId = user?.id
  }

  if (!userId) {
    console.error(`[webhook] No user found for invoice ${invoice.id} / sub ${subscriptionId}`)
    return
  }

  // Add credits for the new billing period
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? (invoice.lines?.data?.[0]?.price?.id as string | undefined)
  const planKey = priceId ? getPlanFromPriceId(priceId) : null
  if (!planKey) return

  const plan = PLANS[planKey]

  await tx.user.update({
    where: { id: userId },
    data: {
      role: planKey.toUpperCase() as never,
      credits: { increment: plan.credits },
      subscriptionStatus: 'active',
      stripeSubscriptionId: subscriptionId,
      ...(invoice.customer ? { stripeCustomerId: invoice.customer as string } : {}),
      ...(priceId ? { stripePriceId: priceId } : {}),
    },
  })

  await tx.creditTransaction.create({
    data: {
      userId,
      amount: plan.credits,
      type: 'purchase',
      description: `Renewal: ${plan.name} plan`,
      metadata: { plan: planKey, invoiceId: invoice.id },
    },
  })

  // Referral commission tracking: record SUBSCRIPTION conversion
  try {
    const userWithReferral = await tx.user.findFirst({
      where: { id: userId },
      select: {
        referredByAffiliateId: true,
        referredByAffiliate: { select: { id: true, commissionRate: true, isActive: true } },
      },
    })

    if (userWithReferral?.referredByAffiliate?.isActive) {
      const affiliate = userWithReferral.referredByAffiliate
      const amountPaidCents = invoice.amount_paid ?? invoice.total ?? 0
      const revenue = amountPaidCents / 100
      const commissionRate = Number(affiliate.commissionRate) || 20
      const commission = Number(((revenue * commissionRate) / 100).toFixed(2))

      if (tx.referralConversion && typeof tx.referralConversion.create === 'function') {
        await tx.referralConversion.create({
          data: {
            affiliateId: affiliate.id,
            userId,
            type: 'SUBSCRIPTION',
            revenue,
            commission,
            stripeEventId: invoice.id,
          },
        })
      }
    }
  } catch (refErr) {
    console.error('[webhook] referral tracking error:', refErr)
  }
}

async function handleInvoicePaymentFailed(
  tx: Tx,
  invoice: Stripe.Invoice,
  cachedSub: Stripe.Subscription | null
) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  let subscription = cachedSub
  if (!subscription) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId)
    } catch {
      subscription = null
    }
  }

  let userId = subscription?.metadata?.userId
  if (!userId) {
    const user = await tx.user.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscriptionId },
          ...(invoice.customer ? [{ stripeCustomerId: invoice.customer as string }] : []),
        ],
      },
      select: { id: true },
    })
    userId = user?.id
  }

  if (!userId) return

  await tx.user.update({
    where: { id: userId },
    data: {
      role: 'FREE', // Immediately degrade plan limits to FREE on payment failure
      subscriptionStatus: 'past_due',
    },
  })
}
