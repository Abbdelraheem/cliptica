import { PlatformConfig, SocialPlatformType } from './types'

export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'http://localhost:3000'
}

export function getSocialConfig(platform: SocialPlatformType): PlatformConfig {
  const base = getBaseUrl()

  switch (platform) {
    case 'TIKTOK': {
      const clientId = process.env.TIKTOK_CLIENT_KEY?.trim() || ''
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() || ''
      const redirectUri =
        process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI?.trim() || `${base}/api/social/tiktok/callback`
      const missingVars: string[] = []
      if (!clientId) missingVars.push('TIKTOK_CLIENT_KEY')
      if (!clientSecret) missingVars.push('TIKTOK_CLIENT_SECRET')

      return {
        platform: 'TIKTOK',
        name: 'TikTok',
        configured: missingVars.length === 0,
        missingVars,
        clientId,
        clientSecret,
        redirectUri,
        authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
        scopes: ['user.info.basic', 'video.publish', 'video.upload'],
      }
    }

    case 'YOUTUBE': {
      const clientId = process.env.YOUTUBE_CLIENT_ID?.trim() || ''
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim() || ''
      const redirectUri =
        process.env.NEXT_PUBLIC_YOUTUBE_REDIRECT_URI?.trim() || `${base}/api/social/youtube/callback`
      const missingVars: string[] = []
      if (!clientId) missingVars.push('YOUTUBE_CLIENT_ID')
      if (!clientSecret) missingVars.push('YOUTUBE_CLIENT_SECRET')

      return {
        platform: 'YOUTUBE',
        name: 'YouTube',
        configured: missingVars.length === 0,
        missingVars,
        clientId,
        clientSecret,
        redirectUri,
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
      }
    }

    case 'INSTAGRAM': {
      const clientId = process.env.INSTAGRAM_CLIENT_ID?.trim() || ''
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET?.trim() || ''
      const redirectUri =
        process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI?.trim() || `${base}/api/social/instagram/callback`
      const missingVars: string[] = []
      if (!clientId) missingVars.push('INSTAGRAM_CLIENT_ID')
      if (!clientSecret) missingVars.push('INSTAGRAM_CLIENT_SECRET')

      return {
        platform: 'INSTAGRAM',
        name: 'Instagram Reels',
        configured: missingVars.length === 0,
        missingVars,
        clientId,
        clientSecret,
        redirectUri,
        authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        scopes: [
          'instagram_basic',
          'instagram_content_publish',
          'pages_show_list',
          'pages_read_engagement',
        ],
      }
    }

    default:
      throw new Error(`Unsupported social platform: ${platform}`)
  }
}

export function getAllSocialConfigs(): Record<SocialPlatformType, PlatformConfig> {
  return {
    TIKTOK: getSocialConfig('TIKTOK'),
    YOUTUBE: getSocialConfig('YOUTUBE'),
    INSTAGRAM: getSocialConfig('INSTAGRAM'),
  }
}
