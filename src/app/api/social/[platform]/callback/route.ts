import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState, OAuthStatePayload } from '@/lib/crypto'
import { SocialPlatformType } from '@/lib/social/types'
import { exchangeTikTokCode } from '@/lib/social/tiktok'
import { exchangeYouTubeCode } from '@/lib/social/youtube'
import { exchangeInstagramCode } from '@/lib/social/instagram'
import { saveSocialConnection } from '@/lib/social/tokens'
import { getBaseUrl } from '@/lib/social/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: rawPlatform } = await params
  const platform = rawPlatform.toUpperCase() as SocialPlatformType
  const searchParams = request.nextUrl.searchParams
  const baseUrl = getBaseUrl()

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error') || searchParams.get('error_description')

  // Default fallback URL if state cannot be decoded
  const defaultRedirect = `${baseUrl}/dashboard/settings?tab=connections`

  if (oauthError) {
    console.warn(`[social-callback] OAuth error from ${platform}:`, oauthError)
    return NextResponse.redirect(`${defaultRedirect}&error=${encodeURIComponent(oauthError)}`)
  }

  if (!state) {
    return NextResponse.redirect(`${defaultRedirect}&error=missing_oauth_state`)
  }

  const payload = verifyOAuthState<OAuthStatePayload>(state)
  if (!payload) {
    return NextResponse.redirect(`${defaultRedirect}&error=invalid_or_expired_state`)
  }

  if (payload.platform !== platform) {
    return NextResponse.redirect(`${defaultRedirect}&error=platform_mismatch`)
  }

  if (!code) {
    return NextResponse.redirect(`${defaultRedirect}&error=missing_auth_code`)
  }

  const targetReturnUrl = payload.returnUrl || '/dashboard/settings?tab=connections'
  const redirectTarget = targetReturnUrl.startsWith('http')
    ? new URL(targetReturnUrl)
    : new URL(targetReturnUrl, baseUrl)

  try {
    let exchangeResult
    if (platform === 'TIKTOK') {
      exchangeResult = await exchangeTikTokCode(code)
    } else if (platform === 'YOUTUBE') {
      exchangeResult = await exchangeYouTubeCode(code)
    } else if (platform === 'INSTAGRAM') {
      exchangeResult = await exchangeInstagramCode(code)
    } else {
      redirectTarget.searchParams.set('error', 'unsupported_platform')
      return NextResponse.redirect(redirectTarget.toString())
    }

    await saveSocialConnection(payload.userId, platform, exchangeResult)

    redirectTarget.searchParams.set('socialConnected', platform.toLowerCase())
    return NextResponse.redirect(redirectTarget.toString())
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[social-callback] Token exchange error for ${platform}:`, err)
    redirectTarget.searchParams.set('error', encodeURIComponent(msg))
    return NextResponse.redirect(redirectTarget.toString())
  }
}
