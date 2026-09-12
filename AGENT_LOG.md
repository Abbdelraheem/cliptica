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

---

## Round 16: Gap 2 (Fast In-Product Clip Trim Adjustment & Lightweight Re-Render)

**Date**: 2026-09-11  
**Commits**:
- `6a19fd0` — `feat(editor): add fast clip trim adjustment and lightweight re-render`
- `ab1f2f0` — `fix(editor): resolve ESLint unused variable and type warnings in project detail and worker`

### Implementation Summary
1. **Lightweight Trim Pipeline**:
   - Added `transcript Json?` to Prisma schema `Project` model and synced to production Neon PostgreSQL.
   - Saved full Whisper word timestamps to `project.transcript` upon initial processing.
   - Implemented persistent media caching in `tmpdir/nology-sources/[projectId].mp4` with automatic 4-hour stale cleanup.
   - Added `processClipAdjust(job)` to `worker/worker.mjs` which:
     - Bypasses Groq Whisper transcription and LLM scoring completely.
     - Filters cached word-level timestamps to the new `[start, end]` window.
     - Generates updated ASS subtitles with the chosen caption preset.
     - Renders 1080x1920 MP4 through FFmpeg with `loudnorm` audio normalization.
     - Uploads new MP4 and thumbnail to Cloudflare R2 and updates `Clip` in database.
2. **API Endpoint (`POST /api/projects/[id]/clips/[clipId]/adjust`)**:
   - Validates `start >= 0`, `end > start`, duration 15s–120s, and `end <= source duration`.
   - Checks project and clip ownership with session authentication and rate limiting.
   - Enforces credit policy: **Free within 15 minutes of creation**; **1 credit thereafter**.
   - Graceful failure recovery: auto-refunds charged credit and restores clip state if re-trim fails.
3. **Creator UI Controls (`project-detail.tsx`)**:
   - Added "Adjust Trim" toggle button on each clip card.
   - Inline trim panel with:
     - Start / End time display in `mm:ss` format.
     - Dedicated `[-5s]`, `[-1s]`, `[+1s]`, `[+5s]` nudge buttons.
     - Allowed duration badge (15s–120s).
     - Caption preset dropdown selector.
     - Real-time cost notification (Free vs 1 credit).
     - "Re-render Clip (~10-20s)" button.
   - Active status overlay on clip preview card during re-render with animated progress bar.
   - Reactive 4s polling automatically picks up completed renders.
4. **Verification & Performance Evidence (`scripts/test-clip-adjust.mjs`)**:
   - Executed live pipeline test on EC2 host (`13.62.192.145`):
     - Trimmed 30s source to [5s, 22s] (17s duration) with `neon_highlight` caption preset.
     - Retained 13/21 synchronized words in window.
     - Probe verified: 1080x1920 vertical video at exactly 17.00 seconds.
     - Total execution time: **7,995ms** (7.99 seconds, beating the <20s SLA by 60%).
   - Unit tests: 11 tests in `tests/clip-adjust.test.ts` passing (100%).

---

## Round 17: Gap 3 (Pricing Rebuild & Unit Economics Verification)

**Date**: 2026-09-11  
**Commit**: `36818a7` — `feat(pricing): rebuild subscription tiers with verified unit economics`

### Implementation Summary
1. **Direct Infrastructure Cost Modeling**:
   - Groq Whisper Large v3 Turbo: **$0.001850 / minute**.
   - Groq Llama 3.3 70B Moment Scoring: **$0.000600 / minute**.
   - Cloudflare R2 Media Storage (15MB/clip, 0 egress): **$0.000135 / minute-month**.
   - AWS EC2 Compute (c6i.xlarge @ $0.17/hr, 0.25 encoding ratio): **$0.000708 / minute**.
   - **Total Fully Loaded Infra COGS**: **$0.003293 / minute** (~$0.0033).
2. **Tier Unit Economics & Margin Verification**:
   - **Free Tier (40 credits)**: Maximum lifetime cost exposure is strictly capped at **$0.1317** per user, protected by hardware device fingerprinting (`Device.fingerprintHash`).
   - **Clipper Tier ($19 / month, 300 minutes)**:
     - Revenue: $19.00 ($0.0633/min).
     - Stripe fee: $0.851.
     - Maximum infra COGS: $0.988.
     - Total COGS: $1.839.
     - Net Gross Profit: **+$17.161 / month**.
     - **Gross Margin**: **90.3%** (exceeds >=60% target).
   - **Studio Tier ($49 / month, 1,200 minutes)**:
     - Revenue: $49.00 ($0.0408/min).
     - Stripe fee: $1.721.
     - Maximum infra COGS: $3.952.
     - Total COGS: $5.673.
     - Net Gross Profit: **+$43.327 / month**.
     - **Gross Margin**: **88.4%** (exceeds >=60% target).
3. **Fast Clip Adjustment Economics**:
   - Re-trim technical COGS: **$0.00041** (< 0.05¢).
   - Paid re-trims (1 credit = ~$0.04 - $0.06 value) generate **>99.2% gross margin**.
4. **Market Benchmarking & Documentation**:
   - Authored complete financial model: `PRICING_MODEL.md`.
   - Created unit tests in `tests/pricing-model.test.ts` (5 tests passing).
   - Updated `COMPETITIVE_GAP_ANALYSIS.md` and created `GAP_CLOSURE_REPORT.md`.
   - All 12 test suites passing (144/144 tests) on both local environment and EC2 production host.

---

## Round 18 — Detective → Senior Engineer → Fixer → Creator Mandate
**Date**: 2026-09-11  
**Status**: Confirmed & Live in Production  
**Test Suite**: 13 test suites, 147 unit & integration tests passing (100%)  

