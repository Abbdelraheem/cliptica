import { describe, it, expect, beforeEach } from 'vitest'
import {
  prioritizeProxies,
  recordProxyResult,
  getProxyRecord,
  clearProxyHealth,
  redactProxy,
  categorizeDownloadError,
  ytProxyPool,
} from '../worker/proxy-pool.mjs'

describe('proxy-pool', () => {
  beforeEach(() => {
    clearProxyHealth()
  })

  describe('redactProxy', () => {
    it('redacts password from HTTP proxy', () => {
      const red = redactProxy('http://alice:supersecret@proxy.com:8080')
      expect(red).toBe('http://alice:***@proxy.com:8080')
    })

    it('redacts password from SOCKS5 proxy', () => {
      const red = redactProxy('socks5://user:pass123@1.2.3.4:1080')
      expect(red).toBe('socks5://user:***@1.2.3.4:1080')
    })

    it('returns direct for falsy or empty proxy', () => {
      expect(redactProxy(null)).toBe('direct')
      expect(redactProxy('')).toBe('direct')
    })

    it('returns unauthenticated proxy unchanged', () => {
      expect(redactProxy('http://1.2.3.4:8080')).toBe('http://1.2.3.4:8080')
    })
  })

  describe('categorizeDownloadError', () => {
    it('detects bot detection errors', () => {
      expect(categorizeDownloadError(new Error("Sign in to confirm you're not a bot"))).toBe('bot-detection')
      expect(categorizeDownloadError(new Error('Captcha verification required'))).toBe('bot-detection')
    })

    it('detects rate limits', () => {
      expect(categorizeDownloadError(new Error('HTTP Error 429: Too Many Requests'))).toBe('rate-limit')
    })

    it('detects network timeouts', () => {
      expect(categorizeDownloadError(new Error('Connection timed out'))).toBe('network-timeout')
      expect(categorizeDownloadError(new Error('ETIMEDOUT: socket error'))).toBe('network-timeout')
    })

    it('detects video unavailability', () => {
      expect(categorizeDownloadError(new Error('Private video. Sign in to view.'))).toBe('unavailable')
      expect(categorizeDownloadError(new Error('Video unavailable'))).toBe('unavailable')
    })
  })

  describe('health scoring and quarantine', () => {
    it('records success and clears failure count', () => {
      recordProxyResult('http://proxy1:8080', false, 'timeout')
      expect(getProxyRecord('http://proxy1:8080').failures).toBe(1)

      recordProxyResult('http://proxy1:8080', true)
      const rec = getProxyRecord('http://proxy1:8080')
      expect(rec.successes).toBe(1)
      expect(rec.failures).toBe(0)
      expect(rec.quarantinedUntil).toBe(0)
    })

    it('quarantines proxy after 2 consecutive failures for 15 minutes', () => {
      const now = 1700000000000
      const origDateNow = Date.now
      Date.now = () => now
      try {
        recordProxyResult('http://badproxy:8080', false, 'timeout 1')
        expect(getProxyRecord('http://badproxy:8080').quarantinedUntil).toBe(0)

        recordProxyResult('http://badproxy:8080', false, 'timeout 2')
        expect(getProxyRecord('http://badproxy:8080').quarantinedUntil).toBe(now + 15 * 60 * 1000)
      } finally {
        Date.now = origDateNow
      }
    })

    it('filters out quarantined proxies from the pool', () => {
      const t0 = 1000000
      recordProxyResult('http://good:8080', true)
      recordProxyResult('http://bad:8080', false)
      recordProxyResult('http://bad:8080', false)

      const result = prioritizeProxies(['http://good:8080', 'http://bad:8080'], [], t0)
      expect(result).toContain('http://good:8080')
      expect(result).not.toContain('http://bad:8080')
    })

    it('restores quarantined proxy once quarantine period has elapsed', () => {
      const t0 = 1000000
      const origDateNow = Date.now
      Date.now = () => t0
      try {
        recordProxyResult('http://flaky:8080', false)
        recordProxyResult('http://flaky:8080', false)
      } finally {
        Date.now = origDateNow
      }

      expect(prioritizeProxies(['http://flaky:8080'], [], t0 + 10 * 60 * 1000)).toEqual([])
      expect(prioritizeProxies(['http://flaky:8080'], [], t0 + 16 * 60 * 1000)).toEqual(['http://flaky:8080'])
    })
  })

  describe('prioritization order', () => {
    it('prioritizes paid/env proxies before general proxies', () => {
      const envProxies = ['http://paid-res:8080']
      const candidates = ['http://free-scrape:8080', 'http://paid-res:8080']

      recordProxyResult('http://free-scrape:8080', true)

      const sorted = prioritizeProxies(candidates, envProxies)
      expect(sorted[0]).toBe('http://paid-res:8080')
      expect(sorted[1]).toBe('http://free-scrape:8080')
    })

    it('sorts by net health score (successes * 3 - failures)', () => {
      recordProxyResult('http://p1:8080', true)
      recordProxyResult('http://p2:8080', true)
      recordProxyResult('http://p2:8080', true)
      recordProxyResult('http://p3:8080', false)

      const sorted = prioritizeProxies(['http://p1:8080', 'http://p2:8080', 'http://p3:8080'])
      expect(sorted).toEqual(['http://p2:8080', 'http://p1:8080', 'http://p3:8080'])
    })
  })

  describe('ytProxyPool', () => {
    it('parses comma-separated env proxies', async () => {
      const list = await ytProxyPool({
        envProxies: 'http://u:p@p1:1080, socks5://u:p@p2:1080 ',
        filePath: '/nonexistent/path/file.txt',
      })
      expect(list).toEqual(['http://u:p@p1:1080', 'socks5://u:p@p2:1080'])
    })
  })
})
