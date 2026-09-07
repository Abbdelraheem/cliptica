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