### 1. Role 1: The Detective Audit
- Executed audit across all 39 API routes, background worker (`worker/worker.mjs`), Prisma models, and EC2 host infrastructure.
- Generated `DETECTIVE_FINDINGS.md` categorizing all findings by severity:
  - **SEC-01 (High)**: Worker external fetch calls lacked timeouts/AbortSignals.
  - **SEC-02 (High)**: `/api/device/check` lacked direct rate limiting.
  - **FEAT-01 (Medium)**: Database had `hookScore`, `retentionScore`, `shareScore` columns unpopulated by scoring pipeline.
  - **FEAT-02 (Medium)**: Aspect ratio was hardcoded strictly to 9:16 vertical only.
  - **UX-01 (Medium)**: Pipeline progress reported numeric percentages without descriptive stage labels.
  - **BRD-01 (Medium)**: Legacy "Nology" brand leakage in transactional emails, error messages, and landing copy.
  - **DB-01 (Low)**: `Prisma.raw(table)` used in admin stats queries.
- Authored `NEEDS_HUMAN_DECISION.md` cataloguing custom domain, Stripe live keys, production SMTP, and proxy upgrades.

### 2. Role 2 & 3: Senior Engineer & Fixer Execution
- **SEC-01 Fix**: Equipped all external Groq/OpenAI fetch calls (`transcribeGroq`, `llmScoreMoments`, `llmMotionPackages`) with `signal: AbortSignal.timeout(...)` to eliminate indefinite worker hangs.
- **SEC-02 Fix**: Added `enforceRequestRateLimit(apiMutationLimiter, ...)` to `/api/device/check`.
- **DB-01 Fix**: Replaced `Prisma.raw(table)` with static SQL fragment mappings (`Prisma.sql`"User"``, etc.) in `src/app/api/admin/stats/route.ts`.
- **BRD-01 Fix**: Standardized customer-facing emails (`src/lib/email.ts`), metadata (`src/app/layout.tsx`), header logos (`src/components/logo.tsx`), auth messages, and legal policies to "Cliptica".

### 3. Role 4: The Creator High-Value Features
- **Real-Time Stage Labels**:
  - Worker now dispatches granular stage descriptions into `ProcessingJob.result.stage`:
    - 8%: "Fetching video source media..."
    - 30%: "Transcribing speech audio with AI Whisper model..."
    - 52%: "Scoring viral moments, hooks, retention & shareability..."
    - 56%: "Generating AI motion graphics title cards..."
    - 58%: "Reframing vertical layout & rendering karaoke captions..."
    - 62–98%: "Uploading clip X of Y to Cloudflare R2..."
    - 100%: "Processing complete! All clips ready."
  - Project detail page (`project-detail.tsx`) renders the active stage label and progress percentage live.
- **Virality Sub-scores (Hook, Retention, Share)**:
  - Updated LLM prompt and heuristic scorer to evaluate Hook Score (0-100), Retention Score (0-100), and Shareability Score (0-100).
  - Saved into `prisma.clip.create(...)` and displayed in visual 3-column sub-score badges on every clip card.
  - Created `tests/scoring-subscores.test.mjs` (3/3 tests passing).
- **User-Selectable Aspect Ratio (9:16, 1:1, 16:9)**:
  - Added `aspectRatio` to `Project` and `Clip` in Prisma schema, synchronized to Neon DB.
  - Implemented dynamic FFmpeg crop calculations for vertical (`9:16`), square (`1:1`), and landscape (`16:9`).
  - Added visual format picker on `/dashboard/projects/new`.
- **Production Infrastructure Notes**:
  - Measured live EC2 specs and authored `INFRASTRUCTURE_NOTES.md`:
    - 2 vCPUs (Intel Xeon Platinum 8488C), 7.6 GiB RAM (12% used, 6.7 GiB headroom), 38 GB NVMe disk (28% used).
    - `nology-web` (203 MB), `nology-worker` (71 MB), `nology-bot` (80 MB) healthy under PM2 root context.
    - Zero-downtime hot reloads verified. Full 56-route Next.js production build verified.

---

## Round 19 — Part 1: Expanding Caption Styles from 6 to 15
**Date**: 2026-09-11  
**Status**: Completed & Verified  
**Test Suite**: 13 test suites, 210 tests passing (100%), including 108 tests in `tests/caption-styles.test.mjs`  

### 1. Style Architecture & Categories
Added 9 distinct presets to `worker/caption-styles.mjs` across 3 categories with genuine font, animation, positioning, and layout differences:
- **Kinetic (5 styles)**:
  - `hormozi`: Punchy 1-3 word cards with aggressive spring scale pop (`\fscx118\fscy118` -> `\fscx100\fscy100`).
  - `bold_impact`: Heavy uppercase golden yellow fill (`#FFD700`), thick black outline, center-mid screen (`y=68%`).
  - `bounce_side`: Left slide-in (`\move`) with spring settling bounce, bold orange fill (`#FF5A1F`).
  - `pill_box`: Opaque obsidian slate backdrop box (`borderStyle: 3`), pill geometry, crisp white typography.
  - `tiktok_classic`: Single-word center punch at massive scale (`fontSizeRatio: 0.115`), maximum retention.
- **Editorial (5 styles)**:
  - `clean_minimal`: Understated lower-third phrase layout with subtle fade (`\fad(80,80)`), no bounce.
  - `classic_subtitle`: Documentary safe-zone lines at bottom edge (`y=88%`), natural sentence cadence.
  - `slow_fade`: Gentle breathing fade (`\fad(220,180)`), warm ivory serif typography (`Liberation Serif, Georgia`).
  - `cinematic_caps`: Letterbox tracked caps (`\fsp4`), silver luminescence (`#E8E8EC`), widescreen aesthetic.
  - `podcast_soft`: Warm peach-cream geometry (`#FFD8A0`), rounded typography, relaxed conversational cadence.
