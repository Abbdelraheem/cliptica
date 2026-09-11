import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/crypto'
import { getSocialConfig } from './config'
import { refreshTikTokToken, publishToTikTok } from './tiktok'
import { refreshYouTubeToken, publishToYouTube } from './youtube'
import { refreshInstagramToken, publishToInstagram } from './instagram'
import { validateClipForPublish } from './validation'
import {
  ConnectionSummary,
  PublishParams,
  PublishResult,
  SocialPlatformType,
  TokenExchangeResult,
} from './types'

/**
 * Upserts a social connection for a user with AES-256-GCM encrypted tokens.
 */
export async function saveSocialConnection(
  userId: string,
  platform: SocialPlatformType,
  data: TokenExchangeResult
) {
  const encAccess = encryptToken(data.accessToken)
  const encRefresh = data.refreshToken ? encryptToken(data.refreshToken) : null

  return await prisma.socialConnection.upsert({
    where: {
      userId_platform: {
        userId,
        platform,
      },
    },
    create: {
      userId,
      platform,
      accessToken: encAccess,
      refreshToken: encRefresh,
      tokenExpiresAt: data.expiresAt || null,
      platformAccountId: data.accountId || null,
      platformAccountName: data.accountName || null,
    },
    update: {
      accessToken: encAccess,
      refreshToken: encRefresh || undefined,
      tokenExpiresAt: data.expiresAt || null,
      platformAccountId: data.accountId || undefined,
      platformAccountName: data.accountName || undefined,
      updatedAt: new Date(),
    },
  })
}

/**
 * Retrieves a valid, decrypted access token for the given user and platform.
 * Transparently refreshes the token if within 5 minutes of expiry.
 */
export async function getValidAccessToken(
  userId: string,
  platform: SocialPlatformType
): Promise<{
  accessToken: string
  accountId?: string | null
  accountName?: string | null
}> {
  const connection = await prisma.socialConnection.findUnique({
    where: {
      userId_platform: {
        userId,
        platform,
      },
    },
  })

  if (!connection) {
    throw new Error(`No ${platform} connection found for this account. Please connect your account first.`)
  }

  const rawAccess = decryptToken(connection.accessToken)
  const rawRefresh = connection.refreshToken ? decryptToken(connection.refreshToken) : null

  // Check if token expires within 5 minutes (300,000 ms)
  const now = Date.now()
  const isExpiringSoon =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - now < 5 * 60 * 1000

  if (isExpiringSoon && rawRefresh) {
    try {
      let refreshed: { accessToken: string; refreshToken?: string; expiresAt: Date } | null = null

      if (platform === 'TIKTOK') {
        refreshed = await refreshTikTokToken(rawRefresh)
      } else if (platform === 'YOUTUBE') {
        refreshed = await refreshYouTubeToken(rawRefresh)
      } else if (platform === 'INSTAGRAM') {
        refreshed = await refreshInstagramToken(rawRefresh)
      }

      if (refreshed) {
        const encNewAccess = encryptToken(refreshed.accessToken)
        const encNewRefresh = refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : undefined

        await prisma.socialConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: encNewAccess,
            refreshToken: encNewRefresh,
            tokenExpiresAt: refreshed.expiresAt,
            updatedAt: new Date(),
          },
        })

        return {
          accessToken: refreshed.accessToken,
          accountId: connection.platformAccountId,
          accountName: connection.platformAccountName,
        }
      }
    } catch (err) {
      console.error(`[social-publish] Token refresh failed for ${platform}:`, err)
      // Fallback to existing access token if refresh fails temporarily
    }
  }

  return {
    accessToken: rawAccess,
    accountId: connection.platformAccountId,
    accountName: connection.platformAccountName,
  }
}

/**
 * Returns safe summaries of all social platforms for the user.
 * Zero plaintext or encrypted tokens are returned.
 */
