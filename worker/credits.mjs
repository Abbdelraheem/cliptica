/**
 * Per-video credit pricing for the clipping pipeline.
 * 1 credit per successfully generated video clip. Always at least 1 credit for a completed job.
 */
export function calcClipCredits(clipCount) {
  const count = typeof clipCount === 'number' && Number.isFinite(clipCount) ? Math.round(clipCount) : 1
  return Math.max(1, count)
}

/**
 * Legacy/fallback minute-based credit calculation.
 */
export function calcCredits(durationSeconds) {
  return Math.max(1, Math.ceil(durationSeconds / 60))
}

/** Max SOURCE length (minutes) a role's plan may process. */
export const PLAN_MAX_MINUTES = { FREE: 20, CLIPPER: 90, STUDIO: 180, ADMIN: 180 }

export function planMaxMinutes(role) {
  return PLAN_MAX_MINUTES[role] ?? PLAN_MAX_MINUTES.FREE
}

export function exceedsPlanMinutes(minutes, role) {
  return minutes > planMaxMinutes(role)
}
