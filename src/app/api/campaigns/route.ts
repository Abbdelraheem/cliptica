import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiMutationLimiter, enforceRateLimit } from '@/lib/rate-limit'

const campaignSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['WHOP_CONTENT_REWARDS', 'BRAND_DEAL', 'OWN_CHANNEL']).default('BRAND_DEAL'),
  platform: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  rules: z.string().max(4000).optional().nullable(),
  sourceUrls: z.array(z.string()).optional(),
  ratePer1k: z.number().positive(),
  flatFee: z.number().optional(),
  minPayout: z.number().nonnegative().optional(),
  maxPayout: z.number().positive().optional(),
  minViews: z.number().nonnegative().optional(),
  budget: z.number().positive().optional(),
  deadline: z.string().optional().nullable(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, canCreateCampaigns: true },
    })
    const isAdmin = dbUser?.role === 'ADMIN'
    const canCreate = isAdmin || Boolean(dbUser?.canCreateCampaigns)

    // All registered users can see active campaigns to participate
    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { clips: true, submissions: true } },
        user: {
          select: { id: true, name: true, email: true },
        },
        submissions: {
          where: { userId: session.user.id },
          select: { id: true, postUrl: true, platform: true, views: true, earnings: true, status: true, verified: true },
        },
      },
    })

    // Also fetch all user submissions across campaigns
    const mySubmissions = await prisma.campaignSubmission.findMany({
      where: { userId: session.user.id },
      include: {
        campaign: {
          select: { id: true, name: true, ratePer1k: true, imageUrl: true, platforms: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      campaigns,
      mySubmissions,
      canCreate,
    })
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

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, canCreateCampaigns: true },
    })

    // STRICT: Only ADMIN or users explicitly granted permission by Admin
    const isAllowed = dbUser?.role === 'ADMIN' || Boolean(dbUser?.canCreateCampaigns)
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'إنشاء الحملات متاح حصرياً للمستخدمين المصرح لهم من الإدارة. تواصل مع الدعم لطلب صلاحية إنشاء الحملات.' },
        { status: 403 }
      )
    }

    const limited = await enforceRateLimit(apiMutationLimiter, `camp:${session.user.id}`)
    if (limited) return limited

    const body = await request.json()
    const validated = campaignSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.flatten() }, { status: 400 })
    }

    const data = validated.data
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        type: data.type,
        platform: data.platform ?? (data.platforms?.[0] || 'all'),
        platforms: data.platforms ?? ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'],
        imageUrl: data.imageUrl || null,
        description: data.description || null,
        rules: data.rules || null,
        sourceUrls: data.sourceUrls ?? [],
        ratePer1k: data.ratePer1k,
        flatFee: data.flatFee,
        minPayout: data.minPayout ?? 10,
        maxPayout: data.maxPayout,
        minViews: data.minViews ?? 1000,
        budget: data.budget,
        deadline: data.deadline ? new Date(data.deadline) : null,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Campaign creation error:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}