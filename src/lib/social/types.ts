export type SocialPlatformType = 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM'

export interface PlatformConfig {
  platform: SocialPlatformType
  name: string
  configured: boolean
  missingVars: string[]
  clientId?: string
  clientSecret?: string
  redirectUri?: string
  authUrl?: string
  scopes: string[]
}

export interface PublishParams {
  title: string
  description?: string
  tags?: string[]
  privacy?: string
  videoUrl: string
  aspectRatio?: string
  duration?: number
}

export interface PublishResult {
  success: boolean
  platform: SocialPlatformType
  postId?: string
  postUrl?: string
  status: 'PUBLISHED' | 'PROCESSING' | 'FAILED'
  error?: string
}

export interface TokenExchangeResult {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  accountId?: string
  accountName?: string
}

export interface ConnectionSummary {
  platform: SocialPlatformType
  name: string
  connected: boolean
  accountName?: string | null
  accountId?: string | null
  connectedAt?: string | null
  status: 'active' | 'expired' | 'not_connected'
  configured: boolean
  missingVars: string[]
}
