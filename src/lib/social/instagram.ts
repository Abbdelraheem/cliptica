import { getSocialConfig } from './config'
import { PublishParams, PublishResult, TokenExchangeResult } from './types'

export function buildInstagramAuthUrl(state: string): string {
  const config = getSocialConfig('INSTAGRAM')
  if (!config.configured) {
    throw new Error('Instagram integration is not configured. Missing INSTAGRAM_CLIENT_ID or INSTAGRAM_CLIENT_SECRET.')
  }

  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri!,
    response_type: 'code',
    scope: config.scopes.join(','),
    state,
  })

  return `${config.authUrl}?${params.toString()}`
}

export async function exchangeInstagramCode(code: string): Promise<TokenExchangeResult> {
  const config = getSocialConfig('INSTAGRAM')
  if (!config.configured) {
    throw new Error('Instagram credentials not configured in environment.')
  }

  // 1. Exchange authorization code for short-lived access token
  const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  tokenUrl.searchParams.set('client_id', config.clientId!)
  tokenUrl.searchParams.set('client_secret', config.clientSecret!)
  tokenUrl.searchParams.set('redirect_uri', config.redirectUri!)
  tokenUrl.searchParams.set('code', code)

  const tokenRes = await fetch(tokenUrl.toString())
  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Instagram/Meta token exchange failed (${tokenRes.status}): ${errText}`)
  }

  const tokenData = await tokenRes.json()
  const shortLivedToken = tokenData.access_token
  if (!shortLivedToken) {
    throw new Error('Meta response did not include an access_token')
  }

  // 2. Exchange for long-lived access token (valid 60 days)
  let accessToken = shortLivedToken
  let expiresIn = 60 * 86400 // 60 days default for long-lived token

  try {
    const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', config.clientId!)
    longLivedUrl.searchParams.set('client_secret', config.clientSecret!)
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken)

    const llRes = await fetch(longLivedUrl.toString())
    if (llRes.ok) {
      const llData = await llRes.json()
      if (llData.access_token) {
        accessToken = llData.access_token
        expiresIn = llData.expires_in || expiresIn
      }
    }
  } catch (err) {
    console.warn('[instagram] long-lived token exchange warning:', err)
  }

  // 3. Locate linked Instagram Business/Creator Account
  let accountId: string | undefined
  let accountName = 'Instagram Creator'

  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,username,name}&access_token=${accessToken}`
    )
    if (pagesRes.ok) {
      const pagesData = await pagesRes.json()
      for (const page of pagesData.data || []) {
        if (page.instagram_business_account?.id) {
          accountId = page.instagram_business_account.id
          accountName =
            page.instagram_business_account.username ||
            page.instagram_business_account.name ||
            accountName
          break
        }
      }
    }
  } catch (err) {
    console.warn('[instagram] failed to fetch linked Instagram business account:', err)
  }

  return {
    accessToken,
    refreshToken: accessToken, // Meta uses long-lived token exchange with existing valid token
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    accountId,
    accountName,
  }
}

export async function refreshInstagramToken(
  currentToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const config = getSocialConfig('INSTAGRAM')
  if (!config.configured) {
    throw new Error('Instagram credentials not configured in environment.')
  }

  const refreshUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  refreshUrl.searchParams.set('grant_type', 'fb_exchange_token')
  refreshUrl.searchParams.set('client_id', config.clientId!)
  refreshUrl.searchParams.set('client_secret', config.clientSecret!)
  refreshUrl.searchParams.set('fb_exchange_token', currentToken)

  const res = await fetch(refreshUrl.toString())
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Instagram token refresh failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const accessToken = data.access_token
  const expiresIn = data.expires_in || 60 * 86400

  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

export async function publishToInstagram(
  accessToken: string,
  params: PublishParams,
  igAccountId?: string
): Promise<PublishResult> {
  const targetAccountId = igAccountId || 'me'
  const caption = params.description || params.title

  try {
    // Step 1: Create Media Container for Reel
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${targetAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: params.videoUrl,
          caption,
          share_to_feed: true,
          access_token: accessToken,
        }),
      }
    )

    if (!containerRes.ok) {
      const err = await containerRes.text()
      return {
        success: false,
        platform: 'INSTAGRAM',
        status: 'FAILED',
        error: `Failed to create Instagram Reel container (${containerRes.status}): ${err}`,
      }
    }

    const containerData = await containerRes.json()
    const containerId = containerData.id
    if (!containerId) {
      return {
        success: false,
        platform: 'INSTAGRAM',
        status: 'FAILED',
        error: 'Instagram API did not return container ID for Reel',
      }
    }

    // Step 2: Poll container readiness status
    let ready = false
    let attempts = 0
    while (!ready && attempts < 15) {
      attempts++
      await new Promise((r) => setTimeout(r, 2000))

      const statusRes = await fetch(
        `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
      )
      if (statusRes.ok) {
        const sData = await statusRes.json()
        if (sData.status_code === 'FINISHED') {
          ready = true
          break
        }
        if (sData.status_code === 'ERROR') {
          return {
            success: false,
            platform: 'INSTAGRAM',
            status: 'FAILED',
            error: `Instagram media processing error: ${sData.status || 'Failed to encode video'}`,
          }
        }
      }
    }

    // Step 3: Publish Container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${targetAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    )

    if (!publishRes.ok) {
      const err = await publishRes.text()
      return {
        success: false,
        platform: 'INSTAGRAM',
        status: 'FAILED',
        error: `Failed to publish Instagram Reel (${publishRes.status}): ${err}`,
      }
    }

    const publishData = await publishRes.json()
    const mediaId = publishData.id

    return {
      success: true,
      platform: 'INSTAGRAM',
      postId: mediaId,
      postUrl: `https://www.instagram.com/reel/${mediaId}/`,
      status: 'PUBLISHED',
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      platform: 'INSTAGRAM',
      status: 'FAILED',
      error: `Instagram publishing exception: ${msg}`,
    }
  }
}