export async function getSocialConnectionSummaries(
  userId: string
): Promise<ConnectionSummary[]> {
  const platforms: SocialPlatformType[] = ['TIKTOK', 'YOUTUBE', 'INSTAGRAM']
  const connections = await prisma.socialConnection.findMany({
    where: { userId },
  })
  const connMap = new Map(connections.map((c) => [c.platform, c]))

  return platforms.map((p) => {
    const config = getSocialConfig(p)
    const conn = connMap.get(p)

    if (!conn) {
      return {
        platform: p,
        name: config.name,
        connected: false,
        accountName: null,
        accountId: null,
        connectedAt: null,
        status: 'not_connected',
        configured: config.configured,
        missingVars: config.missingVars,
      }
    }

    const isExpired = conn.tokenExpiresAt ? conn.tokenExpiresAt.getTime() < Date.now() : false

    return {
      platform: p,
      name: config.name,
      connected: true,
      accountName: conn.platformAccountName,
      accountId: conn.platformAccountId,
      connectedAt: conn.connectedAt.toISOString(),
      status: isExpired ? 'expired' : 'active',
      configured: config.configured,
      missingVars: config.missingVars,
    }
  })
}

/**
 * Disconnects a user's social connection.
 */
export async function disconnectSocialPlatform(
  userId: string,
  platform: SocialPlatformType
) {
  return await prisma.socialConnection.deleteMany({
    where: {
      userId,
      platform,
    },
  })
}

/**
 * End-to-end publish orchestrator: validates clip format, retrieves credentials,
 * calls adapter, logs publish record to DB, and returns results.
 */
export async function publishClipToSocial(
  userId: string,
  clipId: string,
  platform: SocialPlatformType,
  customParams?: Partial<PublishParams>
): Promise<PublishResult> {
  // 1. Fetch clip and confirm ownership
  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    include: { project: true },
  })

  if (!clip || clip.userId !== userId) {
    return {
      success: false,
      platform,
      status: 'FAILED',
      error: 'Clip not found or unauthorized access.',
    }
  }

  if (clip.status !== 'READY') {
    return {
      success: false,
      platform,
      status: 'FAILED',
      error: `Clip is not ready for publishing (status: ${clip.status}).`,
    }
  }

  // 2. Validate format specs for the chosen platform
  const validation = validateClipForPublish(
    {
      aspectRatio: clip.aspectRatio,
      duration: clip.duration,
      videoUrl: clip.videoUrl,
      exportUrl: clip.exportUrl,
      status: clip.status,
    },
    platform
  )

  if (!validation.valid) {
    return {
      success: false,
      platform,
      status: 'FAILED',
      error: validation.error || 'Clip does not meet platform specifications.',
    }
  }

  const finalVideoUrl = clip.exportUrl || clip.videoUrl
  if (!finalVideoUrl) {
    return {
      success: false,
      platform,
      status: 'FAILED',
      error: 'Clip video file URL is unavailable.',
    }
  }

  // 3. Obtain valid access token (with transparent auto-refresh)
  let tokenData: { accessToken: string; accountId?: string | null }
  try {
    tokenData = await getValidAccessToken(userId, platform)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      platform,
      status: 'FAILED',
      error: msg,
    }
  }

  // 4. Assemble publish parameters
  const publishParams: PublishParams = {
    title: customParams?.title || clip.title || 'Cliptica Clip',
    description: customParams?.description || clip.description || clip.title || '',
    tags: customParams?.tags || ['#Shorts', '#Reels', '#Viral', '#Cliptica'],
    privacy: customParams?.privacy || 'public',
    videoUrl: finalVideoUrl,
    aspectRatio: clip.aspectRatio,
    duration: clip.duration,
  }

  // 5. Invoke platform adapter
  let result: PublishResult

  try {
    if (platform === 'TIKTOK') {
      result = await publishToTikTok(tokenData.accessToken, publishParams)
    } else if (platform === 'YOUTUBE') {
      result = await publishToYouTube(tokenData.accessToken, publishParams)
    } else if (platform === 'INSTAGRAM') {
      result = await publishToInstagram(
        tokenData.accessToken,
        publishParams,
        tokenData.accountId || undefined
      )
    } else {
      throw new Error(`Unsupported platform: ${platform}`)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    result = {
      success: false,
      platform,
      status: 'FAILED',
      error: `Publish failed: ${msg}`,
    }
  }

  // 6. Record event in SocialPublishLog
  try {
    await prisma.socialPublishLog.create({
      data: {
        userId,
        clipId,
        platform,
        externalPostId: result.postId || null,
        externalUrl: result.postUrl || null,
        status: result.status,
        errorMessage: result.error || null,
      },
    })
  } catch (logErr) {
    console.warn('[social-publish] Failed to record publish log:', logErr)
  }

  return result
}
