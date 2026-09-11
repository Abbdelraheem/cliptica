import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken, signOAuthState, verifyOAuthState } from '../src/lib/crypto'
import { validateClipForPublish } from '../src/lib/social/validation'
import { getSocialConfig } from '../src/lib/social/config'
import { publishToTikTok, refreshTikTokToken } from '../src/lib/social/tiktok'
import { publishToYouTube, refreshYouTubeToken } from '../src/lib/social/youtube'
import { publishToInstagram, refreshInstagramToken } from '../src/lib/social/instagram'

describe('Social Publishing & Security Integration Suite', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. AES-256-GCM Token Encryption & Decryption', () => {
    it('encrypts and decrypts OAuth access and refresh tokens symmetrically', () => {
      const sampleToken = 'ya29.a0AfH6SMDh_fake_oauth_access_token_1234567890_test_payload'
      const encrypted = encryptToken(sampleToken)

      expect(encrypted).not.toBe(sampleToken)
      expect(encrypted.split(':')).toHaveLength(3) // iv:tag:cipher

      const decrypted = decryptToken(encrypted)
      expect(decrypted).toBe(sampleToken)
    })

    it('produces different ciphertexts for identical plaintext due to random IV', () => {
      const token = 'gho_abcdef1234567890'
      const enc1 = encryptToken(token)
      const enc2 = encryptToken(token)

      expect(enc1).not.toBe(enc2)
      expect(decryptToken(enc1)).toBe(token)
      expect(decryptToken(enc2)).toBe(token)
    })

    it('fails when decrypted with an incorrect secret', () => {
      const secretA = 'secret-key-alpha-32-chars-long-12'
      const secretB = 'secret-key-beta-32-chars-long-123'
      const text = 'my-super-confidential-token'

      const encrypted = encryptToken(text, secretA)
      expect(() => decryptToken(encrypted, secretB)).toThrow()
    })

    it('rejects malformed ciphertexts with missing parts', () => {
      expect(() => decryptToken('invalid-format')).toThrow(/Malformed encrypted token format/)
    })
  })

  describe('2. HMAC-SHA256 OAuth State Generation & Verification', () => {
    it('signs and verifies valid OAuth state with timestamp', () => {
      const state = signOAuthState({
        userId: 'user_123',
        platform: 'TIKTOK',
        returnUrl: '/dashboard/settings',
      })

      expect(typeof state).toBe('string')
      expect(state.split('.')).toHaveLength(2)

      const verified = verifyOAuthState(state)
      expect(verified).not.toBeNull()
      expect(verified?.userId).toBe('user_123')
      expect(verified?.platform).toBe('TIKTOK')
      expect(verified?.returnUrl).toBe('/dashboard/settings')
    })

    it('rejects tampered OAuth state signatures', () => {
      const state = signOAuthState({
        userId: 'user_attacker',
        platform: 'YOUTUBE',
      })

      const [payload, sig] = state.split('.')
      const tampered = `${payload}.${sig.slice(0, -4)}abcd`

      expect(verifyOAuthState(tampered)).toBeNull()
    })

    it('rejects expired OAuth state (>15 minutes old)', () => {
      const pastTime = Date.now() - 20 * 60 * 1000 // 20 minutes ago
      const state = signOAuthState({
        userId: 'user_123',
        platform: 'INSTAGRAM',
        ts: pastTime,
      })

      expect(verifyOAuthState(state, 15 * 60 * 1000)).toBeNull()
    })
  })

  describe('3. Platform Configuration & Missing Credentials Handling', () => {
    it('reports missing credentials gracefully when env vars are unset', () => {
      delete process.env.TIKTOK_CLIENT_KEY
      delete process.env.TIKTOK_CLIENT_SECRET

      const config = getSocialConfig('TIKTOK')
      expect(config.configured).toBe(false)
      expect(config.missingVars).toContain('TIKTOK_CLIENT_KEY')
      expect(config.missingVars).toContain('TIKTOK_CLIENT_SECRET')
    })

    it('reports configured true when credentials are provided', () => {
      process.env.TIKTOK_CLIENT_KEY = 'mock_tiktok_key'
      process.env.TIKTOK_CLIENT_SECRET = 'mock_tiktok_secret'

      const config = getSocialConfig('TIKTOK')
      expect(config.configured).toBe(true)
      expect(config.missingVars).toHaveLength(0)
    })
  })

  describe('4. Clip Format & Technical Specification Validation', () => {
    it('rejects clips without a ready video URL', () => {
      const res = validateClipForPublish({ videoUrl: null, exportUrl: null }, 'TIKTOK')
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/does not have an exported or ready video URL/)
    })

    it('validates TikTok duration limits (3s - 600s)', () => {
      const tooShort = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 2, aspectRatio: '9:16' },
        'TIKTOK'
      )
      expect(tooShort.valid).toBe(false)
      expect(tooShort.error).toMatch(/at least 3 seconds long/)

      const tooLong = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 605, aspectRatio: '9:16' },
        'TIKTOK'
      )
      expect(tooLong.valid).toBe(false)
      expect(tooLong.error).toMatch(/maximum allowed duration is 600s/)

      const validClip = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 42, aspectRatio: '9:16' },
        'TIKTOK'
      )
      expect(validClip.valid).toBe(true)
    })

    it('warns when uploading landscape video to TikTok', () => {
      const res = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 30, aspectRatio: '16:9' },
        'TIKTOK'
      )
      expect(res.valid).toBe(true)
      expect(res.warnings).toBeDefined()
      expect(res.warnings?.[0]).toMatch(/9:16 vertical video/)
    })

    it('warns when YouTube 9:16 video exceeds 60s (won\'t qualify as Short)', () => {
      const res = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 75, aspectRatio: '9:16' },
        'YOUTUBE'
      )
      expect(res.valid).toBe(true)
      expect(res.warnings).toBeDefined()
      expect(res.warnings?.[0]).toMatch(/strictly capped at 60 seconds/)
    })

    it('strictly requires vertical aspect ratio and <=90s for Instagram Reels', () => {
      const landscape = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 30, aspectRatio: '16:9' },
        'INSTAGRAM'
      )
      expect(landscape.valid).toBe(false)
      expect(landscape.error).toMatch(/Instagram Reels requires vertical video/)

      const over90s = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 95, aspectRatio: '9:16' },
        'INSTAGRAM'
      )
      expect(over90s.valid).toBe(false)
      expect(over90s.error).toMatch(/maximum allowed duration is 90 seconds/)

      const validReel = validateClipForPublish(
        { videoUrl: 'https://r2.cliptica.com/c.mp4', duration: 35, aspectRatio: '9:16' },
        'INSTAGRAM'
      )
      expect(validReel.valid).toBe(true)
    })
  })

  describe('5. Platform Publishing Adapters Mock Execution', () => {
    it('dispatches properly formatted TikTok Content Posting API payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'v_pub_tiktok_778899' } }),
      } as Response)

      const result = await publishToTikTok('mock_tiktok_access_token', {
        title: 'Secret Viral Growth Hack #Shorts',
        videoUrl: 'https://r2.cliptica.com/clips/clip-1.mp4',
        privacy: 'PUBLIC_TO_EVERYONE',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const callArgs = fetchSpy.mock.calls[0]
      expect(callArgs[0]).toBe('https://open.tiktokapis.com/v2/post/publish/video/init/')

      const reqBody = JSON.parse(callArgs[1]?.body as string)
      expect(reqBody.post_info.title).toBe('Secret Viral Growth Hack #Shorts')
      expect(reqBody.post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE')
      expect(reqBody.source_info.source).toBe('PULL_FROM_URL')
      expect(reqBody.source_info.video_url).toBe('https://r2.cliptica.com/clips/clip-1.mp4')

      expect(result.success).toBe(true)
      expect(result.postId).toBe('v_pub_tiktok_778899')
      expect(result.status).toBe('PROCESSING')
    })

    it('dispatches resumable YouTube Shorts upload flow', async () => {
      // 1. Download video media
      // 2. Initiate resumable upload session (returns Location header)
      // 3. Upload bytes to Location header
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'video/mp4' }),
          arrayBuffer: async () => new ArrayBuffer(1024),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ location: 'https://www.googleapis.com/upload/session/12345' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'yt_video_id_99' }),
        } as unknown as Response)

      const result = await publishToYouTube('mock_yt_access_token', {
        title: 'Insane AI Productivity Tip',
        description: 'Watch until the end for the tool reveal.\n\n#Shorts #Cliptica',
        videoUrl: 'https://r2.cliptica.com/clips/clip-2.mp4',
        privacy: 'public',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
      expect(result.postId).toBe('yt_video_id_99')
      expect(result.postUrl).toBe('https://youtube.com/shorts/yt_video_id_99')
      expect(result.status).toBe('PUBLISHED')
    })

    it('dispatches 3-step Instagram Reels container creation and publish flow', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        // Step 1: Create Container
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ig_container_123' }),
        } as unknown as Response)
        // Step 2: Poll container status
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status_code: 'FINISHED' }),
        } as unknown as Response)
        // Step 3: Media Publish
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ig_reel_media_456' }),
        } as unknown as Response)

      const result = await publishToInstagram(
        'mock_meta_token',
        {
          title: '3 Daily Habits',
          description: '3 daily habits that changed everything.\n\n#Reels #Mindset',
          videoUrl: 'https://r2.cliptica.com/clips/clip-3.mp4',
        },
        'ig_user_id_77'
      )

      expect(fetchSpy).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
      expect(result.postId).toBe('ig_reel_media_456')
      expect(result.postUrl).toBe('https://www.instagram.com/reel/ig_reel_media_456/')
      expect(result.status).toBe('PUBLISHED')
    })
  })

  describe('6. Token Refresh Adapters', () => {
    it('refreshes TikTok tokens using refresh_token grant', async () => {
      process.env.TIKTOK_CLIENT_KEY = 'test_key'
      process.env.TIKTOK_CLIENT_SECRET = 'test_secret'

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            access_token: 'new_tiktok_access_token_999',
            refresh_token: 'new_tiktok_refresh_token_999',
            expires_in: 7200,
          },
        }),
      } as Response)

      const refreshed = await refreshTikTokToken('old_refresh_token')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(refreshed.accessToken).toBe('new_tiktok_access_token_999')
      expect(refreshed.refreshToken).toBe('new_tiktok_refresh_token_999')
      expect(refreshed.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('refreshes YouTube tokens using Google OAuth endpoint', async () => {
      process.env.YOUTUBE_CLIENT_ID = 'test_google_id'
      process.env.YOUTUBE_CLIENT_SECRET = 'test_google_secret'

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_google_access_token_888',
          expires_in: 3600,
        }),
      } as Response)

      const refreshed = await refreshYouTubeToken('old_google_refresh_token')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(refreshed.accessToken).toBe('new_google_access_token_888')
      expect(refreshed.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('refreshes Instagram/Meta tokens using fb_exchange_token', async () => {
      process.env.INSTAGRAM_CLIENT_ID = 'meta_app_id'
      process.env.INSTAGRAM_CLIENT_SECRET = 'meta_app_secret'

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_meta_long_lived_token_777',
          expires_in: 5184000, // 60 days
        }),
      } as Response)

      const refreshed = await refreshInstagramToken('current_meta_token')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(refreshed.accessToken).toBe('new_meta_long_lived_token_777')
      expect(refreshed.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })
  })
})