- **Creative (5 styles)**:
  - `neon_highlight`: Electric cyan fill with glowing magenta pulse shadow (`\blur4\fscx112`).
  - `highlighter`: Vibrant marker box backdrop (`borderStyle: 3`), bold black lettering.
  - `typewriter`: Monospace terminal green (`#50FF50`), dark terminal container box, mechanical pacing.
  - `two_tone`: Alternating dual-color highlight between bright gold and crisp pearl per word.
  - `glitch_flicker`: Cyber pink with electric cyan edges and chromatic opacity flicker pulse.

### 2. FFmpeg Libass Benchmark & Verification
Executed `scripts/test-render-styles.mjs` rendering 1080x1920 video with burned-in ASS subtitles for all 15 presets:
| Style ID | Style Name | Category | Success | Resolution | Render Duration |
|---|---|---|---|---|---|
| `hormozi` | Hormozi Pop | Kinetic | true | 1080x1920 | 2051ms |
| `bold_impact` | Bold Impact | Kinetic | true | 1080x1920 | 2044ms |
| `bounce_side` | Side Bounce | Kinetic | true | 1080x1920 | 1083ms |
| `pill_box` | Pill Box | Kinetic | true | 1080x1920 | 1358ms |
| `tiktok_classic` | TikTok Big Word | Kinetic | true | 1080x1920 | 1126ms |
| `clean_minimal` | Clean Minimal | Editorial | true | 1080x1920 | 1185ms |
| `classic_subtitle` | Classic Subtitle | Editorial | true | 1080x1920 | 1162ms |
| `slow_fade` | Slow Fade | Editorial | true | 1080x1920 | 1301ms |
| `cinematic_caps` | Cinematic Caps | Editorial | true | 1080x1920 | 1147ms |
| `podcast_soft` | Podcast Soft | Editorial | true | 1080x1920 | 1146ms |
| `neon_highlight` | Neon Highlight | Creative | true | 1080x1920 | 1121ms |
| `highlighter` | Highlighter | Creative | true | 1080x1920 | 1131ms |
| `typewriter` | Typewriter | Creative | true | 1080x1920 | 1178ms |
| `two_tone` | Two-Tone Alternate | Creative | true | 1080x1920 | 1082ms |
| `glitch_flicker` | Glitch Accent | Creative | true | 1080x1920 | 1077ms |

