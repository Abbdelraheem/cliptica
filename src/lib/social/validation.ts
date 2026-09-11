import { SocialPlatformType } from './types'

export interface ClipValidationInput {
  aspectRatio?: string
  duration?: number
  videoUrl?: string | null
  exportUrl?: string | null
  status?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
  warnings?: string[]
}

/**
 * Validates whether a clip satisfies the technical specifications and guidelines
 * for direct publishing to the designated platform.
 */
export function validateClipForPublish(
  clip: ClipValidationInput,
  platform: SocialPlatformType
): ValidationResult {
  const warnings: string[] = []

  // Ensure clip has a valid accessible video file
  const videoUrl = clip.exportUrl || clip.videoUrl
  if (!videoUrl) {
    return {
      valid: false,
      error: 'Clip does not have an exported or ready video URL to publish.',
    }
  }

  const duration = clip.duration ?? 0
  const ar = clip.aspectRatio || '9:16'

  switch (platform) {
    case 'TIKTOK': {
      if (duration < 3) {
        return {
          valid: false,
          error: `TikTok requires videos to be at least 3 seconds long (clip is ${duration}s).`,
        }
      }
      if (duration > 600) {
        return {
          valid: false,
          error: `TikTok video limit exceeded: maximum allowed duration is 600s (clip is ${duration}s).`,
        }
      }
      if (ar !== '9:16') {
        warnings.push('TikTok strongly recommends 9:16 vertical video. Other aspect ratios may display with black bars.')
      }
      break
    }

    case 'YOUTUBE': {
      if (duration <= 0) {
        return {
          valid: false,
          error: 'Invalid clip duration for YouTube upload.',
        }
      }
      if (ar === '9:16' && duration > 60) {
        warnings.push('YouTube Shorts are strictly capped at 60 seconds. Clips over 60s will be uploaded as regular YouTube landscape/box videos instead of Shorts.')
      }
      break
    }

    case 'INSTAGRAM': {
      if (duration < 3) {
        return {
          valid: false,
          error: `Instagram Reels requires videos to be at least 3 seconds long (clip is ${duration}s).`,
        }
      }
      if (duration > 90) {
        return {
          valid: false,
          error: `Instagram Reels duration exceeded: maximum allowed duration is 90 seconds (clip is ${duration}s).`,
        }
      }
      if (ar !== '9:16' && ar !== '4:5') {
        return {
          valid: false,
          error: `Instagram Reels requires vertical video (9:16 or 4:5 aspect ratio). Current aspect ratio is ${ar}.`,
        }
      }
      break
    }

    default:
      return {
        valid: false,
        error: `Unknown social platform: ${platform}`,
      }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
