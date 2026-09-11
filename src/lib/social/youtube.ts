import { getSocialConfig } from './config'
import { PublishParams, PublishResult, TokenExchangeResult } from './types'

export function buildYouTubeAuthUrl(state: string): string {
  const config = getSocialConfig('YOUTUBE')
  if (!config.configured) {
    throw new Error('YouTube integration is not configured. Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET.')
  }

  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri!,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })

  return `${config.authUrl}?${params.toString()}`
}

export async function exchangeYouTubeCode(code: string): Promise<TokenExchangeResult> {
  const config = getSocialConfig('YOUTUBE')
  if (!config.configured) {
    throw new Error('YouTube credentials not configured in environment.')
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri!,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`YouTube token exchange failed (${tokenRes.status}): ${errText}`)
  }

  const data = await tokenRes.json()
  const accessToken = data.access_token
  const refreshToken = data.refresh_token
  const expiresIn = data.expires_in || 3600

  if (!accessToken) {
    throw new Error('YouTube token response missing access_token')
  }

  // Fetch YouTube channel details
  let accountName = 'YouTube Channel'
  let accountId: string | undefined

  try {
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (channelRes.ok) {
      const cData = await channelRes.json()
      const item = cData.items?.[0]
      if (item?.snippet?.title) accountName = item.snippet.title
      if (item?.id) accountId = item.id
    }
  } catch (err) {
    console.warn('[youtube] failed to fetch channel details:', err)
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    accountId,
    accountName,
  }
}

export async function refreshYouTubeToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = getSocialConfig('YOUTUBE')
  if (!config.configured) {
    throw new Error('YouTube credentials not configured in environment.')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`YouTube token refresh failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const accessToken = data.access_token
  const expiresIn = data.expires_in || 3600

  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

export async function publishToYouTube(
  accessToken: string,
  params: PublishParams
): Promise<PublishResult> {
  const privacy = (params.privacy || 'public').toLowerCase()
  const privacyStatus =
    privacy === 'private' ? 'private' : privacy === 'unlisted' ? 'unlisted' : 'public'

  const metadata = {
    snippet: {
      title: params.title.slice(0, 100),
      description: (params.description || params.title).slice(0, 5000),
      tags: params.tags && params.tags.length > 0 ? params.tags : ['#Shorts', '#AI', '#Cliptica'],
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  }

  try {
    // 1. Fetch video media stream or buffer from R2 URL
    const videoFetch = await fetch(params.videoUrl)
    if (!videoFetch.ok) {
      return {
        success: false,
        platform: 'YOUTUBE',
        status: 'FAILED',
        error: `Failed to download video file from storage: HTTP ${videoFetch.status}`,
      }
    }
    const videoBuffer = await videoFetch.arrayBuffer()
    const contentType = videoFetch.headers.get('content-type') || 'video/mp4'

    // 2. Initiate Resumable Upload Session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBuffer.byteLength),
        },
        body: JSON.stringify(metadata),
      }
    )

    if (!initRes.ok) {
      const err = await initRes.text()
      return {
        success: false,
        platform: 'YOUTUBE',
        status: 'FAILED',
        error: `Failed to initiate YouTube upload session (${initRes.status}): ${err}`,
      }
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) {
      return {
        success: false,
        platform: 'YOUTUBE',
        status: 'FAILED',
        error: 'YouTube upload session did not return upload Location header',
      }
    }

    // 3. Upload video bytes to the session URI
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      return {
        success: false,
        platform: 'YOUTUBE',
        status: 'FAILED',
        error: `YouTube video data upload failed (${uploadRes.status}): ${err}`,
      }
    }

    const videoData = await uploadRes.json()
    const videoId = videoData.id

    return {
      success: true,
      platform: 'YOUTUBE',
      postId: videoId,
      postUrl: `https://youtube.com/shorts/${videoId}`,
      status: 'PUBLISHED',
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      platform: 'YOUTUBE',
      status: 'FAILED',
      error: `YouTube publishing exception: ${msg}`,
    }
  }
}
