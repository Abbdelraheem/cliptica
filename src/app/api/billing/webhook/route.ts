import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stripe, PLANS, getPlanFromPriceId } from '@/lib/stripe'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/** Models the webhook handlers touch inside the idempotency transaction. */
type Tx = Pick<PrismaClient, 'user' | 'creditTransaction' | 'processedWebhookEvent'>

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
            await handleInvoicePaymentSucceeded(tx, invoice)
            break
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice
            await handleInvoicePaymentFailed(tx, invoice)
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

  const plan = PLANS[planKey]
  const credits = plan.credits

  await tx.user.update({
    where: { id: userId },
    data: {
      role: planKey.toUpperCase() as never,
      credits: { increment: credits },
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      stripePriceId: plan.priceId,
      subscriptionStatus: 'active',
    },
  })

  // Add credit transaction
  await tx.creditTransaction.create({
    data: {
      userId,
      amount: credits,
      type: 'purchase',
      description: `Subscription to ${plan.name} plan`,
      metadata: { plan: planKey, sessionId: session.id },
    },
  })
}

async function handleSubscriptionUpdated(tx: Tx, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  const priceId = subscription.items.data[0]?.price.id
  const planKey = getPlanFromPriceId(priceId)

  if (!planKey) return

  await tx.user.update({
    where: { id: userId },
    data: {
      role: planKey.toUpperCase() as never,
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

async function handleInvoicePaymentSucceeded(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = subscription.metadata?.userId
  if (!userId) return

  // Add credits for the new billing period
  const priceId = subscription.items.data[0]?.price.id
  const planKey = getPlanFromPriceId(priceId)
  if (!planKey) return

  const plan = PLANS[planKey]

  await tx.user.update({
    where: { id: userId },
    data: {
      credits: { increment: plan.credits },
      subscriptionStatus: 'active',
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
}

async function handleInvoicePaymentFailed(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = subscription.metadata?.userId
  if (!userId) return

  await tx.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'past_due',
    },
  })
}
