import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'

const campaignSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['WHOP_CONTENT_REWARDS', 'BRAND_DEAL', 'OWN_CHANNEL']),
  ratePer1k: z.number().positive(),
  flatFee: z.number().optional(),
  budget: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaigns = await prisma.campaign.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { clips: true } },
        clips: {
          include: { clip: true },
        },
      },
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Campaigns fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await enforceRateLimit(apiMutationLimiter, `camp:${session.user.id}`)
    if (limited) return limited

    const body = await request.json()
    const validated = campaignSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.flatten() }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        ...validated.data,
        userId: session.user.id,
        deadline: validated.data.deadline ? new Date(validated.data.deadline) : null,
      },
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Campaign creation error:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}