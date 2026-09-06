# AGENT_LOG — NOLOGY improvement rounds

Date format: YYYY-MM-DD. One entry per completed round (what was checked → what was changed → verified how).

## 2026-09-06 — Round 1: billing/credit-audit + lint cleanup

**Scanned**
- `worker/worker.mjs` (711 lines: img-tag pipeline), `worker/credits.mjs`, `src/lib/stripe.ts`, `src/lib/rate-limit.ts`, `src/app/api/projects/route.ts`, `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/webhook/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/health/route.ts`, `prisma/schema.prisma`, `src/lib/prisma.ts`, `deploy/pm2.ecosystem.config.cjs`.

**Findings**
- CRITICAL: double credit grant on subscription signup. `checkout.session.completed` AND the initial invoice's `invoice.payment_succeeded` both fire on a non-trial billing download, and each granted a full period of credits → new subscribers got 2x credits for month 1. `handleCheckoutCompleted` now only maps role/subscription IDs; credits are granted solely by `handleInvoicePaymentSucceeded`.
- Lint warnings in `src/app/api/health/route.ts`: unused `start`, unused `error` — fixed (removed `start`; `error` now logs the DB failure).
- Non-blocking: `STRIPE_WEBHOOK_SECRET`/Stripe keys, R2, GROQ/OPENAI intentionally empty in `.env.production` (health `not_configured` is honest). `STRIPE_WEBHOOK_SECRET!` is asserted non-null — must be set the day Stripe goes live.
- Worker charges `min(creditsSpent, balance)` — "balance is the hard floor" is by design; enqueue gate is `MIN_CREDITS_REQUIRED` (default 10).

**Changes**
- `src/app/api/health/route.ts` — removed `start`, log DB failure via `error`.
- `src/app/api/billing/webhook/route.ts` — `handleCheckoutCompleted` no longer increments credits or writes a purchase transaction.

**Verified**
- `npm run typecheck` — clean. `npm run lint` — clean (0 warnings). `npm run build` — clean (47/47 pages).

**Deploy/publish**
- Not yet deployed to EC2 (needs `git push` + `pm2 restart nology-web`).