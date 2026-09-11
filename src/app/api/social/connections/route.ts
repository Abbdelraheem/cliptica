import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSocialConnectionSummaries, disconnectSocialPlatform } from '@/lib/social/tokens'
import { SocialPlatformType } from '@/lib/social/types'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const connections = await getSocialConnectionSummaries(session.user.id)
  return NextResponse.json({ connections })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const platformParam = request.nextUrl.searchParams.get('platform')?.toUpperCase() as SocialPlatformType
  if (!platformParam || !['TIKTOK', 'YOUTUBE', 'INSTAGRAM'].includes(platformParam)) {
    return NextResponse.json({ error: 'invalid_platform' }, { status: 400 })
  }

  await disconnectSocialPlatform(session.user.id, platformParam)
  return NextResponse.json({ success: true, platform: platformParam })
}
