/**
 * Credit pricing for the clipping pipeline.
 * 1 credit per started minute of source video, +2 flat when AI motion
 * graphics (fx) were actually rendered. Always at least 1 credit.
 */
export function calcCredits(durationSeconds, fx) {
  return Math.max(1, Math.ceil(durationSeconds / 60)) + (fx ? 2 : 0)
}

/** Max SOURCE length (minutes) a role's plan may process. */
export const PLAN_MAX_MINUTES = { FREE: 20, CLIPPER: 90, STUDIO: 180, ADMIN: 180 }

export function planMaxMinutes(role) {
  return PLAN_MAX_MINUTES[role] ?? PLAN_MAX_MINUTES.FREE
}

export function exceedsPlanMinutes(minutes, role) {
  return minutes > planMaxMinutes(role)
}
