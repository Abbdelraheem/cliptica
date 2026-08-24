/**
 * Credit pricing for the clipping pipeline.
 * 1 credit per started minute of source video, +2 flat when AI motion
 * graphics (fx) were actually rendered. Always at least 1 credit.
 */
export function calcCredits(durationSeconds, fx) {
  return Math.max(1, Math.ceil(durationSeconds / 60)) + (fx ? 2 : 0)
}
