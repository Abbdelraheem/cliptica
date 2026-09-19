import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clipzila.com'
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', baseUrl), 307)
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true, paddleCustomerId: true },
    })

    if (!user?.stripeCustomerId && !user?.paddleCustomerId) {
      return NextResponse.redirect(new URL('/dashboard/billing?error=no_customer', baseUrl), 307)
    }

    return NextResponse.redirect(new URL('/api/billing/paddle-portal', baseUrl), 307)
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.redirect(new URL('/dashboard/billing?error=portal_failed', baseUrl), 307)
  }
}