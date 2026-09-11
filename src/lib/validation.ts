import { z } from 'zod'

/** Hard ceiling per payout request (USD). */
export const MAX_PAYOUT_AMOUNT = 10_000

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100).optional(),
  deviceId: z.string().min(8).max(256),
})

export const emailOnlySchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(8),
})

export const verificationTokenSchema = z.object({
  token: z.string().min(32).max(128),
})

export const payoutCreateSchema = z.object({
  campaignId: z.string().min(1).max(128).nullable().optional(),
  clipId: z.string().min(1).max(128).nullable().optional(),
  amount: z
    .number()
    .positive()
    .max(MAX_PAYOUT_AMOUNT, `Amount cannot exceed $${MAX_PAYOUT_AMOUNT.toLocaleString()} per payout`),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().max(1000).optional(),
})

/** Converts "1:05:30" / "4:10" / 90 into seconds. */
export function parseClipFrom(v?: string | number): number {
  if (v === undefined) return 0
  if (typeof v === 'number') return v
  const parts = v.split(':').map(Number)
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}

export const VALID_CAPTION_STYLES = [
  'hormozi',
  'bold_impact',
  'bounce_side',
  'pill_box',
  'tiktok_classic',
  'clean_minimal',
  'classic_subtitle',
  'slow_fade',
  'cinematic_caps',
  'podcast_soft',
  'neon_highlight',
  'highlighter',
  'typewriter',
  'two_tone',
  'glitch_flicker',
] as const

export const clipAdjustSchema = z
  .object({
    start: z.number().min(0, 'Start time must be >= 0'),
    end: z.number().min(0, 'End time must be > start time'),
    captionStyle: z.enum(VALID_CAPTION_STYLES).optional(),
  })
  .refine((data) => data.end > data.start, {
    message: 'End time must be greater than start time',
    path: ['end'],
  })
  .refine((data) => data.end - data.start >= 15, {
    message: 'Clip duration must be at least 15 seconds',
    path: ['end'],
  })
  .refine((data) => data.end - data.start <= 120, {
    message: 'Clip duration cannot exceed 120 seconds',
    path: ['end'],
  })

export const CLIP_ADJUST_FREE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function calcClipAdjustCost(clipCreatedAt: Date | string | number, now = Date.now()): number {
  const createdTime = new Date(clipCreatedAt).getTime()
  return now - createdTime <= CLIP_ADJUST_FREE_WINDOW_MS ? 0 : 1
}

