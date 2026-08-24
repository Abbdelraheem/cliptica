import { describe, it, expect } from 'vitest'
import { parseClipFrom } from '@/lib/validation'

describe('parseClipFrom', () => {
  it('returns 0 for undefined input', () => {
    expect(parseClipFrom(undefined)).toBe(0)
  })

  it('passes numbers through as seconds', () => {
    expect(parseClipFrom(90)).toBe(90)
    expect(parseClipFrom(0)).toBe(0)
  })

  it('parses MM:SS strings', () => {
    expect(parseClipFrom('1:30')).toBe(90)
    expect(parseClipFrom('0:59')).toBe(59)
    expect(parseClipFrom('10:00')).toBe(600)
  })

  it('parses HH:MM:SS strings', () => {
    expect(parseClipFrom('1:05:30')).toBe(3930)
    expect(parseClipFrom('2:00:00')).toBe(7200)
  })

  it('treats two-part input as minutes:seconds even with large first part', () => {
    // "75:20" = 75 minutes 20 seconds
    expect(parseClipFrom('75:20')).toBe(4520)
  })
})
