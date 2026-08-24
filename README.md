# Cliptica — AI Video Clipping Platform

Turns long videos (YouTube link or upload) into ready-to-post 9:16 short clips:
transcription → LLM moment ranking → face-tracked reframing → karaoke captions → FFmpeg render → Cloudflare R2.

## How It Actually Works

```
Browser ──► Next.js app (Vercel/VPS) ──► Postgres (Neon) + R2 presigned uploads
                    │ ProcessingJob(queued)
                    ▼
   Worker process (`worker/worker.mjs`, run via PM2 — see deploy/)
       1. yt-dlp download (SSRF-guarded: public http/https only, private-IP DNS blocked)
       2. ffprobe duration → plan length check (fail-fast before any AI spend)
       3. Groq Whisper word-level transcript
       4. LLM moment scoring (Groq Llama → OpenAI fallback → heuristics)
          — a heuristic/LLM engagement score with hook/retention/share sub-scores,
            not an ML predictive model
       5. InsightFace dominant-speaker tracking + FFmpeg 9:16 render,
          karaoke ASS captions, optional admin-only AI motion graphics
       6. QC probe → thumbnails → upload clips to R2
       7. Credits charged atomically (1/min source, +2 motion; never below zero)
```

**Queue**: the `ProcessingJob` table itself, claimed by an atomic conditional
update (safe for multiple worker instances), with stale-job requeue after
`STALE_JOB_MINUTES`. There is intentionally **no Redis/BullMQ dependency**.

## Feature Reality

| Feature | Status |
|---|---|
| Email/password auth + email verification + password reset | ✅ real |
| Google/GitHub OAuth (account provisioned on first sign-in) | ✅ real (needs provider keys) |
| One-account-per-device enforcement | ✅ real |
| URL import / file upload (presigned R2 PUT, 500MB cap, type allowlist) | ✅ real |
| Transcription, clip selection, viral-style scoring, captions, reframe | ✅ real |
| Cinematic color grading / sound design / auto B-roll | ❌ **not implemented** |
| Stripe subscriptions + idempotent webhook credit grants | ✅ real (needs price IDs) |
| Credit ledger (auditable transactions, floor-at-zero) | ✅ real |
| Campaign ledger, earnings tracking, CSV export, payout records | ✅ real (payout approval is manual/offline) |
| Posting calendar heatmap | ✅ basic (PostingDay counts) |

Plans: Free 40 credits once · Clipper $19 → 300/mo · Studio $49 → 1,200/mo.
1 credit ≈ 1 minute of source video. Daily project caps and per-plan max
source length are enforced server-side.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma + PostgreSQL ·
NextAuth v4 (JWT sessions) · TanStack Query · Stripe · Groq/OpenAI · FFmpeg +
yt-dlp + InsightFace in the worker · Cloudflare R2 · Upstash rate limiting
(optional, no-ops when unset) · Sentry-compatible error tracking (optional).

## Getting Started

```bash
npm install
cp .env.example .env      # fill DATABASE_URL at minimum
npx prisma migrate deploy # or: npx prisma db push for first boot
npm run dev

# tests / checks
npm run test        # vitest unit suite
npm run typecheck
npm run lint
npm run build

# production worker (on a box with ffmpeg, yt-dlp, aws cli, python+insightface)
cd worker && npm install && npx prisma generate
pm2 start ../deploy/ecosystem.config.cjs

# promote an account to ADMIN (enables AI motion graphics controls)
npm run db:admin -- you@example.com
```

Required binaries on the worker host: `ffmpeg`, `ffprobe`, `/usr/local/bin/yt-dlp`,
`aws` (R2 sync), Python env for the premium face-tracking step (`worker/premium/faces.py`).

## Deployment Shape

- **Web/API**: one Next.js deployment (Node runtime — APIs do not work on the
  static GitHub Pages export; that export is marketing/preview only).
- **Worker**: long-lived process on a CPU box (Oracle ARM free tier is enough
  to start). Not serverless — renders take minutes.
- **DB**: managed Postgres (Neon). **Storage**: private R2 bucket.
- Migrations: single baseline under `prisma/migrations/`; apply with
  `prisma migrate deploy`.

Security posture: ownership scoping on every query, Zod validation everywhere,
rate-limited auth + mutations, atomic webhook idempotency (unique event id),
atomic job claiming, SSRF guard on imports, security headers, no client-trusted
financial fields.
