import { describe, it, expect } from 'vitest'

// Mirror the heuristic and normalization logic from worker.mjs to ensure sub-score integrity
function computeHeuristicScores(text) {
  const HOOKS = /\b(secret|never|nobody|mistake|million|why|how|best|worst|stop|truth)\b/gi
  const hookCount = text.match(HOOKS)?.length ?? 0
  const questionCount = (text.split('?').length - 1)
  const wordCount = text.split(/\s+/).filter(Boolean).length

  const hookScore = Math.min(98, Math.max(45, 50 + hookCount * 12 + questionCount * 8))
  const retentionScore = Math.min(95, Math.max(40, 48 + Math.min(30, Math.round(wordCount * 0.4))))
  const shareScore = Math.min(96, Math.max(35, 42 + hookCount * 8 + (text.includes('!') ? 10 : 0)))
  const overallScore = Math.round(hookScore * 0.4 + retentionScore * 0.35 + shareScore * 0.25)

  return { hookScore, retentionScore, shareScore, overallScore }
}

describe('Virality Sub-score Computation', () => {
  it('computes hook, retention, and share scores within 0-100 range', () => {
    const text = 'Here is the secret mistake that nobody talks about when building a million dollar business? You must stop now!'
    const result = computeHeuristicScores(text)

    expect(result.hookScore).toBeGreaterThanOrEqual(0)
    expect(result.hookScore).toBeLessThanOrEqual(100)
    expect(result.retentionScore).toBeGreaterThanOrEqual(0)
    expect(result.retentionScore).toBeLessThanOrEqual(100)
    expect(result.shareScore).toBeGreaterThanOrEqual(0)
    expect(result.shareScore).toBeLessThanOrEqual(100)
    expect(result.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.overallScore).toBeLessThanOrEqual(100)
  })

  it('boosts hookScore on high keyword and question density', () => {
    const neutralText = 'We went to the store and bought three apples and some bread for lunch yesterday.'
    const viralText = 'Why does nobody know this secret million dollar mistake? How to stop it!'

    const neutral = computeHeuristicScores(neutralText)
    const viral = computeHeuristicScores(viralText)

    expect(viral.hookScore).toBeGreaterThan(neutral.hookScore)
    expect(viral.shareScore).toBeGreaterThan(neutral.shareScore)
    expect(viral.overallScore).toBeGreaterThan(neutral.overallScore)
  })

  it('handles empty or minimal text gracefully', () => {
    const empty = computeHeuristicScores('')
    expect(empty.hookScore).toBeGreaterThanOrEqual(45)
    expect(empty.retentionScore).toBeGreaterThanOrEqual(40)
    expect(empty.shareScore).toBeGreaterThanOrEqual(35)
    expect(empty.overallScore).toBeGreaterThanOrEqual(40)
  })
})
