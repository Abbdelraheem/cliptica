import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promisify } from 'util'
import * as childProcess from 'child_process'

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}))

vi.mock('@/lib/ssrf', () => ({
  assertPublicHttpUrl: vi.fn().mockResolvedValue(new URL('https://www.youtube.com/watch?v=123')),
}))

const { execMock, execFileMock } = vi.hoisted(() => {
  type CustomPromisifyFn = (
    _file: string,
    _args: readonly string[],
    _options?: unknown
  ) => Promise<{ stdout: string; stderr: string }>

  const customFn: CustomPromisifyFn = vi.fn((_file: string, _args: readonly string[], _options?: unknown) => {
    return Promise.resolve({ stdout: JSON.stringify({ view_count: 1500 }), stderr: '' })
  })

  const customPromisifySymbol = Symbol.for('nodejs.util.promisify.custom')

  const execFileMock = Object.assign(
    vi.fn((_file: string, _args: readonly string[], options: unknown, callback?: (err: null, stdout: string, stderr: string) => void) => {
      const cb = typeof options === 'function' ? (options as (err: null, stdout: string, stderr: string) => void) : callback
      if (cb) cb(null, JSON.stringify({ view_count: 1500 }), '')
    }),
    {
      [customPromisifySymbol]: customFn,
    }
  )

  const execMock = vi.fn()
  return { execMock, execFileMock }
})

vi.mock('child_process', () => ({
  exec: execMock,
  execFile: execFileMock,
}))

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

  it('detectPlatform returns UNKNOWN for query parameter deception, subdomain attacks, and non-http(s) schemes', () => {
    expect(detectPlatform('https://evil.example/?tiktok.com')).toBe('UNKNOWN')
    expect(detectPlatform('https://tiktok.com.evil.example/x')).toBe('UNKNOWN')
    expect(detectPlatform('https://evil.example/instagram.com')).toBe('UNKNOWN')
    expect(detectPlatform('https://youtube.com.attacker.com/watch?v=1')).toBe('UNKNOWN')
    expect(detectPlatform('ftp://tiktok.com/video/123')).toBe('UNKNOWN')
    expect(detectPlatform('file:///etc/passwd')).toBe('UNKNOWN')
    expect(detectPlatform('javascript:alert(1)')).toBe('UNKNOWN')
    expect(detectPlatform('not-a-valid-url')).toBe('UNKNOWN')
  })

  it('calls execFile with an argument array containing the sanitized URL as a single element and no shell option', async () => {
    const maliciousUrl = 'https://www.youtube.com/watch?v=$(touch /tmp/x)'
    const stats = await fetchVideoStatsWithYtDlp(maliciousUrl)

    expect(stats.views).toBe(1500)
    const customMock = (childProcess.execFile as unknown as Record<symbol, ReturnType<typeof vi.fn>>)[promisify.custom]
    expect(customMock).toHaveBeenCalledTimes(1)

    const [cmd, args, options] = customMock.mock.calls[0] as [string, string[], { shell?: boolean } | undefined]
    expect(cmd).toBe('yt-dlp')
    expect(Array.isArray(args)).toBe(true)
    expect(args).toContain('--')
    expect(args[args.length - 1]).toBe(maliciousUrl)
    expect(args.filter((a) => a === maliciousUrl).length).toBe(1)
    expect(options?.shell).toBeFalsy()

    expect((childProcess as unknown as { exec: ReturnType<typeof vi.fn> }).exec).not.toHaveBeenCalled()
  })
})
