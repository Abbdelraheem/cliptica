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
    const plan = typeof body.plan === 'string' ? body.plan.toLowerCase() : undefined
    const packId = typeof body.packId === 'string' ? body.packId : undefined

    let priceId: string | undefined

    if (plan && plan in PADDLE_PLAN_PRICES) {
      priceId = PADDLE_PLAN_PRICES[plan as keyof typeof PADDLE_PLAN_PRICES]
    } else if (packId && packId in PADDLE_PACK_PRICES) {
      priceId = PADDLE_PACK_PRICES[packId]
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
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV || 'production',
    })
  } catch (error) {
    console.error('[paddle-checkout] Error resolving checkout price:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
