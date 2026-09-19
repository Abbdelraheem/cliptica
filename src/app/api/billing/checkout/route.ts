import { auth } from '@/lib/auth'
import { PLANS, CREDIT_PACKS } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clipzila.com'
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?callbackUrl=/dashboard/billing', baseUrl), 307)
    }

    const { searchParams } = new URL(request.url)
    const planKey = searchParams.get('plan') as keyof typeof PLANS
    const packKey = searchParams.get('pack') as keyof typeof CREDIT_PACKS

    const isPack = Boolean(packKey && CREDIT_PACKS[packKey])
    const isPlan = Boolean(planKey && PLANS[planKey])

    if (!isPack && !isPlan) {
      return NextResponse.redirect(new URL('/dashboard/billing?error=invalid_selection', baseUrl), 307)
    }

    const url = new URL('/dashboard/billing', baseUrl)
    if (planKey) url.searchParams.set('plan', planKey)
    if (packKey) url.searchParams.set('pack', packKey)

    return NextResponse.redirect(url, 307)
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.redirect(new URL('/dashboard/billing?error=checkout_failed', baseUrl), 307)
  }
}