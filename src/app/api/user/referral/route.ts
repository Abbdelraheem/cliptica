import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  let affiliate = await prisma.affiliate.findFirst({
    where: { userId },
  })

  if (!affiliate) {
    const defaultCode = `ref-${userId.slice(-6)}`.toLowerCase()
    try {
      affiliate = await prisma.affiliate.create({
        data: {
          userId,
          name: session.user.name || 'Cliptica Creator',
          code: defaultCode,
        },
      })
    } catch {
      affiliate = await prisma.affiliate.create({
        data: {
          userId,
          name: session.user.name || 'Cliptica Creator',
          code: `c-${Math.random().toString(36).substring(2, 8)}`,
        },
      })
    }
  }

  const signupsCount = await prisma.referralConversion.count({
    where: {
      affiliateId: affiliate.id,
      type: 'SIGNUP',
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cliptica.com'
  const referralUrl = `${appUrl}/register?ref=${affiliate.code}`

  return NextResponse.json({
    code: affiliate.code,
    referralUrl,
    signupsCount,
    earnedCredits: signupsCount * 5,
    rewardPerSignup: 5,
  })
}
