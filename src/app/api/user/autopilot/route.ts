import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { cleanUrlString } from '@/lib/validation'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const channels = await withDbRetry(() =>
    prisma.autoPilotChannel.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })
  )

  return NextResponse.json({ channels })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = session.user.role || (
    await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    )
  )?.role

  if (userRole !== 'ADMIN' && userRole !== 'STUDIO') {
    return NextResponse.json(
      { error: 'Auto-Pilot Autonomous Ingestion is an exclusive feature for Studio ($59/mo) and Admin accounts. Please upgrade to Studio to activate Auto-Pilot.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    let rawUrl = cleanUrlString(body.channelUrl)
    if (!rawUrl) {
      return NextResponse.json({ error: 'Channel URL is required' }, { status: 400 })
    }

    // Normalise channel URL
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl.startsWith('@') ? 'youtube.com/' : ''}${rawUrl}`
    }

    const captionStyle = body.captionStyle || 'hormozi'
    const framing = body.framing || 'smart'
    const aspectRatio = body.aspectRatio || '9:16'
    const channelTitle = body.channelTitle || rawUrl.replace(/\/+$/, '').split('/').pop() || 'YouTube Channel'

    const channel = await withDbRetry(() =>
      prisma.autoPilotChannel.create({
        data: {
          userId: session.user.id,
          channelUrl: rawUrl,
          channelTitle,
          captionStyle,
          framing,
          aspectRatio,
          clipsPerVideo: 3,
          isActive: true,
        },
      })
    )

    return NextResponse.json({ channel })
  } catch (err: unknown) {
    console.error('AutoPilot create error:', err)
    return NextResponse.json({ error: 'Failed to create AutoPilot watcher' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
  }

  const channel = await prisma.autoPilotChannel.findUnique({
    where: { id },
  })

  if (!channel || channel.userId !== session.user.id) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  await prisma.autoPilotChannel.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { channelId, isActive } = body
    if (!channelId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'channelId and boolean isActive are required' }, { status: 400 })
    }

    const channel = await prisma.autoPilotChannel.findUnique({
      where: { id: channelId },
    })

    if (!channel || channel.userId !== session.user.id) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const updated = await prisma.autoPilotChannel.update({
      where: { id: channelId },
      data: { isActive },
    })

    return NextResponse.json({ success: true, channel: updated })
  } catch (err: unknown) {
    console.error('AutoPilot update error:', err)
    return NextResponse.json({ error: 'Failed to update AutoPilot watcher' }, { status: 500 })
  }
}

