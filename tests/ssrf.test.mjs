import { describe, it, expect } from 'vitest'
import { assertPublicHttpUrl, isPrivateIp } from '../worker/ssrf.mjs'

describe('isPrivateIp', () => {
  const privateCases = [
    '127.0.0.1',
    '10.0.0.5',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata endpoint
    '172.16.0.1',
    '172.31.255.255',
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ]

  const publicCases = ['8.8.8.8', '142.250.185.78', '172.32.0.1', '1.1.1.1']

  it.each(privateCases)('blocks private/reserved address %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true)
  })

  it.each(publicCases)('allows public address %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(false)
  })
})

describe('assertPublicHttpUrl', () => {
  it('rejects malformed URLs', async () => {
    await expect(assertPublicHttpUrl('not-a-url')).rejects.toThrow('Invalid URL')
  })

  it('rejects non-http protocols (file, ftp)', async () => {
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toThrow(
      'Only http/https URLs are allowed'
    )
    await expect(assertPublicHttpUrl('ftp://example.com/video.mp4')).rejects.toThrow(
      'Only http/https URLs are allowed'
    )
  })

  it('rejects literal loopback and private IP targets without DNS lookup', async () => {
    await expect(assertPublicHttpUrl('http://127.0.0.1/x')).rejects.toThrow(/Blocked non-public/)
    await expect(assertPublicHttpUrl('http://10.1.2.3/x')).rejects.toThrow(/Blocked non-public/)
    await expect(assertPublicHttpUrl('http://192.168.0.10/x')).rejects.toThrow(/Blocked non-public/)
    await expect(assertPublicHttpUrl('http://[::1]/x')).rejects.toThrow(/Blocked non-public/)
    await expect(assertPublicHttpUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      /Blocked non-public/
    )
  })

  it('accepts a public literal IP target', async () => {
    await expect(assertPublicHttpUrl('https://8.8.8.8/video')).resolves.toBeUndefined()
  })

  it('accepts a real public hostname via DNS resolution', async () => {
    // example.com is a stable public host; resolves to public addresses only.
    await expect(assertPublicHttpUrl('https://example.com/video')).resolves.toBeUndefined()
  })
})
