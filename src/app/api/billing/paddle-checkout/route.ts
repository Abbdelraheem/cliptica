import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PADDLE_PLAN_PRICES, PADDLE_PACK_PRICES } from '@/lib/paddle'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const plan = typeof body.plan === 'string' ? body.plan : undefined
    const packId = typeof body.packId === 'string' ? body.packId : undefined

    let priceId: string | undefined

    if (plan === 'clipper') {
      priceId = process.env.PADDLE_PRICE_CLIPPER_MONTHLY || PADDLE_PLAN_PRICES.clipper
    } else if (plan === 'studio') {
      priceId = process.env.PADDLE_PRICE_STUDIO_MONTHLY || PADDLE_PLAN_PRICES.studio
    } else if (packId) {
      const envKey = `PADDLE_PRICE_${packId.toUpperCase()}`
      priceId = process.env[envKey] || (packId in PADDLE_PACK_PRICES ? PADDLE_PACK_PRICES[packId as keyof typeof PADDLE_PACK_PRICES] : undefined)
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan or credit pack, or Paddle price ID not configured' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      priceId,
      email: session.user.email,
      userId: session.user.id,
      clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '',
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox',
    })
  } catch (error) {
    console.error('[paddle-checkout] Error resolving checkout price:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
