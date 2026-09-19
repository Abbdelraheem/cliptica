import { describe, it, expect } from 'vitest'
import { enforceRateLimit, loginIpLimiter } from '@/lib/rate-limit'

describe('In-Memory Rate Limiter Fallback', () => {
  it('should enforce rate limits and block excessive requests', async () => {
    const testId = `test-ip-${Date.now()}`
    
    // First 5 requests should pass (limit is 5 per 1m)
    for (let i = 0; i < 5; i++) {
      const blocked = await enforceRateLimit(loginIpLimiter, testId)
      expect(blocked).toBeNull()
    }

    // 6th request must be blocked with HTTP 429
    const blocked = await enforceRateLimit(loginIpLimiter, testId)
    expect(blocked).not.toBeNull()
    expect(blocked?.status).toBe(429)
  })
})
