import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSocialConfig } from '@/lib/social/config'
import { SocialPlatformType } from '@/lib/social/types'
import { signOAuthState } from '@/lib/crypto'
import { buildTikTokAuthUrl } from '@/lib/social/tiktok'
import { buildYouTubeAuthUrl } from '@/lib/social/youtube'
import { buildInstagramAuthUrl } from '@/lib/social/instagram'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized', message: 'Please sign in to connect accounts.' }, { status: 401 })
  }

  const { platform: rawPlatform } = await params
  const platform = rawPlatform.toUpperCase() as SocialPlatformType

  if (!['TIKTOK', 'YOUTUBE', 'INSTAGRAM'].includes(platform)) {
    return NextResponse.json(
      { error: 'invalid_platform', message: `Unsupported platform: ${rawPlatform}` },
      { status: 400 }
    )
  }

  const config = getSocialConfig(platform)
  if (!config.configured) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: `${config.name} integration requires API credentials. Configure ${config.missingVars.join(' and ')} in environment.`,
      },
      { status: 400 }
    )
  }

  const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/dashboard/settings?tab=connections'

  // Generate tamper-proof signed OAuth state
  const state = signOAuthState({
    userId: session.user.id,
    platform,
    returnUrl,
  })

  let authUrl: string
  try {
    if (platform === 'TIKTOK') {
      authUrl = buildTikTokAuthUrl(state)
    } else if (platform === 'YOUTUBE') {
      authUrl = buildYouTubeAuthUrl(state)
    } else if (platform === 'INSTAGRAM') {
      authUrl = buildInstagramAuthUrl(state)
    } else {
      return NextResponse.json({ error: 'invalid_platform' }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'oauth_init_failed', message: msg }, { status: 500 })
  }

  return NextResponse.redirect(authUrl)
}
