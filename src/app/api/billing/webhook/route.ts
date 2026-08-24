import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe, PLANS, getPlanFromPriceId } from '@/lib/stripe'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

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

    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { id: event.id },
    })
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice)
        break
      }
    }

    await prisma.processedWebhookEvent.create({
      data: { id: event.id, type: event.type },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const planKey = session.metadata?.plan as keyof typeof PLANS

  if (!userId || !planKey) return

  const plan = PLANS[planKey]
  const credits = plan.credits

  await prisma.user.update({
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
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: credits,
      type: 'purchase',
      description: `Subscription to ${plan.name} plan`,
      metadata: { plan: planKey, sessionId: session.id },
    },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  const priceId = subscription.items.data[0]?.price.id
  const planKey = getPlanFromPriceId(priceId)

  if (!planKey) return

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: planKey.toUpperCase() as never,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'canceled',
    },
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: plan.credits },
      subscriptionStatus: 'active',
    },
  })

  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: plan.credits,
      type: 'purchase',
      description: `Renewal: ${plan.name} plan`,
      metadata: { plan: planKey, invoiceId: invoice.id },
    },
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = subscription.metadata?.userId
  if (!userId) return

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'past_due',
    },
  })
}