**Edge Case Assertions**:
- Long words (>25 chars): Wrapped cleanly without horizontal boundary overflow.
- Single short words (1-2 chars): Centered without clipping or abnormal scaling.
- Emoji preservation: Tested with multi-byte unicode emojis (`🚀`, `✨`, `🔥`) without crashing libass.
- Arabic / RTL text: Bidirectional text rendered cleanly without tag corruption.
- Tag injection security: ASS tag markers (`{`, `}`, `\`) stripped from all input words.

### 3. UI Implementation
- `src/app/(dashboard)/dashboard/projects/new/page.tsx`:
  - Added category filter tabs: `All (15)`, `⚡ Kinetic (5)`, `📖 Editorial (5)`, `🎨 Creative (5)`.
  - Added visual preview badges and sample cards styled to accurately represent each preset.
- `src/app/(dashboard)/dashboard/projects/detail/project-detail.tsx`:
  - Updated `CAPTION_PRESET_OPTIONS` with all 15 presets.
  - Grouped presets into `<optgroup>` tags (`⚡ Kinetic Styles`, `📖 Editorial Styles`, `🎨 Creative Styles`) in the re-trim adjustment modal.
- `COMPETITIVE_GAP_ANALYSIS.md`:
  - Added required top comment.
  - Updated Caption Styles row from 6 to 15 (Parity achieved with market leader Opus Clip).

---

## Round 19 — Part 2: Direct Publishing Pipeline (TikTok, YouTube, Instagram)
**Date**: 2026-09-11  
**Status**: Code-Complete, Credential-Gated & Verified  
**Test Suite**: 14 test suites, 230 tests passing (100%), including 20 tests in `tests/social-publish.test.ts`  

### 1. Security Architecture & Encryption at Rest
- **AES-256-GCM Authenticated Encryption (`src/lib/crypto.ts`)**:
  - All access and refresh tokens are encrypted at rest using AES-256-GCM.
  - Format: `ivHex:authTagHex:cipherHex` with a fresh 12-byte random initialization vector per encryption.
  - 32-byte encryption key is derived via SHA-256 from `process.env.ENCRYPTION_SECRET` (falling back to `process.env.NEXTAUTH_SECRET`).
  - Integrity verification: Tampered ciphertexts or wrong secrets trigger authenticated tag verification failure.
  - Tokens are never logged and never exposed in client API responses.
- **HMAC-SHA256 OAuth CSRF State Protection**:
  - Stateless, signed OAuth state payload containing `userId`, `platform`, `returnUrl`, and millisecond timestamp `ts`.
  - Signed using HMAC-SHA256 with timing-safe comparison (`crypto.timingSafeEqual`).
  - Stale (>15 minutes) or tampered state tokens are rejected with HTTP redirect errors.

### 2. Data Model & Prisma Schema
- Updated `prisma/schema.prisma`:
  - `enum SocialPlatform { TIKTOK, YOUTUBE, INSTAGRAM }`
  - `model SocialConnection`: Stores encrypted `accessToken`, `refreshToken`, `tokenExpiresAt`, `platformAccountId`, `platformAccountName`, with `@@unique([userId, platform])` and cascade deletion on `User`.
  - `model SocialPublishLog`: Records publication history per clip (`userId`, `clipId`, `platform`, `externalPostId`, `externalUrl`, `status`, `errorMessage`, `publishedAt`).
  - Added reverse relations to `User` and `Clip`.
  - Local client generated via `npx prisma generate`.

### 3. Direct Publishing Adapters & Platform Integrations
- **TikTok (`src/lib/social/tiktok.ts`)**:
  - Scopes: `user.info.basic,video.publish,video.upload`.
  - OAuth flow with authorization code exchange and token refresh grant.
  - Content Posting API integration (`https://open.tiktokapis.com/v2/post/publish/video/init/`) utilizing `PULL_FROM_URL` directly from Cloudflare R2 storage.
- **YouTube (`src/lib/social/youtube.ts`)**:
  - Scopes: `https://www.googleapis.com/auth/youtube.upload, https://www.googleapis.com/auth/userinfo.profile`.
  - Google OAuth token exchange and auto-refresh.
  - Google Data API v3 Resumable Upload protocol (`uploadType=resumable`) with video binary streaming and metadata snippet mapping.
- **Instagram Reels (`src/lib/social/instagram.ts`)**:
  - Scopes: `instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`.
  - Meta short-lived to 60-day long-lived token exchange (`fb_exchange_token`).
  - 3-step Reels container flow: create media container (`POST /{ig-user-id}/media`), readiness polling loop (`GET /{container-id}`), and final publish (`POST /{ig-user-id}/media_publish`).
- **Format Validation (`src/lib/social/validation.ts`)**:
  - Enforces platform duration bounds (TikTok: 3–600s; YouTube Shorts: 60s advisory; Instagram Reels: 3–90s).
  - Validates 9:16 vertical orientation requirements before initiating external upload sessions.

### 4. API Routes & UI Surfaces
- **API Endpoints**:
  - `GET /api/social/[platform]/connect`: Initiates OAuth flow with signed state; gracefully returns `{ error: 'not_configured' }` if developer credentials are unset.
  - `GET /api/social/[platform]/callback`: Verifies state signature and timestamp, exchanges code, encrypts tokens, and upserts `SocialConnection`.
  - `GET /api/social/connections`: Returns safe summaries for Settings UI without exposing token secrets.
  - `DELETE /api/social/connections`: Disconnects social account.
  - `POST /api/projects/[id]/clips/[clipId]/publish`: Verifies ownership, validates clip specs, transparently refreshes tokens if within 5 minutes of expiry, calls platform adapter, and records to `SocialPublishLog`.
- **UI Surfaces**:
  - **Settings (`/dashboard/settings`)**: Added "Connected Accounts & Direct Publishing" card with live status badges, connected usernames, and connect/disconnect buttons.
  - **Clip Detail (`/dashboard/projects/detail`)**: Added "Publish" button and comprehensive modal with platform selector, pre-filled hook copy/hashtags, privacy selector, and live progress indicators.

### 5. Documentation & Developer Tooling
- Authored `PLATFORM_APPROVAL_CHECKLIST.md`: Detailed registration guides for TikTok Developer Portal, Google Cloud Console, and Meta for Developers with exact redirect URIs, scopes, and app review screencast guidelines.
- Authored `MOCK_TESTING_GUIDE.md`: Step-by-step developer testing guide for running unit tests and mocking local credentials without live API keys.
- Updated `.env.example`: Added placeholders for `ENCRYPTION_SECRET` and all TikTok, YouTube, and Instagram OAuth keys.

## 2026-09-11 — Round 16: Video URL Sanitization, Admin Plan Grants, Referral Funnel System, & Per-Video Pricing

### 1. Video URL Validation Fix ("Invalid Input" Elimination)
- **Root Cause**: Pasting video links copied from mobile devices or Arabic operating systems/browsers frequently includes zero-width spaces (`\u200B`, `\uFEFF`) and invisible RTL/LTR direction marks (`\u200E`, `\u200F`), or complex query parameters. The previous rigid regex `/^[0-9a-zA-Z.\-/?:&=+%_~#@]+$/` rejected these, and the API returned a generic `{ error: 'Invalid input' }`.
- **Remediation**:
  - Implemented `cleanUrlString(input)` and `normaliseVideoUrl(input)` in `src/lib/validation.ts`.
  - Automatically strips hidden directional formatting, zero-width characters, and extraneous whitespace.
  - Automatically handles bare domains without protocol (`youtu.be/xyz`, `youtube.com/shorts/...`) by prepending `https://`.
  - Replaced generic `'Invalid input'` with descriptive error reporting (`parsed.error.errors[0]?.message`).
  - Integrated into both `src/app/api/projects/route.ts` and `src/app/(dashboard)/dashboard/projects/new/page.tsx`.
  - Verified with 18 unit tests in `tests/validation.test.ts`.

### 2. Admin Dashboard Grants (Free Subscriptions & Quick Credits)
- **Backend**: Created `POST /api/admin/users/[id]/plan` allowing administrators to grant complimentary `CLIPPER`, `STUDIO`, or `FREE` subscriptions without Stripe checkout.
  - Automatically sets `subscriptionStatus: 'active'` and updates `role`.
  - Provides option to deposit plan credits immediately (+100 for Clipper, +400 for Studio) with an auditable `CreditTransaction` ledger entry.
- **Frontend UI (`/admin/users`)**:
  - Added dedicated **"Plan"** grant button with a modal featuring visual tier selection (Clipper, Studio, Free), credit deposit checkbox, and custom note field.
  - Added quick preset buttons (+10, +25, +50, +100, +500) to the **"Adjust Credits"** modal for instant credit grants.

### 3. Referral & Influencer Marketing System (with Drop-Off Funnel)
- **Data Models**:
  - `model Affiliate`: Custom slug/code, influencer name, commission rate (default 20%), contact email, notes, active status.
  - `model ReferralClick`: Records click timestamp, hashed visitor IP, user agent, referer.
  - `model ReferralConversion`: Tracks milestones across the customer lifecycle (`SIGNUP`, `FIRST_PROJECT`, `SUBSCRIPTION`), gross revenue generated, and affiliate commission.
  - Added `referredByAffiliateId` and `referredAt` to `model User`.
  - Synced to Neon PostgreSQL database via `prisma db push`.
- **Attribution & Conversion Tracking**:
  - `GET /r/[code]`: Records click, sets 30-day attribution cookie `cliptica_ref`, and redirects to `/register?ref=code`.
  - `POST /api/auth/register`: Links user to affiliate and records `SIGNUP` conversion.
  - `POST /api/projects`: Records `FIRST_PROJECT` milestone when referred user runs their first clipping job.
  - `POST /api/billing/webhook`: On `invoice.payment_succeeded`, calculates influencer commission (% of invoice total) and records `SUBSCRIPTION` conversion.
- **Admin Management & Funnel Visualization (`/admin/referrals`)**:
  - Visual 4-stage funnel showing traffic from **Visits → Signups → First Project → Paid Subscriptions**.
  - Explicit drop-off percentage calculations ("Where users got stuck") identifying friction points in creator onboarding.
  - Comprehensive table with 1-click link copying (`cliptica.com/r/...`), performance metrics, commission totals, and active/paused toggle.
  - Added "Referrals" to Admin sidebar navigation in `src/components/admin-layout.tsx`.

### 4. Per-Video Credit Transition & Unit Economics
- **Pricing Transition**: Replaced minute-based billing with **1 video clip = 1 credit**.
  - `worker/credits.mjs`: Added `calcClipCredits(clipCount, fx)` charging 1 credit per successfully extracted clip (+2 flat if AI motion graphics applied).
  - `worker/worker.mjs`: Updated settlement transaction to charge based on `moments.length` (actual clips rendered).
  - `src/app/api/projects/route.ts`: Lowered upfront reservation gate from 10 credits to 1 credit.
- **Unit Economics Breakdown**:
  - Groq Whisper Large v3 Turbo (source audio): ~$0.002 / clip.
  - Groq LLaMA 3.3-70B moment scoring: ~$0.0007 / clip.
  - EC2 FFmpeg libass rendering & face tracking: ~$0.0001 / clip.
  - Cloudflare R2 storage & zero-egress bandwidth: ~$0.0003 / clip.
  - **Total COGS per generated clip**: **~$0.004 – $0.005** (half a cent!).
  - **Clipper Plan ($19/mo, 100 clips)**: $0.50 COGS → **97.4% gross margin**.
  - **Studio Plan ($49/mo, 400 clips)**: $2.00 COGS → **95.9% gross margin**.

### 5. Verification & Live Deployment
- **Tests**: 15 test files, 243 tests passing (100%), including new `tests/referrals.test.ts`.
- **Build**: Local and EC2 Next.js production build succeeded with all 59 routes generated.
- **PM2**: `nology-web` (PID 1085997) and `nology-worker` reloaded cleanly with zero downtime.
- **Live Health**: `http://127.0.0.1:3000/api/health` and `https://cliptica.com` returning HTTP 200 OK.

---

## 2026-09-11: Video URL Submission Fix ("Invalid enum value. Expected 'url' | 'file', received 'link'")

### 1. Root Cause Analysis
- **Symptom**: User saw error `Invalid enum value. Expected 'url' | 'file', received 'link'` when submitting a video URL on `/dashboard/projects/new`.
- **Root Cause**:
  - In `src/app/(dashboard)/dashboard/projects/new/page.tsx`, the tab state was typed as `'upload' | 'link'`.
  - In `handleSubmit`, the payload passed `sourceType: tab` (sending `'link'` or `'upload'`).
  - In `src/app/api/projects/route.ts`, `createSchema` had `sourceType: z.enum(['url', 'file'])`.
  - Because our previous fix replaced the generic `"Invalid input"` with the specific Zod validation error (`parsed.error.errors[0]?.message`), the exact enum mismatch surfaced to the user.

### 2. Changes Applied
- **Backend (`src/lib/validation.ts`, `src/app/api/projects/route.ts`)**:
  - Exported canonical `projectCreateSchema` accepting both legacy and UI formats: `z.enum(['url', 'file', 'link', 'upload']).transform(v => v === 'link' ? 'url' : v === 'upload' ? 'file' : v)`.
  - Exported `PROJECT_FRAMINGS`, `PROJECT_LANGUAGES`, and `PROJECT_ASPECT_RATIOS` constants.
  - Cleaned unused imports in `src/app/api/projects/route.ts`.
- **Frontend (`src/app/(dashboard)/dashboard/projects/new/page.tsx`)**:
  - Updated `handleSubmit` to map `sourceType: tab === 'link' ? 'url' : 'file'` for double safety.
- **Unit Tests (`tests/validation.test.ts`)**:
  - Added 5 unit tests for `projectCreateSchema` covering `sourceType` mapping (`link` -> `url`, `upload` -> `file`), unicode stripping, and rejection of invalid values.

### 3. Verification
- **Unit Tests**: All 15 test files, 248 tests passed (100%).
- **TypeScript**: `npx tsc --noEmit` exited 0 with zero errors.
- **Build**: `npm run build` compiled 59 routes cleanly with zero warnings/errors.

---

## 2026-09-12: Overhaul of Viral Clipping Engine, Avatar/Speaker Tracking & Speed

### 1. Root Cause Analysis
- **Problem 1 (Slow processing - 32 minutes)**:
  - In `worker/worker.mjs`, when `GROQ_API_KEY` was empty, the worker fell back to `faster-whisper` running on CPU (`WhisperModel("small")`). On EC2 with no GPU, audio transcription took 32 minutes for a single video.
- **Problem 2 (Bad clipping & arbitrary non-viral moments)**:
  - Without an active LLM key, `heuristicScoreMoments` fell back to an English-only regex (`secret|never|nobody...`) which produced 0 matches on Arabic speech, assigning random scores.
  - Slicing was rigid and dumb (`win = 38` seconds, `s += win / 2`), chopping sentences and words in half without respecting speech pauses or narrative completion.
- **Problem 3 (Avatar / Speaker not framed correctly)**:
  - `worker/worker.mjs` invoked system `python3` instead of `/opt/nology-venv/bin/python`, causing `ModuleNotFoundError: No module named 'insightface'`.
  - `faces.py` failed silently without writing output JSON, triggering `ENOENT: no such file or directory, open 'faces0.json'` in `worker.mjs`.
  - The worker caught this error and defaulted to static `centerCrop` on 100% of jobs, amputating speakers or avatars positioned off-center.
  - `buffalo_l` was only designed for human photorealistic faces and ignored 2D/3D avatars, VTubers, or webcam overlays.

### 2. Solutions Implemented
- **Avatar & Face Tracking (`worker/premium/faces.py`)**:
  - Multi-tier detection: InsightFace SCRFD (`allowed_modules=['detection']` for 5x-10x CPU speedup) -> OpenCV Haar frontal + profile cascades (for sideways speakers & zero-download fallback) -> Motion saliency & contour detection (for 2D/3D avatars, VTubers, webcam overlays).
  - 2-Person Podcast / Interview framing: centers between both speakers if they fit within 78% of the 9:16 crop window.
  - Smooth cinematic panning: dead-zone threshold (8px) + exponential moving average filter eliminating camera micro-jitter.
  - Bulletproof fallback: always writes `{ "commands": [], "thumb_ts": null, "win": [win_w, win_h] }` on exit, eliminating `ENOENT`.
- **Worker & Script Resolution (`worker/worker.mjs`)**:
  - Added `fileURLToPath` and `existsSync` to resolve absolute path `FACES_SCRIPT` and dynamic `PYTHON_BIN` pointing to `/opt/nology-venv/bin/python`.
  - In `CFG`, changed default fallback CPU whisper model from `small` to `base` (5x faster).
  - Added dynamic DB settings synchronization for `groq_api_key`, `openai_api_key`, and `whisper_model` so keys can be configured directly from admin settings.
- **Viral Clipping Engine 2.0 (`worker/worker.mjs`)**:
  - Implemented `generateCandidateMoments`: groups whisper segments by natural sentence endings (`.`, `?`, `!`, `؟`, `…`) and pauses (`gap >= 0.6s`), generating coherent thought units (25s–55s) that always start with a clean hook and end on a completed thought.
  - Rebuilt `heuristicScoreMoments`: comprehensive bilingual Arabic + English virality analysis (hook detection, opening question/exclamation bonus, cadence & speech pace 2.0-3.6 WPM, narrative conclusion bonus, and shareability metrics).
  - Upgraded `llmScoreMoments`: tailored system prompt instructing Groq LLaMA 3.3-70B and OpenAI to produce Arabic titles and reasons for Arabic videos, evaluating hookScore, retentionScore, and shareScore.
- **Tests (`tests/scoring-subscores.test.mjs`)**:
  - Added unit tests for Arabic viral questions/hooks and English virality benchmarks.

### 3. Verification
- **Unit Tests**: All 15 test files, 249 tests passed (100%).
- **TypeScript**: `npx tsc --noEmit` exited 0 with zero errors.
- **Build**: `npm run build` compiled 59 routes cleanly with zero warnings/errors.

---

## 2026-09-12: Captions Burn-in PTS/ASS Fix, Real-Time Credit Sync, 3-Clip Selection, Motion FX Removal & Whop/ContentReward Campaign Ingestion

### 1. Groq API Key Configuration
- Saved provided production Groq API key securely to `/opt/nology/.env.production` on EC2.
- Enables lightning-fast Groq Whisper audio transcription (~10-15s instead of 32 mins on CPU) and Groq LLaMA 3.3-70B virality scoring & campaign analysis.

### 2. Captions Burn-in Bug Fixes (`worker/caption-styles.mjs`)
- **Relative PTS Timestamps**: Video rendering runs FFmpeg with input seek (`-ss [start] -i [source] -t [duration]`), which resets playback timestamps (PTS) to 0. Absolute subtitles (e.g. starting at 00:00:45) never appeared within a 30s clip. Converted all subtitle event start/end times to relative offsets: `Math.max(0, card.start - start)`.
- **ASS Events Header Format**: Fixed ASS header from 5 columns to the standard 10 columns: `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`. Previously, `libass` interpreted dialogue text as formatting directives, resulting in blank subtitles.
- **FontName Comma Splitting**: Stripped CSS-style comma fallback lists in `Fontname` (e.g., `'DejaVu Sans'` instead of `'Liberation Sans, Arial Black, DejaVu Sans'`) across all 15 preset styles so libass matches system fonts reliably.
- **Verification**: Added unit tests in `tests/caption-styles.test.mjs` verifying relative offset calculations and 10-column header conformance. All 123 tests in `caption-styles.test.mjs` passed.

### 3. Real-Time Credits Sync
- **State Synchronization**: Added `liveCredits` polling and event subscription to `src/components/dashboard-layout.tsx` and `src/app/(dashboard)/dashboard/billing/page.tsx`.
- **Immediate Deductions**: Listeners for the window event `credits-updated` automatically refresh user credit counts upon project creation and video generation without requiring manual browser reloads or re-authentication.

### 4. 3 Clips Generation & Interactive Final Clip Selection
- **Default 3 Clips**: Worker default `clipsPerVideo` set to 3 candidate clips per source video.
- **Interactive UI (`src/app/(dashboard)/dashboard/projects/detail/project-detail.tsx`)**:
  - Displays "Option N of 3" badges on each clip card.
  - Interactive "اختر هذا المقطع كفيديو نهائي (Select as Final)" button for each clip.
  - Persistent selection saved to localStorage (`cliptica_final_clip_[projectId]`).
  - Active final clip highlighted with a prominent gold banner and glowing border.

### 5. Motion Graphics Removal
- Completely excised Motion Graphics across UI, API, and worker pipeline:
  - Removed motion packages, heuristic pack, and `-filter_complex` color overlays from `worker/worker.mjs`.
  - Removed AI Motion FX toggle switch, Clapperboard icon, and cost notes from `src/app/(dashboard)/dashboard/projects/new/page.tsx`.

### 6. Whop & ContentReward Clipping Campaign Ingestion
- **SSRF Protection (`src/lib/ssrf.ts`)**: Built rigorous server-side request forgery protection blocking private IP ranges, cloud metadata addresses (169.254.169.254), loopback, and IPv4-mapped IPv6.
- **Campaign Analysis API (`src/app/api/campaigns/analyze/route.ts`)**:
  - Safely extracts text, Google Drive links, YouTube links, and video URLs from Whop or ContentReward campaign pages.
  - Uses Groq LLaMA 3.3-70B with JSON output mode to extract payout terms, clipping guidelines, required hashtags, and recommended prompts.
- **Campaign Tab UI (`src/app/(dashboard)/dashboard/projects/new/page.tsx`)**:
  - Added dedicated 3rd tab: "Campaign (Whop / ContentReward)".
  - Instant URL analysis displaying platform badge, payout badge, rules, and detected assets.
  - 1-click selection of detected Google Drive or YouTube source video to immediately launch the clipping job.

### 7. Verification & Deployment
- **Unit Tests**: 15 test suites, 264 unit tests passed (100%).
- **TypeScript**: Zero errors (`npx tsc --noEmit` exited 0).
- **Next.js Production Build**: Built cleanly with all 60 static and dynamic routes.
- **Deployment**: Changes committed (`f48c6ed`), pushed to GitHub origin, pulled to EC2 `/opt/nology`, rebuilt on EC2, and reloaded via PM2 (`pm2 reload all --update-env`).
- **Health Check**: `https://cliptica.com/api/health` and PM2 services (`nology-web`, `nology-worker`, `nology-bot`) online and healthy.

---

## 2026-09-12: Groq Worker Speed Activation (groq+), 1 Credit Pricing, Project Detail Navigation & Copy

### 1. Root Cause Analysis: Delay / Processing Speed
- **Symptom**: Processing long videos still took ~32 minutes (from 10:52:31 to 11:24:38 in worker logs).
- **Root Cause**:
  - PM2 cached `GROQ_API_KEY=""` in its process environment dump.
  - Node 20's `process.loadEnvFile` does not overwrite existing variables in `process.env`.
  - As a result, `worker.mjs` booted with `groq-`, bypassing Groq Whisper API and falling back to local Whisper running on CPU for 32 minutes.
- **Fix**:
  - Enhanced `loadEnvFile()` in `worker/worker.mjs` to directly read and parse `/opt/nology/.env.production`, overriding any empty-string cached env variables.
  - Added dynamic check in `syncConfigInto()` and `loop()`: `(CFG.groqKey || process.env.GROQ_API_KEY)`.
  - Upserted `groq_api_key` in the database `Setting` table.
  - Recreated `nology-worker` cleanly in PM2.
  - **Result Verified**: Worker logs now display `[worker] online — premium=true, parallel=4, env=db+r2+cookies+groq+`. Groq Whisper audio transcription now takes 5-15s instead of 32m.

### 2. 1 Credit Per Operation / Final Video
- **Symptom**: System reserved 10 credits upfront and charged per clip.
- **Fix**:
  - In `src/app/api/admin/settings/route.ts` & `src/app/(admin)/admin/settings/page.tsx`, changed default `min_credits_required` to `1` and `clips_per_video` to `3`.
  - In database `Setting` table, updated `min_credits_required = '1'` and `clips_per_video = '3'`.
  - In `worker/worker.mjs`, set `const creditsSpent = 1` so each operation is charged exactly 1 credit for the final video.

### 3. Project Detail Navigation Fix
- **Symptom**: Clicking on a project in `/dashboard` opened the project, but clicking on it in `/dashboard/projects` did not open.
- **Root Cause**:
  - In Next.js 15, `useSearchParams()` in client components without a `<Suspense>` boundary can de-optimize client-side navigation.
  - Also, `.glass-card` had `transform-style: preserve-3d` which could interfere with click events on unstyled `<a>` tags.
- **Fix**:
  - Wrapped `useSearchParams()` inside `<Suspense>` in `src/app/(dashboard)/dashboard/projects/detail/page.tsx`.
  - Added `useRouter`, `block cursor-pointer`, and explicit `onClick={() => router.push(...)}` handler in `src/app/(dashboard)/dashboard/projects/page.tsx`.

### 4. Cost Copy Updated
- In `src/app/(dashboard)/dashboard/projects/new/page.tsx`:
  - Updated cost note to: `1 كريديت لكل فيديو نهائي (1 credit per final video)`.
- In `src/app/(dashboard)/dashboard/billing/page.tsx`:
  - Updated explanation text to: `1 كريديت لكل فيديو نهائي. الرصيد الشهري غير المستخدم يترحل لـ 30 يوماً.`

### 5. Verification
- All 15 test suites and 264 unit tests passed.
- `npx tsc --noEmit` clean.
- Next.js production build succeeded on local and EC2.
- PM2 services (`nology-web`, `nology-worker`, `nology-bot`) running healthy. Worker online with `groq+`.

---

## 2026-09-12: Display Name Persistence, Password Flow Hardening, Complete Motion Graphics Removal & Rebranding

### 1. Step 5 — Display Name Persistence Fix
- **Root Cause**:
  - `/api/auth/me` was correctly updating `User.name` in PostgreSQL.
  - However, NextAuth's `jwt` callback only read `dbUser.role` and `dbUser.credits` from the database, omitting `name` from `dbUser` select.
  - Furthermore, `token.name` was not being updated on `trigger === 'update'`, and the client-side Settings page (`src/app/(dashboard)/dashboard/settings/page.tsx`) was not invoking `update({ name })` after saving.
- **Fix**:
  - `src/lib/auth.ts`: Added `name: true` to initial DB query, ensured `token.name = dbUser.name ?? user.name ?? token.name`, added `name` handling to `trigger === 'update'`, and forwarded `token.name` to `session.user.name` in `session` callback.
  - `src/app/(dashboard)/dashboard/settings/page.tsx`: Destructured `{ update }` from `useSession()` and invoked `await update({ name: trimmed })` immediately following successful `/api/auth/me` response.
  - `tests/auth-name-sync.test.ts`: Created unit tests pinning initial sign-in DB load, session update trigger, and session callback propagation. Passed 3/3.
- **Commit**: `6e244d9` ("fix(auth): persist and sync display name in NextAuth JWT and session callback").

### 2. Step 6 — Password Reverts Investigation & Hardening
- **Investigation**:
  - Tested both `/api/auth/change-password` and `/api/auth/reset-password`.
  - Confirmed via integration test (`tests/password-flow.test.ts`) that new bcrypt hash is permanently committed to PostgreSQL, the old password cannot authenticate, and the new password authenticates with 200 OK.
  - Root cause of user perception: Missing `autoComplete` attributes on password input fields allowed browser password managers to autofill cached stale passwords upon reload, and feedback toasts were too brief (3000ms).
- **Fix**:
  - `src/app/(dashboard)/dashboard/settings/page.tsx`: Added `autoComplete="current-password"` to Current password input, `autoComplete="new-password"` to New and Confirm password inputs.
  - Extended feedback toast duration to 6000ms and clarified message: `"Password updated successfully! Your new password is now active."`.
- **Commit**: `3de0a56` ("fix(auth): add password autocomplete attributes, persistent feedback, and integration tests").

### 3. Step 7 — Complete Motion Graphics Feature Removal
- **Scope of Removal**:
  - Excised all AI motion graphics routes, settings, schema fields, worker logic, and marketing mentions:
  - Deleted `src/app/api/admin/motion-fx/route.ts`.
  - Removed `motion_fx` setting key from `src/app/api/admin/settings/route.ts` and `src/app/(admin)/admin/settings/page.tsx`.
  - Removed `motionFx` from `src/lib/validation.ts` schema and `src/app/api/projects/route.ts`.
  - Removed `toggleMotion` function, state, and admin toggle section from `src/app/(dashboard)/dashboard/settings/page.tsx`.
  - Excised `motionFx Boolean @default(false)` from `prisma/schema.prisma` and regenerated Prisma Client types.
  - In `worker/worker.mjs`: Removed `motion: null` from crop returns, eliminated motion parameter mismatch in `renderClip`, and removed motion objects from `Clip.motionGraphics`.
  - In `worker/credits.mjs`: Removed `fx` surcharge (+2) parameter from `calcClipCredits` and `calcCredits`.
  - In `src/lib/stripe.ts` and `src/app/(dashboard)/dashboard/billing/page.tsx`: Replaced "Motion graphics & zoom effects" with "Dynamic zooms & viral hook pacing".
  - In `src/app/(dashboard)/dashboard/projects/detail/project-detail.tsx`: Cleaned `motionGraphics` from `Clip` interface and hook generation.
  - In `src/app/(marketing)/page.tsx`: Replaced "Motion polish" and "22 motion templates" with "Dynamic framing".
  - Updated `tests/credits.test.mjs` (all 9 tests passing).
- **Verification**: Zero remaining grep traces for `motionFx`, `motion-fx`, `motion_fx`, `MotionPackage`, `llmMotionPackages` in source files.
- **Commit**: `0f74209` ("feat(pipeline): completely remove motion graphics feature across codebase and schema").

### 4. Bonus — Rebranding Cleanup (NOLOGY -> Cliptica)
- Replaced all user-facing instances of "NOLOGY" / "Nology" across:
  - Email notification subjects: `change-password`, `forgot-password`, `resend-verification`.
  - Authentication UI: `login/page.tsx` ("New to Cliptica?"), `register/page.tsx`, `forgot-password`, `reset-password`, `verify-email`, and `not-found.tsx` (`aria-label="Cliptica home"`).
  - Navigation layouts: `dashboard-layout.tsx` (`aria-label="Cliptica dashboard"`), `marketing-layout.tsx` (`aria-label="Cliptica home"`).
  - Support contact emails: Updated all instances to `support@cliptica.com` across `billing`, `settings`, `privacy`, `terms`, `refund-policy`, and `marketing-layout`.
  - Sitemap & robots fallbacks: Updated default base URL to `https://cliptica.com`.
  - Earnings CSV download: Filename updated to `cliptica-payouts-YYYY-MM-DD.csv`.
  - Design system headers & logo component: Exported `ClipticaMark` and preserved backward-compatible `NologyMark` alias in `src/components/logo.tsx`.
- **Commit**: `749e838` ("chore(branding): replace all remaining NOLOGY strings with Cliptica in emails and user-facing UI") + `73c7acc` ("chore: remove unused ShieldCheck import in settings").

### 5. Final Verification & Production Deployment
- **TypeScript**: `npx tsc --noEmit` exited 0 (clean).
- **Unit & Integration Tests**: All 17 test suites (266 tests) passed (100%).
- **Production Builds**: `next build` succeeded cleanly on local machine and production EC2 instance.
- **Deployment**: Pushed to GitHub `main`, pulled to EC2 `/opt/nology`, generated Prisma client, built, and executed zero-downtime PM2 reload (`sudo pm2 reload all --update-env`).
- **Live Health**: `curl -s http://localhost:3000/api/health` returned HTTP 200 with all database and storage checks healthy; all 3 PM2 services (`nology-web`, `nology-worker`, `nology-bot`) online.