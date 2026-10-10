import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promisify } from 'util'
import * as childProcess from 'child_process'

vi.mock('@/lib/ssrf', () => ({
  assertPublicHttpUrl: vi.fn().mockResolvedValue(new URL('https://www.youtube.com/watch?v=123')),
}))

vi.mock('child_process', () => {
  const customFn = vi.fn((_file, _args, _options) => {
    return Promise.resolve({ stdout: JSON.stringify({ view_count: 1500 }), stderr: '' })
  })
  const execFileMock = vi.fn((_file, _args, options, callback) => {
    const cb = typeof options === 'function' ? options : callback
    if (cb) cb(null, JSON.stringify({ view_count: 1500 }), '')
  })
  ;(execFileMock as any)[promisify.custom] = customFn

  return {
    execFile: execFileMock,
  }
})

import { detectPlatform, fetchVideoStatsWithYtDlp } from '@/lib/campaign-tracker'

describe('Campaign URL Safety & Command Injection Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detectPlatform accepts normal TikTok, Instagram, and YouTube URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890')).toBe('TIKTOK')
    expect(detectPlatform('https://tiktok.com/@user/video/1234567890')).toBe('TIKTOK')
    expect(detectPlatform('https://vm.tiktok.com/ZM8abcd/')).toBe('TIKTOK')
    expect(detectPlatform('https://m.tiktok.com/v/123456.html')).toBe('TIKTOK')

    expect(detectPlatform('https://www.instagram.com/reel/C1234567/')).toBe('INSTAGRAM')
    expect(detectPlatform('https://instagram.com/p/C1234567/')).toBe('INSTAGRAM')

    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('YOUTUBE')
    expect(detectPlatform('https://youtube.com/shorts/abc123xyz')).toBe('YOUTUBE')
    expect(detectPlatform('https://m.youtube.com/watch?v=abc123xyz')).toBe('YOUTUBE')
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('YOUTUBE')
  })

  it('detectPlatform returns UNKNOWN for query parameter deception and subdomain attacks', () => {
    expect(detectPlatform('https://evil.example/?tiktok.com')).toBe('UNKNOWN')
    expect(detectPlatform('https://tiktok.com.evil.example/x')).toBe('UNKNOWN')
    expect(detectPlatform('https://evil.example/instagram.com')).toBe('UNKNOWN')
    expect(detectPlatform('https://youtube.com.attacker.com/watch?v=1')).toBe('UNKNOWN')
    expect(detectPlatform('not-a-valid-url')).toBe('UNKNOWN')
    expect(detectPlatform('javascript:alert(1)')).toBe('UNKNOWN')
  })

  it('calls execFile with an argument array containing the sanitized URL as a single element and no shell option', async () => {
    const maliciousUrl = 'https://www.youtube.com/watch?v=$(touch /tmp/x)'
    const stats = await fetchVideoStatsWithYtDlp(maliciousUrl)

    expect(stats.views).toBe(1500)
    const customMock = (childProcess.execFile as any)[promisify.custom]
    expect(customMock).toHaveBeenCalledTimes(1)

    const [cmd, args, options] = customMock.mock.calls[0]
    expect(cmd).toBe('yt-dlp')
    expect(Array.isArray(args)).toBe(true)
    expect(args).toContain('--')
    expect(args[args.length - 1]).toBe(maliciousUrl)
    expect(options?.shell).toBeFalsy()
  })
})
