import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, PLANS } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?callbackUrl=/dashboard/billing'))
    }

    const { searchParams } = new URL(request.url)
    const planKey = searchParams.get('plan') as keyof typeof PLANS

    if (!planKey || !PLANS[planKey]) {
      return NextResponse.redirect(new URL('/dashboard/billing?error=invalid_plan'))
    }

    const plan = PLANS[planKey]

    if (!plan.priceId) {
      return NextResponse.redirect(new URL('/dashboard/billing?error=plan_not_configured'))
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })

    if (!user) {
      return NextResponse.redirect(new URL('/dashboard/billing?error=user_not_found'))
    }

    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: user.name || undefined,
        metadata: { userId: session.user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
      metadata: {
        userId: session.user.id,
        plan: planKey,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan: planKey,
        },
      },
    })

    return NextResponse.redirect(checkoutSession.url!, 303)
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.redirect(new URL('/dashboard/billing?error=checkout_failed'))
  }
}