import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma for settings lookup
vi.mock('@/lib/prisma', () => ({
  prisma: {
    setting: {
      findMany: vi.fn().mockResolvedValue([
        { key: 'nvidia_api_key', value: 'nvapi-test-key' },
        { key: 'groq_api_key', value: 'gsk-test-key' },
        { key: 'openai_api_key', value: 'sk-test-key' },
      ]),
    },
  },
}))

import { executeAiChatCompletion } from '@/lib/ai-provider'

describe('AI Resilience: Strongest-First Fallback Chain', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('falls through to Tier 2 (Groq) when Tier 1 (NVIDIA NIM) times out', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('integrate.api.nvidia.com')) {
        // Simulate NVIDIA NIM timing out after per-attempt limit
        const err = new Error('The operation was aborted due to timeout')
        err.name = 'TimeoutError'
        throw err
      }

      if (url.includes('api.groq.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({ moments: [{ index: 0, score: 95, title: 'Viral Moment' }] }),
                },
              },
            ],
          }),
        }
      }

      return { ok: false, status: 500, text: async () => 'Unexpected URL' }
    })

    const result = await executeAiChatCompletion({
      messages: [{ role: 'user', content: 'Score moments' }],
      timeoutMs: 100,
    })

    expect(result).toBeDefined()
    expect(result.provider).toBe('groq')
    expect(result.content).toContain('Viral Moment')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('falls through to Tier 3 (OpenAI) when both NVIDIA and Groq error or time out', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('integrate.api.nvidia.com')) {
        throw new Error('NVIDIA NIM 504 Gateway Timeout')
      }

      if (url.includes('api.groq.com')) {
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded: TPM limit reached',
        }
      }

      if (url.includes('api.openai.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'OpenAI fallback succeeded',
                },
              },
            ],
          }),
        }
      }

      return { ok: false, status: 500, text: async () => 'Unexpected URL' }
    })

    const result = await executeAiChatCompletion({
      messages: [{ role: 'user', content: 'Evaluate viral moments' }],
      timeoutMs: 100,
    })

    expect(result).toBeDefined()
    expect(result.provider).toBe('openai')
    expect(result.content).toBe('OpenAI fallback succeeded')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })
})
