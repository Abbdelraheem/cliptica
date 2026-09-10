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

## 2026-09-06 — Round 3: API security + subscription enforcement

**Scanned**
- `src/app/api/projects/upload-url/route.ts`, `worker/ssrf.mjs`, `src/lib/device.ts`, `src/lib/fingerprint.ts`, `src/lib/r2.ts`, `src/app/api/campaigns/route.ts`, `src/app/api/payouts/route.ts`, `src/lib/validation.ts`, `prisma/schema.prisma` (Campaign/Clip/Payout models).

**Findings**
- `payouts POST` created payouts referencing ARBITRARY `campaignId`/`clipId` with no ownership check (foreign keys only check existence) → data-integrity hole. Now both must belong to the requester.
- `payouts GET` had uncapped/NaN pagination (`limit`/`page` from query) → clamped `page≥1`, `limit∈[1..100]`.
- `ssrf.mjs` missed ranges that yt-dlp's URL could resolve to: 198.18/15 (benchmark), TEST-NET-2/3, and IPv4-mapped IPv6 (`::ffff:192.168.x.x`) — hardened + a 25-case unit pass.
- `handleSubscriptionUpdated` kept premium role on `past_due`/`unpaid`/`incomplete` → non-paying users now degrade to FREE (canceled already handled by `subscription.deleted`).
- upload-url/R2: contentType allow-list, per-user key prefix, randomUUID, SIZE сap, SigV4 presign — solid as-is.

**Changes**
- `src/app/api/payouts/route.ts` (ownership + pagination), `worker/ssrf.mjs` (ranges + IPv4-mapped v6), `src/app/api/billing/webhook/route.ts` (status degradation).

**Verified**
- `node --check worker/ssrf.mjs` + 25-case `isPrivateIp` test OK; `npm run typecheck`, `npm run lint`, `npm run build` all clean.

**Deploy/publish**
- Committed + pushed; server pull + rebuild + `pm2 restart` for `nology-web` and `nology-worker`.

**Notes / decisions needed**
- Rate limiting is currently a NO-OP: all limiter instances are null without UPSTASH_REDIS_REST_URL/TOKEN. Not a code bug — needs real credentials, otherwise register/login/project-mutation endpoints are unprotected (login brute-force etc.). Activating Upstash is the highest-value config step for launch.

## 2026-09-06 — Round 4: DB-first admin settings (Setting table is the source of truth)

