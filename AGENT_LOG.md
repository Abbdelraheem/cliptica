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
- Deployed to EC2: rebased server `main` over the fix (server had 3 unpushed local commits — email design, landing perf, health fix — one conflicted with ours on health/route.ts; resolved using our logging version).
- npm build OK on server; `pm2 restart nology-web` (restarts 8, online); `/api/health` = healthy (db 1027ms, storage/payments/ai not_configured — expected, unconfigured secrets).
- Reconciliation: server can't push (no SSH/https creds) → pulled the 2 remaining server commits as `git format-patch` → applied with `git am` locally (d49eecd, cd7572a) → pushed to origin → `git reset --hard origin/main` on server. Result: GitHub=local=server all at `cd7572a`, zero divergence.

## 2026-09-06 — Round 2: worker deep audit (render cost, thumbnails, retry, recovery)

**Scanned**
- `worker/worker.mjs` in full (711→~760 lines: download, transcribe Groq/local, scoring chain, face-track, karaoke ASS, motion-layer drawtext, render lanes, upload, atomic claim, loop), `worker/premium/faces.py`, admin retry routes (`jobs/[id]`, `projects/[id]`).

**Findings**
- BUG (thumbnails): `faces.thumb_ts` and `moment.start + 3` are ABSOLUTE source timestamps, but the thumbnail seek reads the rendered CLIP (relative 0). Seeks past EOF → blank/last-frame thumbnails on nearly every clip (both face-track and default paths). Fixed by offsetting by `moment.start` (and using `3` for the default path).
- COST: plan-limit check ran AFTER downloading the full source. A FREE user with a 40-min YouTube URL burned ~1-2 GB download+disk per reject (enqueue gate is cheap, 3/day). Added `yt-dlp --print duration --no-download` pre-probe (`ensureWithinPlan`); authoritative post-download check retained.
- ROBUSTNESS: stale `processing` jobs were only recovered once at boot; a crash hours later left jobs stuck until process restart. Recovery now runs on a periodic sweep (`STALE_SWEEP_MS`, default 5 min).
- RETRY DUPLICATION: a partially-failed run that already created READY clip rows, when re-queued, re-created duplicate clip rows + R2 objects. Clip creation is now idempotent (skip when a READY clip exists for the same `sourceStart`).

**Changes**
- `worker/worker.mjs` — thumbnail offset fix; `probeUrlDuration()` + `ensureWithinPlan()` pre-download gate; `STALE_SWEEP_MS`/`recoverStale()` periodic sweep; idempotent clip creation in the upload loop.

**Verified**
- `node --check worker/worker.mjs`, `npm run lint`, `npm run typecheck` — all clean.

**Deploy/publish**
- Committed + pushed to origin (server pull + `pm2 restart nology-worker` next).