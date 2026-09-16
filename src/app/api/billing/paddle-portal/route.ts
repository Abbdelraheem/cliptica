import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaddleInstance } from '@/lib/paddle'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { paddleCustomerId: true, paddleSubscriptionId: true },
    })

    if (!user?.paddleCustomerId) {
      // If customer has no Paddle subscription yet, redirect to billing page
      return NextResponse.redirect(new URL('/dashboard/billing?error=no_paddle_account', request.url))
    }

    const paddle = getPaddleInstance()
    const subscriptionIds = user.paddleSubscriptionId ? [user.paddleSubscriptionId] : []

    const portalSession = await paddle.customerPortalSessions.create(
      user.paddleCustomerId,
      subscriptionIds
    )

    const redirectUrl = portalSession.urls.general.overview
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('[paddle-portal] Error creating portal session:', error)
    return NextResponse.redirect(new URL('/dashboard/billing?error=portal_error', request.url))
  }
}