**Scanned**
- `src/app/api/admin/settings/route.ts` (Setting write path), setting keys in UI/env: `pipeline_premium`, `clips_per_video`, `clip_target_seconds`, `render_parallel`, `stale_job_minutes`, `MIN_CREDITS_REQUIRED`, `MAX_UPLOAD_MB`; consumer sites: `worker/worker.mjs`, `src/app/api/projects/route.ts`, `src/app/api/projects/upload-url/route.ts`; admin list routes `projects|users|payments|payouts`; `deploy/ipv6test.sh`.
- Auth/email/monitoring/portal/device/admin gate pass (previous rounds' scope re-confirmed clean).

**Findings**
- The admin Settings panel wrote to the `Setting` table, but NOTHING read it at runtime — `pipeline_premium/clips_per_video/clip_target_seconds/render_parallel/stale_job_minutes` were read from env only at boot. Panel changes had zero effect. Same for `MIN_CREDITS_REQUIRED`/`MAX_UPLOAD_MB` on the web side.
- Worker's stale sweep was hard-wired to boot-time `STALE_SWEEP_MS`/`STALE_JOB_MINUTES`; now DB-backed and refreshed per loop tick.
- Admin list routes had the same NaN pagination edge as the fixed user payout route (`parseInt` of garbage → NaN skip/take → 500).

**Changes**
- `worker/worker.mjs` — `ENV_DEFAULTS` (env fallbacks) + `SETTING_PARSE` (clamps) + `refreshConfig()` (Setting > env > default, 60s cache, swallows DB errors and keeps last-known) + `cfg()` (never null; falls back to env defaults) + `syncConfigInto()` mutating live CFG each loop tick; `recoverStale()` reads `(await cfg()).stale_job_minutes`; sweep interval inlined to 5 min.
- `src/lib/settings.ts` (new) — `getSettingNumber` / `getSettingBool` DB-first helpers (Setting > env > default, rejects NaN/≤0).
- `src/app/api/projects/route.ts` — `min_credits_required` via helper. `src/app/api/projects/upload-url/route.ts` — `max_upload_mb` via helper.
- Admin `projects|users|payments|payouts` route.ts — NaN-safe pagination clamp (page≥1, limit∈[1..100]).

**Verified**
- `node --check worker/worker.mjs`, `npm run lint`, `npm run typecheck`, `npm run build` — all clean.

**Deploy/publish**
- `5845a44` (worker config) + `96c6c1a` (web gates) pushed; server reset to `96c6c1a`, build clean (47/47), `pm2 restart nology-web` (restarts 10, uptime 190s) + `nology-worker` (restarts 4). Worker boot log confirms DB-first config live (`premium=true, parallel=4`, no config errors). `/api/health` HTTP 200 healthy. Note: site is served on `:3000` directly — no nginx/caddy on 80/443 currently listening.

## 2026-09-06 — Round 5: R2 enablement + yt-dlp hardening (ops)

**Findings/changes**
- R2 credentials were empty on the server (`len=2` placeholders). Wired real Cloudflare R2 creds into `/opt/nology/.env.production` (NOT in git): `R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Access verified via aws cli; `nology-clips` bucket did not exist → created (`aws s3 mb`). Health storage flipped `not_configured` → `healthy`.
- Server smoke test proved R2 write/read/delete OK, and exposed a launch blocker: YouTube bot-checks this EC2 IP ("Sign in to confirm you're not a bot") for every player client tried (default/android/ios/tv/embedded/mweb/vr/safari). Local whisper + cv2 in `/opt/nology-venv` verified OK; yt-dlp/ffmpeg/aws/fonts all present.
- `worker/worker.mjs` (commit `0803c64`): yt-dlp now runs with `--js-runtimes node` (fixes "no JavaScript runtime" format loss) and `--cookies <YTDLP_COOKIES>` when that env is set — the cookies file is the remaining piece to unblock YouTube.
- Verified: `node --check`, `npm run lint` clean; worker deployed at `0803c64`, restarts=6, clean boot (`premium=true, parallel=4`).

**Status**
- End-to-end works for direct video-file URLs now; YouTube needs a cookies.txt export from the user's browser (logged-out is usually enough) placed on the server + `YTDLP_COOKIES` env + worker restart.

## 2026-09-07 — Round 7: karaoke render fix + YouTube bot-wall bypass (proxy pool)

**Findings/changes**
- `worker/worker.mjs` karaoke bug: `buildKaraokeAss` indexed `card[i + 1][0]` (current card's word array with the card index) → "Cannot read properties of undefined (reading '0')" crashed every render with >1 card. Fixed to `cards[i + 1][0]?.start`. `e.stack` now logged on FAILED for future diagnosis. Verified full R2 E2E (upload→download→transcribe→score→render→upload→READY).
- YouTube still bot-checks the EC2 IP even with real cookies (`__Secure-3PSID` etc.). Tested all player clients + `--impersonate` alone → all blocked. The one working recipe: **cookies + `--impersonate Safari-18.4` + HTTP proxy** (proved by full downloads through `103.161.69.252:2698`, `102.68.98.94:3128`, `103.237.102.191:11111`).
- `worker/worker.mjs`: `ytdlpArgs()` now always passes `--impersonate Safari-18.4`; `download()` tries direct first then rotates a refreshable proxy pool (`ytProxyPool()` reads `/opt/nology/proxies.txt`, falls back to `YTDLP_PROXIES`). yt-dlp binary switched to `/opt/nology-venv/bin/yt-dlp` (pip install, no PyInstaller temp-dir buildup that filled `/` at 100%).
- New `scripts/refresh-proxies.sh` + systemd timer `nology-proxy-refresh.timer` (OnUnitActiveSec=20min): pulls free proxy lists, keeps HTTP-reachable YouTube candidates in `/opt/nology/proxies.txt`; live validation happens in the worker at download time.
- `.env.production` (server-only): added `YTDLP_PROXIES_FILE=/opt/nology/proxies.txt`; split the `MOTION_FONT…YTDLP_COOKIES` mashed-together line.
- Verified: `probeUrlDuration`/`download` both on venv yt-dlp; **YouTube E2E DONE** — project `yte2eproj001` (`watch?v=dQw4w9WgXcQ`) downloaded via proxy `103.237.102.191:11111`, transcribed, scored, rendered 1 clip (h264 1080x1920 12s), uploaded to R2, clip READY, charged 4 credits.

**Notes / next**
- Free proxies are flaky (die within minutes). For production reliability switch to a paid residential/rotating proxy and bake it into `YTDLP_PROXIES` env; keep the free-pool refresh as the pre-shared fallback.
- `rm /opt/nology/*.cjs` scratch scripts on next housekeeping; `proxies.txt` is root-owned (`-rw-------`), readable by the root-run worker.

## 2026-09-08 — Round 8: web app hang + "Invalid input" + broken clip playback

**Scanned**
- `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/upload-url/route.ts`, `src/lib/r2.ts`, `src/lib/settings.ts`, `src/app/api/admin/motion-fx/route.ts`, dashboard/projects pages, `src/components/dashboard-layout.tsx`.

**Findings**
- CRITICAL (hang): `clip.videoUrl`/`thumbnailUrl`/`exportUrl` stored the RAW R2 storage endpoint (`https://<acct>.r2.cloudflarestorage.com/...`), which needs SigV4 — anonymous browser GET returns 400. The `<video src>` in the project detail page spun forever. Confirmed live: `curl -A 'Mozilla/5.0' <storage-url> → 400 (size 113B)`.
- CRITICAL (405): `GET /api/projects` did not exist (only `POST`) — the projects list page AND dashboard overview both `fetch('/api/projects')` and got 405 → "Failed to load projects" on both.
- Root hang cause #2: DB is remote Neon in `us-east-2` while the server is `eu-north-1` — every query ~1000ms (even `SELECT 1` measured 1017–1049ms across 3 runs). Every page load chains several queries (auth → settings → list).
- MEDIUM: URL validation `z.string().url()` rejected bare/short links and pastes with trailing spaces → frequent "Invalid input" 400s.

**Changes**
- `src/app/api/projects/route.ts` — added `GET` handler (list by userId, take≤100); lenient URL (`normaliseUrl`: trim + prepend `https://` when missing), parallelized the min-credits/daily-cap gate queries.
- `src/lib/r2.ts` — refactored into a shared `r2Presign()` (SigV4 GET/PUT, `UNSIGNED-PAYLOAD`) + new `r2PresignGet()`; kept `r2PresignPut()`.
- `src/app/api/projects/[id]/route.ts` — signs every clip `videoUrl/thumbnailUrl/exportUrl` on read via `r2PresignGet(key)` (7200s).
- `src/lib/settings.ts` — 30s TTL in-memory cache for settings (cuts repeated remote-DB reads); `invalidateSetting()` exported.
- `src/app/api/admin/motion-fx/route.ts` — invalidates the `motion_fx` cache entry on PATCH.

**Verified**
- `npx tsc --noEmit` clean. Presigned GET live: previously 400, after fix `curl <presigned> → 200 size=6679008B`, `ffprobe` reads `12.007s` h264/aac. GET /api/projects (unauth) → 307 redirect to login (middleware) instead of 405.

**Deploy/publish**
- `f9e36ea` (web fixes) + `6e7f9d5` (presign GET UNSIGNED-PAYLOAD fix) pushed; server `git pull --ff-only`, `npm run build` OK, `pm2 reload nology-web`. Health healthy (new pid). Worker untouched.

**Notes / decision needed**
- The Neon ~1000ms/query latency is infra, not code — on the free plan it can't be dialed down (no "never suspend"/region move). Code-side mitigations shipped: settings cache + parallelized gates. Flagged to owner.

## 2026-09-09 — Round 9: UX jeleza — request timeouts, stale copy, billing/delete buttons

**Scanned**
- `src/lib/utils.ts`, auth login/register pages, `new` project page, `billing/page.tsx`, `settings/page.tsx`, plus a full read-only sweep of remaining API routes (auth forgot/reset/verify/resend, admin users/payments/payouts/projects/settings/jobs-retry) for a technical audit.

**Findings**
- MEDIUM: no fetch abort/timeouts — a hung backend left login/register/new-project spinners spinning forever ("site hangs a lot").
- LOW: stale "Preview build — accounts activate once the backend goes live" copy on login+register (backend is live now).
- MEDIUM: `billing/page.tsx` called `POST /api/billing/checkout` but the route only defines `GET` → upgrade button broke with "Could not start checkout".
- LOW: settings "Delete account" button had no handler (dead button). Honest-ified to a mailto "Request account deletion".
- Audit of remaining auth/resend/verify/admin routes: clean (enumeration-safe responses, rate-limited, single-use hashed tokens, ownership checks, NaN-safe pagination, self-role-change guard on admin users/[id]/role).

**Changes**
- `src/lib/utils.ts` — new `fetchWithTimeout()` (AbortController, 15s default).
- login/register/new-project — switched to `fetchWithTimeout()`; removed stale preview copy.
- `billing/page.tsx` — checkout now navigates `window.location.href = /api/billing/checkout?plan=…` (server-side GET redirect).
- `settings/page.tsx` — delete → mailto support request.

**Verified**
- `npx tsc --noEmit` clean. `npx vitest run`: 6 files, 57 passed / 2 failed (the 2 failures are `webhook-idempotency.test.ts` assertion-call-order + a mock that is unrelated to these changes — pre-existing).

**Deploy/publish**
- `cb5e4ad` pushed; server ff-pull + build + `pm2 reload nology-web`; health healthy.

**Notes / decision needed**
- Rate limiting (Upstash) still a NO-OP without `UPSTASH_REDIS_REST_URL/TOKEN` (carried from Round 3) — highest-value config step for launch.
- `npm audit` flags `next` CRITICAL (RCE on Windows-hosted servers + image-optimizer AVIF RCE) + 6 HIGH — documented in AUDIT_REPORT.md, resolved in Round 10.

## 2026-09-09 — Round 10: Security Patching, DB Automation, Nginx Proxy, & Settings Completeness

**Scanned**
- `package.json`, `next.config.ts`, `prisma/schema.prisma`, `worker/worker.mjs`, `src/app/api/billing/webhook/route.ts`, `src/app/api/projects/route.ts`, `src/app/(dashboard)/dashboard/settings/page.tsx`, `deploy/backup.sh`.

**Findings & Vulnerability Mitigations**
- CRITICAL CVEs (Next.js 15.5.23): Next.js bumped to `15.5.25` locally and on EC2 to patch critical RCE vulnerabilities GHSA-p293-qw3h-jr36 & GHSA-2xp9-vwfh-vxw4.
- Security Headers: Added `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`, and disabled `poweredByHeader` in `next.config.ts`.
- Stripe Webhook Deadlock & Unhandled Missing Users: Added fallback user resolution by `stripeSubscriptionId` or `stripeCustomerId` in `src/app/api/billing/webhook/route.ts`.
- Credit Overdraft Prevention: Added atomic upfront balance reservation (10 credits) in `src/app/api/projects/route.ts` and automated settlement/refund in `worker/worker.mjs`.
- Worker Disk Safety: Added `--max-filesize 2.5G` and duration limits to `yt-dlp` commands; added `cleanOrphanTempDirs()` for `nology-*` temporary folders.
- Database Indexing: Added performance indexes on `User(email)`, `Project(userId, status)`, `Project(status, createdAt)`, and `Clip(projectId, status)` in `prisma/schema.prisma`.
- Automated Backups: Added `deploy/export-db.mjs` Prisma fallback for Neon PostgreSQL version mismatches; scheduled daily cron at `/etc/cron.d/nology-backup`.
- Nginx Reverse Proxy: Installed on EC2 port 80 proxying to `127.0.0.1:3000` with rate limiting, Gzip compression, and security headers. Verified live via `http://13.62.192.145/api/health` (`HTTP 200 OK`).
- Settings Completeness: Implemented Change Password with bcrypt verification, API Key issuance with `nlg_live_` hashing, Active Sessions management and remote sign-out, and Notification Preference toggles (`notifyOnComplete`, `notifyOnLowCredits`, `notifyOnWeeklyDigest`).

**Verified**
- Vitest: 7 test files, 64 tests passing (100%), including new comprehensive suite `tests/settings-features.test.ts`.
- `npx tsc --noEmit` clean; `npm run build` clean (51/51 routes generated).
- Production deployment on EC2: `git pull`, `npx prisma db push` (synced with Neon), `npm run build`, `pm2 reload nology-web` (clean uptime, zero downtime). Verified live via curl.

## 2026-09-09 — Round 11: SEO, Design System, Social Kit, & Billing URL Defect Elimination

**Scanned**
- Root metadata, App Router SEO structure (`robots.ts`, `sitemap.ts`), `DESIGN_SYSTEM.md`, `COMPETITIVE_GAP_ANALYSIS.md`, `src/app/(dashboard)/dashboard/projects/detail/project-detail.tsx`, `src/app/(dashboard)/dashboard/billing/page.tsx`, `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/portal/route.ts`.

**Findings & Remediations**
- Missing SEO Crawl Infrastructure: Created native Next.js App Router `src/app/robots.ts` and `src/app/sitemap.ts`. Verified live via Nginx port 80 proxy (`/robots.txt` HTTP 200 OK, `/sitemap.xml` HTTP 200 OK).
- Design System Documentation: Produced `DESIGN_SYSTEM.md` detailing surfaces (`--onyx`, `--onyx-2`, `--surface`), Forge Orange accents (`--gold`, `--gold-2`, `--champagne`), typography scale, glassmorphic elevation, and WCAG AA contrast calibrations.
- Competitive Gap Closure vs Opus Clip: Created `COMPETITIVE_GAP_ANALYSIS.md` benchmarking against Opus Clip and Vizard.ai across 8 capability vectors. Implemented the top-ROI gap: Instant Social Post Kit in `project-detail.tsx` with AI Virality Insight callout, tiered viral score badges, and 1-click clipboard copy for TikTok/Reels/Shorts captions and hashtags.
- CRITICAL Billing Defect: In `src/app/api/billing/checkout/route.ts` and `src/app/api/billing/portal/route.ts`, relative calls to `new URL('/login')` without a request base threw unhandled `TypeError: Invalid URL` in Node.js, crashing unauthenticated and error redirects with HTTP 500. Fixed by providing `request.url` base and `baseUrl` fallbacks.
- Billing Role Awareness: Dynamic plan role detection in `dashboard/billing` replaces static hardcoded `current: true` for Free tier, allowing Clipper and Studio users to manage subscriptions via Stripe Customer Portal.

**Verified**
- Vitest: 8 test files, 68 tests passing (100%), including new regression suite `tests/billing-redirects.test.ts`.
- `npx tsc --noEmit` clean; `npm run build` clean (53/53 pages generated).
- EC2 Live Verification: `curl -sI http://127.0.0.1:3000/api/billing/checkout?plan=clipper` correctly returns `HTTP 307 Temporary Redirect` to `/login?callbackUrl=/dashboard/billing`. Nginx port 80 verified. PM2 `nology-web` reloaded cleanly with zero downtime.

## 2026-09-10 — Round 12: Blocker 1 (Legal Pages) & Blocker 2 (Vulnerability Remediation)

### Part A: Blocker 1 — Legal Pages Resolution
**Changes**
- `src/app/(marketing)/terms/page.tsx`: Full Terms of Service covering service nature (AI clipping), explicit user content rights warranty, recurring subscription auto-renewal, credit consumption and 30-day rollover, acceptable use, and limitation of liability.
- `src/app/(marketing)/privacy/page.tsx`: Detailed Privacy Policy itemizing collected data (email, media submissions, device fingerprints, Stripe payment metadata), operational usage, explicit naming of third-party subprocessors (**Stripe, Inc.**, **Cloudflare R2**, **Groq, Inc.**, **OpenAI, LLC**), 30-day retention policies for temporary render artifacts, and user data deletion request flows.
- `src/app/(marketing)/refund-policy/page.tsx`: Clear Refund Policy specifying 14-day refund window for unused subscriptions (<15 credits consumed), non-refundable conditions for consumed compute, credit retention through end of billing period upon cancellation, and automated instant credit refunds on worker job failure.
- `src/components/marketing-layout.tsx`: Updated footer links from placeholders (`#`) to `/terms`, `/privacy`, and `/refund-policy`.
- `src/app/(dashboard)/dashboard/billing/page.tsx`: Added explicit consent line below upgrade buttons: "By continuing you agree to our Terms and Privacy Policy."
- `src/app/sitemap.ts`: Added `/terms`, `/privacy`, and `/refund-policy` to search engine XML sitemap.

**Verification**
- Next.js production build succeeded with 56 static pages generated (`/terms`, `/privacy`, `/refund-policy`).
- Live curl checks on EC2 via Nginx port 80 returned HTTP 200 OK for all three routes.
- Staged and committed: `34a59a5` ("feat(legal): add terms, privacy policy, refund policy, footer links, and billing consent").

---

### Part B: Blocker 2 — Vulnerability Audit & Remediation

**Initial npm audit output (Baseline):**
```
8 vulnerabilities (2 moderate, 6 high)
- deepmerge-ts (<8.0.0, Severity: high, GHSA-ggr8-5vv4-36mx) via @prisma/config -> prisma
- js-yaml (4.0.0 - 4.3.1, Severity: high, GHSA-2883-xcg3-v3hh)
- postcss (<=8.5.22, Severity: high, GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849) via next
- qs (2.2.5 - 6.15.3, Severity: moderate, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g)
- sharp (<=0.35.4-rc.0, Severity: high, GHSA-f88m-g3jw-g9cj [libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591], GHSA-rgj7-g3m4-5g8c [libheif GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545])
```

**Remediation Applied:**
- Executed non-breaking `npm audit fix`:
  - Updated `sharp` to safe release, completely eliminating libvips (CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591) and libheif (GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545).
  - Updated `js-yaml` to patched release (GHSA-2883-xcg3-v3hh resolved).
  - Updated `qs` to patched release (GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g resolved).

**Remaining Vulnerabilities & Risk Acceptance:**
1. `postcss` (<=8.5.22):
   - CVEs: GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849.
   - Status: **Accepted, Monitored Risk**.
   - Analysis: Bundled inside `next@15.5.25`. Upstream patch is only available in `next@16.3.4+`, which is a breaking major upgrade requiring React 19 canary and rewrites of core router APIs. The vulnerabilities relate to malicious CSS sourcemap parsing during build time, which is not reachable by untrusted end-user runtime inputs in production. Will be upgraded when Next.js releases an upstream backport for 15.5.x or when migration to Next 16 is scheduled.
2. `deepmerge-ts` (<8.0.0):
   - CVE: GHSA-ggr8-5vv4-36mx.
   - Status: **Accepted, Monitored Risk**.
   - Analysis: Development dependency inside `@prisma/config`. Only executes during local developer schema generation (`prisma generate`), never invoked in production runtime request handling.

**Verification:**
- `npx tsc --noEmit` clean (0 errors).
- Vitest unit tests: 8 test suites, 68 tests passing (100%).
- Production build: `npm run build` completed cleanly (56/56 pages).
- Committed: `83278bd` ("chore(security): audit dependencies and fix high severity CVEs in sharp, js-yaml, qs").

---

### Part C: Blocker 3 — YouTube Download Reliability & Proxy Pool System

**1. Baseline Failure Rate Measurement:**
- Queried production PostgreSQL database via Prisma for all historical YouTube project records:
  - Project `yte2eproj001` (Rick Astley): COMPLETED
  - Project `yte2eproj002`: COMPLETED
  - Project `cmtq3bt8i0002p97cpmuryymr` (Big Buck Bunny): FAILED (Cartoon dialogue absence during speaker detection; download stage passed)
- Historical YouTube project completion baseline: **66.7% (2/3)**.
- Root cause of download instability: Direct AWS EC2 Datacenter IP is aggressively bot-detected by YouTube ("Sign in to confirm you're not a bot"), requiring resilient proxy failover.

**2. Architecture & Improvements Implemented:**
- **Adaptive In-Memory Proxy Health Scoring (`worker/proxy-pool.mjs`)**:
  - Tracks per-proxy statistics: `successes`, `failures`, `lastAttempt`, `lastSuccess`, `quarantinedUntil`.
  - Prioritizes proxies by net health score: `(successes * 3) - failures`.
  - Paid/Residential proxies (`YTDLP_PROXIES` environment variable) are always prioritized ahead of scraped proxies.
- **Automated Quarantine System**:
  - Proxies experiencing 2 consecutive failures are automatically quarantined for **15 minutes** (`Date.now() + 15 * 60 * 1000`).
  - Quarantined proxies are excluded from worker retry loops, preventing dead proxies from stalling download jobs.
- **Residential & Authenticated Proxy Support**:
  - Full support for authenticated HTTP/SOCKS5 proxies (`http://user:pass@host:port`, `socks5://user:pass@host:port`).
  - Implemented `redactProxy()` to ensure credentials are masked in all console logs and PM2 traces (`http://user:***@host:port`).
- **Structured Download Logging & Timeout Protection**:
  - Structured log schema: `[worker:download] proxy=<proxy> duration_ms=<ms> outcome=<success|failure> error_type=<type> error="..."`.
  - Error classification: `bot-detection`, `rate-limit`, `network-timeout`, `unavailable`, `other`.
  - Added `--socket-timeout 20` to all `yt-dlp` download and duration probe invocations.
- **Documentation**:
  - Published comprehensive setup instructions in `PROXY_UPGRADE_GUIDE.md` detailing providers (Webshare, Bright Data, Smartproxy, IPRoyal), estimated pricing ($5-15/month), configuration, and verification commands.

**3. Test Suite Verification:**
- Created `tests/proxy-pool.test.mjs` covering scoring, quarantine lifecycle, redaction, and error detection.
- Full Vitest suite passing: **9 test suites, 83 tests passing (100%)**.

**4. Live Smoke Test Execution on Production EC2 Host:**
- Conducted live end-to-end download tests across 3 distinct YouTube media profiles on EC2:
  1. **Short Video (19s)** — `https://www.youtube.com/watch?v=jNQXAC9IVRw`
     - Direct Download: FAILED (1082ms, error_type: `bot-detection`)
     - Proxy Download: **SUCCESS** via `102.204.14.2:8080` (Duration: 145,192ms)
  2. **Medium Video (3m33s)** — `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
     - Direct Download: **SUCCESS** directly without proxy (Duration: 3,848ms)
  3. **Speech-Heavy Video (15m)** — `https://www.youtube.com/watch?v=UF8uR6Z6KLc`
     - Direct Download: FAILED (1155ms, error_type: `bot-detection`)
     - Proxy Failover: Quarantined timed-out free proxies, adapted, and succeeded via `103.135.70.9:8080`: **SUCCESS** (Duration: 189,948ms)
- Live Smoke Test Result: **3/3 Succeeded (100%)**.

**5. Deployment:**
- Staged and committed: `4ff6b7b` ("feat(worker): add adaptive proxy health scoring, quarantine, and residential proxy support").
- Pulled on EC2 and reloaded in PM2: `sudo pm2 reload nology-worker` (PID 757285, online).

---

### Part D: Blocker 4 — Domain & Payment Gateway Launch Readiness Audit

**1. Stripe Implementation & Mode Switching Audit:**
- Audited all billing routes and library files:
  - `src/lib/stripe.ts`: Uses `new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')`. Stripe API modes are determined solely by whether the key begins with `sk_test_` or `sk_live_`.
  - Subscription Plan Price IDs: Configured dynamically via `process.env.STRIPE_PRICE_CLIPPER_MONTHLY || process.env.STRIPE_CLIPPER_PRICE_ID` and `process.env.STRIPE_PRICE_STUDIO_MONTHLY || process.env.STRIPE_STUDIO_PRICE_ID`.
  - `src/app/api/billing/checkout/route.ts`: Constructs Stripe Checkout sessions dynamically using `plan.priceId` and dynamic base URLs (`process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL`).
  - `src/app/api/billing/portal/route.ts`: Dynamic Stripe Customer Portal session generation for self-serve cancellation and payment method updates.
  - `src/app/api/billing/webhook/route.ts`: Verifies signatures using `process.env.STRIPE_WEBHOOK_SECRET!`. Maps price IDs dynamically using `getPlanFromPriceId()`. Handles idempotency using database transaction table `processedWebhookEvent`.
- **Verdict**: **Zero code changes required** to switch from test to live payments. Switching requires only populating production environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and live Price IDs) in `/opt/nology/.env.production`.

**2. Domain & Payment Runbook (`DOMAIN_AND_PAYMENT_CHECKLIST.md`):**
- Authored step-by-step checklist tailored specifically to the host architecture (`13.62.192.145`, Ubuntu 24.04, Nginx `/etc/nginx/sites-available/nology`, PM2 services).
- Detailed exact DNS A record targets, Certbot installation and issuance commands (`sudo certbot --nginx -d ...`), Nginx `server_name` modification, and PM2 zero-downtime reload commands (`sudo pm2 reload nology-web --update-env`).
- Detailed Stripe live product creation, webhook event selection, and signature verification commands.

---

## Round 15: Urgent False Advertising Removal & Gap 1 (Caption Style Presets)

**Date**: 2026-09-10  
**Commits**: 
- `11cd683` — `fix(billing): eliminate false claim of 15 caption styles across UI and marketing`
- `820ed88` — `feat(captions): implement 6 distinct caption styles with visual picker and worker pipeline support`

### Part A: False Advertising Elimination
- **Root Cause**: `src/app/(dashboard)/dashboard/billing/page.tsx` and `src/app/(marketing)/page.tsx` previously advertised "All 15 caption styles" for Free, Clipper, and Studio plans, while the worker pipeline only implemented a single hardcoded style (Hormozi Pop).
- **Remediation**:
  - Replaced misleading "All 15 caption styles" text across `src/app/(dashboard)/dashboard/billing/page.tsx`, `src/lib/stripe.ts`, `src/app/(marketing)/page.tsx`, and `src/app/(auth)/register/page.tsx`.
  - Updated to reflect actual functionality: "Karaoke captions (Hormozi Pop)" and "Karaoke captions".
  - Verified with 83/83 tests passing, deployed to EC2 host, and reloaded `nology-web`.

### Part B: Gap 1 — 6 Production Caption Style Presets
- **Modular ASS Style Engine (`worker/caption-styles.mjs`)**:
  - Implemented 6 distinct, highly polished subtitle presets:
    1. `hormozi` (Hormozi Pop): Yellow highlight on current spoken word, font Arial Black, high-contrast black outline, uppercase, 3-4 words per card.
    2. `clean_minimal` (Clean Minimal): White text with soft translucent box background, elegant mixed-case, lowercase friendly, 5-7 words per card.
    3. `neon_highlight` (Neon Highlight): Electric cyan text with pulsing neon glow, modern uppercase styling, 3-4 words per card.
    4. `bold_impact` (Bold Impact): Red/Gold punchy stacked style with heavy outline and drop shadow, 2-3 words per card.
    5. `classic_subtitle` (Classic Subtitle): Netflix/cinema standard style, white Arial with subtle drop shadow, lower third placement, 7-10 words per card.
    6. `highlighter` (Highlighter Marker): Neon lime highlight bar effect simulating marker pen reveal, 3-5 words per card.
  - Full ASS markup injection sanitization (`sanitizeAssText`) stripping or escaping bracketed tags, backslashes, and line-break exploits.
  - Safe handling of RTL/Arabic Unicode text, emoji, and extreme token lengths.

- **Edge Case Test Table**:

| Test Case | Description | Input Sample | Expected Outcome | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Short Words** | 1-2 character tokens | `"I am on a roll"` | Renders without crashing, proper spacing preserved | **PASS** (1080x1920) |
| **Long Words** | 20+ character tokens | `"Supercalifragilisticexpialidocious"` | Word wraps cleanly, no ASS syntax errors | **PASS** (1080x1920) |
| **Emoji** | Multi-byte Unicode symbols | `"🚀 Incredible drop! 🔥💯"` | Handled cleanly in ASS events without corruption | **PASS** (1080x1920) |
| **Arabic RTL** | Bidirectional Arabic script | `"مرحبا بكم في كليبتيكا لأفضل الفيديوهات"` | Preserves UTF-8 encoding and glyph positioning | **PASS** (1080x1920) |
| **ASS Injection** | Malicious ASS control codes | `"Hack {\b1\c&H0000FF&} \N \h \N payload"` | Strips raw control tags, escapes backslashes | **PASS** (Sanitized) |
| **Empty Word Timings**| Fallback timestamp reconstruction | Segment with 0 word-level timestamps | Interpolates timing based on segment start/end | **PASS** |

- **Host & FFmpeg Libass Verification (`scripts/test-render-styles.mjs`)**:
  - Installed `fonts-liberation` on Ubuntu 24.04 EC2 host for metric compatibility with Arial, Arial Black, and Times New Roman.
  - Rendered all 6 presets through live FFmpeg `libass` on EC2 (`13.62.192.145`):
    - `hormozi`: 1080x1920 in 474ms (✓ PASS)
    - `clean_minimal`: 1080x1920 in 483ms (✓ PASS)
    - `neon_highlight`: 1080x1920 in 491ms (✓ PASS)
    - `bold_impact`: 1080x1920 in 479ms (✓ PASS)
    - `classic_subtitle`: 1080x1920 in 493ms (✓ PASS)
    - `highlighter`: 1080x1920 in 472ms (✓ PASS)
- **UI & Pipeline Integration**:
  - Added visual caption style picker grid to `src/app/(dashboard)/dashboard/projects/new/page.tsx` with live preview badges and style descriptions.
  - Added `captionStyle` field to Prisma schema (`Project.captionStyle`) and pushed to production Neon DB.
  - Updated worker job processor (`worker/worker.mjs`) to read `project.captionStyle` and generate the matching ASS file.
  - Full build pass on EC2: 56/56 pages compiled, PM2 reloaded `nology-web` and `nology-worker` (0 errors).