import { getSocialConfig } from './config'
import { PublishParams, PublishResult, TokenExchangeResult } from './types'

export function buildTikTokAuthUrl(state: string): string {
  const config = getSocialConfig('TIKTOK')
  if (!config.configured) {
    throw new Error('TikTok integration is not configured. Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET.')
  }

  const params = new URLSearchParams({
    client_key: config.clientId!,
    scope: config.scopes.join(','),
    response_type: 'code',
    redirect_uri: config.redirectUri!,
    state,
  })

  return `${config.authUrl}?${params.toString()}`
}

export async function exchangeTikTokCode(code: string): Promise<TokenExchangeResult> {
  const config = getSocialConfig('TIKTOK')
  if (!config.configured) {
    throw new Error('TikTok credentials not configured in environment.')
  }

  const body = new URLSearchParams({
    client_key: config.clientId!,
    client_secret: config.clientSecret!,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri!,
  })

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`TikTok token exchange failed (${tokenRes.status}): ${errText}`)
  }

  const tokenData = await tokenRes.json()
  const data = tokenData.data || tokenData
  const accessToken = data.access_token
  const refreshToken = data.refresh_token
  const expiresIn = data.expires_in || 86400 // default 24h

  if (!accessToken) {
    throw new Error('TikTok token response missing access_token')
  }

  // Fetch TikTok user basic info to get account display name / ID
  let accountName = data.open_id || 'TikTok User'
  let accountId = data.open_id || undefined

  try {
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (userRes.ok) {
      const userData = await userRes.json()
      const u = userData.data?.user || userData.data
      if (u?.display_name) accountName = u.display_name
      if (u?.open_id) accountId = u.open_id
    }
  } catch (err) {
    console.warn('[tiktok] failed to fetch user profile:', err)
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    accountId,
    accountName,
  }
}

export async function refreshTikTokToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
  const config = getSocialConfig('TIKTOK')
  if (!config.configured) {
    throw new Error('TikTok credentials not configured in environment.')
  }

  const body = new URLSearchParams({
    client_key: config.clientId!,
    client_secret: config.clientSecret!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`TikTok token refresh failed (${res.status}): ${errText}`)
  }

  const tokenData = await res.json()
  const data = tokenData.data || tokenData
  const accessToken = data.access_token
  const newRefreshToken = data.refresh_token || refreshToken
  const expiresIn = data.expires_in || 86400

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

export async function publishToTikTok(
  accessToken: string,
  params: PublishParams
): Promise<PublishResult> {
  const privacyLevel = params.privacy || 'PUBLIC_TO_EVERYONE'

  const payload = {
    post_info: {
      title: params.title.slice(0, 150), // TikTok caption limit
      privacy_level: privacyLevel,
      disable_duet: false,
      disable_stitch: false,
      disable_comment: false,
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: params.videoUrl,
    },
  }

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errBody = await res.text()
    return {
      success: false,
      platform: 'TIKTOK',
      status: 'FAILED',
      error: `TikTok publish API error (${res.status}): ${errBody}`,
    }
  }

  const data = await res.json()
  const publishId = data.data?.publish_id || data.publish_id

  return {
    success: true,
    platform: 'TIKTOK',
    postId: publishId,
    status: 'PROCESSING', // TikTok processes asynchronously via webhook/status check
  }
}
