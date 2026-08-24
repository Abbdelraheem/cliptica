import { describe, it, expect } from 'vitest'
import { calcCredits } from '../worker/credits.mjs'

describe('calcCredits', () => {
  it('charges minimum 1 credit for very short videos', () => {
    expect(calcCredits(1, false)).toBe(1)
    expect(calcCredits(10, false)).toBe(1)
    expect(calcCredits(0, false)).toBe(1)
  })

  it('charges exactly 1 credit at one minute', () => {
    expect(calcCredits(60, false)).toBe(1)
  })

  it('rounds up to the next started minute', () => {
    expect(calcCredits(61, false)).toBe(2)
    expect(calcCredits(119, false)).toBe(2)
    expect(calcCredits(120, false)).toBe(2)
    expect(calcCredits(121, false)).toBe(3)
  })

  it('adds flat +2 when AI motion fx was applied', () => {
    expect(calcCredits(60, true)).toBe(3)
    expect(calcCredits(300, true)).toBe(7)
    expect(calcCredits(15, true)).toBe(3)
  })

  it('matches the documented 10-minute no-fx price', () => {
    expect(calcCredits(600, false)).toBe(10)
  })
})
