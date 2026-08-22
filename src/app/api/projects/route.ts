import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateApiKey } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const sourceType = formData.get('sourceType') as string
    const url = formData.get('url') as string
    const file = formData.get('file') as File | null
    const instructions = formData.get('instructions') as string

    if (!sourceType || (sourceType === 'url' && !url) || (sourceType === 'file' && !file)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Check user credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Estimate credits needed (5 base + 1 per minute, max 90 min for paid, 20 for free)
    const estimatedMinutes = sourceType === 'url' ? 20 : Math.ceil((file!.size / (1024 * 1024)) / 50) // rough estimate
    const estimatedCredits = 5 + Math.min(estimatedMinutes, user.role === 'FREE' ? 20 : 90)

    if (user.credits < estimatedCredits) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: estimatedCredits,
        available: user.credits,
      }, { status: 402 })
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        title: sourceType === 'url' ? `Project from ${new URL(url).hostname}` : file!.name,
        sourceUrl: sourceType === 'url' ? url : null,
        sourceFile: sourceType === 'file' ? file!.name : null,
        duration: estimatedMinutes * 60,
        instructions,
        creditsUsed: estimatedCredits,
        status: 'PROCESSING',
      },
    })

    // Deduct credits
    await prisma.user.update({
      where: { id: session.user.id },
      data: { credits: { decrement: estimatedCredits } },
    })

    // Create credit transaction
    await prisma.creditTransaction.create({
      data: {
        userId: session.user.id,
        amount: -estimatedCredits,
        type: 'usage',
        description: `AI clip generation for "${project.title}"`,
        metadata: { projectId: project.id, sourceType },
      },
    })

    // Create processing job
    await prisma.processingJob.create({
      data: {
        projectId: project.id,
        type: 'clip_generation',
        status: 'queued',
      },
    })

    // TODO: Trigger actual video processing worker
    // await triggerVideoProcessing(project.id)

    return NextResponse.json({ id: project.id })
  } catch (error) {
    console.error('Project creation error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    const where: any = { userId: session.user.id }
    if (status) where.status = status

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { clips: true } },
          clips: {
            where: { status: 'READY' },
            select: { viralScore: true },
            take: 1,
            orderBy: { viralScore: 'desc' },
          },
        },
      }),
      prisma.project.count({ where }),
    ])

    return NextResponse.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Projects fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}