import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clipzila.com'
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', baseUrl))
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.redirect(new URL('/dashboard/billing?error=no_customer', baseUrl))
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/dashboard/billing`,
    })

    return NextResponse.redirect(portalSession.url, 303)
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.redirect(new URL('/dashboard/billing?error=portal_failed', baseUrl))
  }
}