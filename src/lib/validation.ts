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
