import { describe, it, expect } from 'vitest'
import {
  clipAdjustSchema,
  calcClipAdjustCost,
  CLIP_ADJUST_FREE_WINDOW_MS,
  VALID_CAPTION_STYLES,
} from '@/lib/validation'

describe('clipAdjustSchema', () => {
  it('accepts valid 30s adjustment with default caption style', () => {
    const result = clipAdjustSchema.safeParse({
      start: 10,
      end: 40,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.start).toBe(10)
      expect(result.data.end).toBe(40)
      expect(result.data.captionStyle).toBeUndefined()
    }
  })

  it('accepts valid adjustment with specified captionStyle', () => {
    for (const style of VALID_CAPTION_STYLES) {
      const result = clipAdjustSchema.safeParse({
        start: 0,
        end: 60,
        captionStyle: style,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid caption style', () => {
    const result = clipAdjustSchema.safeParse({
      start: 10,
      end: 40,
      captionStyle: 'unsupported_font_party',
    })
    expect(result.success).toBe(false)
  })

  it('rejects start >= end', () => {
    const resultEq = clipAdjustSchema.safeParse({ start: 30, end: 30 })
    expect(resultEq.success).toBe(false)

    const resultGt = clipAdjustSchema.safeParse({ start: 45, end: 30 })
    expect(resultGt.success).toBe(false)
  })

  it('rejects duration shorter than 15 seconds', () => {
    const result = clipAdjustSchema.safeParse({ start: 10, end: 24 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      expect(errors.end).toBeDefined()
    }
  })

  it('accepts minimum 15-second clip duration', () => {
    const result = clipAdjustSchema.safeParse({ start: 10, end: 25 })
    expect(result.success).toBe(true)
  })

  it('rejects duration longer than 120 seconds', () => {
    const result = clipAdjustSchema.safeParse({ start: 0, end: 121 })
    expect(result.success).toBe(false)
  })

  it('accepts maximum 120-second clip duration', () => {
    const result = clipAdjustSchema.safeParse({ start: 10, end: 130 })
    expect(result.success).toBe(true)
  })

  it('rejects negative start time', () => {
    const result = clipAdjustSchema.safeParse({ start: -5, end: 30 })
    expect(result.success).toBe(false)
  })
})

describe('calcClipAdjustCost', () => {
  it('charges 0 credits if within 15 minutes of clip creation', () => {
    const now = Date.now()
    const justCreated = new Date(now - 2 * 60 * 1000) // 2 minutes ago
    expect(calcClipAdjustCost(justCreated, now)).toBe(0)

    const nearEdge = new Date(now - (CLIP_ADJUST_FREE_WINDOW_MS - 1000)) // 14m59s ago
    expect(calcClipAdjustCost(nearEdge, now)).toBe(0)
  })

  it('charges 1 credit if more than 15 minutes after clip creation', () => {
    const now = Date.now()
    const pastWindow = new Date(now - (CLIP_ADJUST_FREE_WINDOW_MS + 5000)) // 15m05s ago
    expect(calcClipAdjustCost(pastWindow, now)).toBe(1)

    const dayOld = new Date(now - 24 * 60 * 60 * 1000) // 1 day ago
    expect(calcClipAdjustCost(dayOld, now)).toBe(1)
  })
})
