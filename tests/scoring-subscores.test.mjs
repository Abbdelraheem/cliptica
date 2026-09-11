import { describe, it, expect } from 'vitest'

// Mirror the bilingual heuristic virality engine from worker.mjs
function computeHeuristicScores(text, dur = 35) {
  const AR_HOOKS = /\b(سر|أسرار|غلطة|أكبر غلطة|كارثة|إياك|انتبه|احذر|لا تسوي|لا تعمل|حقيقة|صدمة|نصيحة|سري|خطير|ليش|لماذا|كيف|هل تعلم|شو السبب|ما هو|تخيل|فكرك|مين|متى|بتعرف|أغرب|عجيب|مليون|ملايين|آلاف|ألف|أضعاف|بالمية|فجأة|اللي صار|المشكلة|الحل|اكتشفت|تعلمت|قصة|النتيجة)\b/ui
  const EN_HOOKS = /\b(secret|never|nobody|mistake|million|billion|why|how|what if|imagine|did you know|best|worst|stop|truth|exposed|warning|danger|actually|suddenly|problem|solution|discovered|story|first time)\b/gi

  const words = text.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const wps = wordCount / Math.max(10, dur)

  const firstSlice = words.slice(0, 15).join(' ')
  const hasOpeningQ = firstSlice.includes('?') || firstSlice.includes('؟')
  const hasOpeningEx = firstSlice.includes('!')
  const arHookCount = (text.match(AR_HOOKS) || []).length
  const enHookCount = (text.match(EN_HOOKS) || []).length
  const hookCount = arHookCount + enHookCount
  const openingHook = (firstSlice.match(AR_HOOKS) || []).length + (firstSlice.match(EN_HOOKS) || []).length

  let hookScore = 50 + (hookCount * 7) + (openingHook * 15) + (hasOpeningQ ? 16 : 0) + (hasOpeningEx ? 8 : 0)
  hookScore = Math.min(99, Math.max(40, Math.round(hookScore)))

  let paceBonus = 0
  if (wps >= 2.0 && wps <= 3.6) paceBonus = 18
  else if (wps >= 1.5 && wps < 2.0) paceBonus = 8
  else if (wps > 3.6 && wps <= 4.5) paceBonus = 10

  const endsCleanly = /[.!?؟]$/.test(text.trim())
  let retentionScore = 46 + paceBonus + (endsCleanly ? 12 : 0) + Math.min(18, Math.round(wordCount * 0.18))
  retentionScore = Math.min(98, Math.max(38, Math.round(retentionScore)))

  const hasNumbers = /\d+|مليون|آلاف|ألف|million|billion|10x|%/.test(text)
  let shareScore = 44 + (hookCount * 6) + (hasNumbers ? 15 : 0) + (hasOpeningQ ? 10 : 0)
  shareScore = Math.min(97, Math.max(35, Math.round(shareScore)))

  const overallScore = Math.round(hookScore * 0.42 + retentionScore * 0.35 + shareScore * 0.23)

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

  it('boosts hookScore and overallScore on Arabic viral questions and hooks', () => {
    const neutralAr = 'ذهبنا إلى المتجر واشترينا بعض التفاح والخبز لتناول طعام الغداء بالأمس.'
    const viralAr = 'ليش 90% من الناس بيعملوا أكبر غلطة بحياتهم؟ السر اللي ما حدا بيحكيه عن صناعة الملايين!'

    const neutral = computeHeuristicScores(neutralAr)
    const viral = computeHeuristicScores(viralAr)

    expect(viral.hookScore).toBeGreaterThan(neutral.hookScore)
    expect(viral.shareScore).toBeGreaterThan(neutral.shareScore)
    expect(viral.overallScore).toBeGreaterThan(neutral.overallScore)
  })

  it('boosts hookScore on high English keyword and question density', () => {
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
    expect(empty.hookScore).toBeGreaterThanOrEqual(40)
    expect(empty.retentionScore).toBeGreaterThanOrEqual(38)
    expect(empty.shareScore).toBeGreaterThanOrEqual(35)
    expect(empty.overallScore).toBeGreaterThanOrEqual(38)
  })
})

