# Comprehensive Credit Model & Financial Safety Audit Report

**Cliptica Financial & Autonomous Operations Audit**  
**Date:** September 15, 2026  
**Status:** FULLY RESOLVED & DEPLOYED TO PRODUCTION  
**Environment:** AWS EC2 (`ubuntu@13.62.192.145`), Next.js 15.5.25, PM2 (`nology-web`, `nology-worker`)  
**Git Commits:**
1. `7a3e5c8`: `fix(billing): unify credit reservation and settlement to 1 credit per video with strict duration caps`
2. `f44d16d`: `fix(autopilot): add duration cap and daily project limit circuit breaker`
3. `e692534`: `feat(autopilot): add patch route and UI toggle to pause and resume channels`
4. `200df78`: `test(pricing): update test assertions for live tiers, caption styles, and billing redirects`

---

## 1. Executive Summary & Root Cause Analysis

### The Critical Bug: Credit Reservation vs. Settlement Desync
Prior to this remediation, Cliptica's credit system experienced a fundamental financial synchronization desync:
1. **At Project Ingestion (`src/app/api/projects/route.ts`)**:
   The system queried `getSettingNumber('min_credits_required', process.env.MIN_CREDITS_REQUIRED, 1)`. If this setting or environment variable was configured to a higher threshold (e.g. 5 or 10 credits) or calculated dynamically, the system deducted that amount from `user.credits` upfront and marked `Project.creditsUsed = minCredits`.
2. **At Job Settlement (`worker/worker.mjs`)**:
   The worker pipeline completed video rendering, uploaded clips to Cloudflare R2, and executed settlement logic where `creditsSpent` was hardcoded to `1`:
   ```javascript
   const creditsSpent = 1
   const alreadyPaid = Math.max(0, project.creditsUsed ?? 0)
   const diff = creditsSpent - alreadyPaid
   ```
3. **The Financial Leakage**:
   When `alreadyPaid` was greater than 1, `diff < 0`, causing lines 1208-1220 to issue an **automatic refund** of `Math.abs(diff)` to the user's account. Conversely, if a user had fewer than `minCredits` in their balance (e.g. 4 credits when `minCredits = 10`), they were blocked with HTTP 402 ("Insufficient credits") despite having ample credits for four full video operations.
4. **Duration Asymmetry**:
   Furthermore, `worker/credits.mjs` allowed up to 180 minutes for Studio users, while `src/lib/stripe.ts` specified a 120-minute limit. Without explicit pre-download rejection, a 180-minute video could be processed for a single credit ($0.59 infra cost against $0.1475 revenue), eroding margins on outlier jobs.

---

## 2. Architectural Resolution: The Guarded 1-Credit Model

### Decision: 1 Credit = 1 Final Video Operation + Strict Duration Caps
To fulfill Cliptica's brand promise across Arabic and English marketing copy (*"1 كريديت لكل فيديو نهائي"*):
- **Upfront Reservation**: At creation, exactly **1 credit** is deducted and marked as `creditsUsed: 1`.
- **Settlement Parity**: At completion, `creditsSpent: 1`, `alreadyPaid: 1`, yielding `diff: 0`. No refund or additional deduction is triggered.
- **Failure Safety**: If any phase fails (download, transcription, scoring, or rendering), the worker idempotently refunds the 1 reserved credit back to the user balance.
- **Strict Plan Duration Caps**:
  - **Free Tier**: 20 minutes max (`PLANS.free.maxVideoLength = 20`, `PLAN_MAX_MINUTES.FREE = 20`).
  - **Starter (Clipper) Tier**: 90 minutes max (`PLANS.clipper.maxVideoLength = 90`, `PLAN_MAX_MINUTES.CLIPPER = 90`).
  - **Pro Creator (Studio) Tier**: 120 minutes max (`PLANS.studio.maxVideoLength = 120`, `PLAN_MAX_MINUTES.STUDIO = 120`).
  - **Platform Hard Ceiling**: 180 minutes (`MAX_SOURCE_MINUTES = 180`).

---

## 3. AutoPilot Autonomous Engine Safeguards

The AutoPilot channel watcher (`worker/worker.mjs` -> `checkAutoPilotChannels`) was fortified with two defensive layers:

1. **Daily Project Circuit Breaker**:
   - Checks daily creations for the channel owner: `todaysCount >= AUTOPILOT_MAX_DAILY_PROJECTS` (default 10).
   - Prevents bulk channel uploads or automated spam from consuming all of a user's credits or monopolizing the processing worker.
2. **Pre-Download Video Duration Guard**:
   - Before downloading or reserving credits, the worker runs `probeUrlDuration` on `https://www.youtube.com/watch?v=${videoId}`.
   - If the video duration exceeds the owner's plan limit (`exceedsPlanMinutes(durSec / 60, owner.role)`), it logs the rejection, advances `lastVideoId` so the video is not repeatedly queried, and skips without deducting credits.
3. **Channel Pause & Resume Controls**:
   - Added `PATCH /api/user/autopilot` supporting `{ channelId, isActive: boolean }` with session authentication and ownership validation.
   - Added interactive Pause ("إيقاف") / Resume ("استئناف") toggle button and status badges (Emerald active vs Amber paused) in `src/app/(dashboard)/dashboard/autopilot/page.tsx`.

---

## 4. Live Subscription & Pack Economics Summary (v3.0.0)

| Tier / Pack | Monthly Price | Monthly Credits | Effective Cost / Credit | Max Length | Gross Margin % |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Free Trial** | \$0.00 | 15 credits | \$0.00 | 20 min | Subsidized CAC (max \$0.049 liability) |
| **Starter (Clipper)** | \$29.00 / mo | 150 credits | \$0.193 | 90 min | **94.4%** (\$27.37 gross profit / mo) |
| **Pro Creator (Studio)**| \$59.00 / mo | 400 credits | \$0.148 | 120 min | **94.4%** (\$55.67 gross profit / mo) |
| **Pack 50** | \$15.00 one-time | 50 credits | \$0.300 | As per plan | **94.0%** (\$14.10 net profit) |
| **Pack 150** | \$35.00 one-time | 150 credits | \$0.233 | As per plan | **94.8%** (\$33.19 net profit) |
| **Pack 500** | \$89.00 one-time | 500 credits | \$0.178 | As per plan | **94.9%** (\$84.47 net profit) |

---

## 5. Verification & Test Evidence

### 1. Automated Vitest Suite
- Total Test Files: **19 passed (19)**
- Total Tests: **273 passed (273)**
- Duration: 3.28s

Key suites verified:
- `tests/credit-reservation-settlement.test.ts`: 4/4 passed (zero drift, 1:1 reservation/settlement parity, duration cap enforcement).
- `tests/autopilot.test.ts`: 3/3 passed (PATCH authentication, payload validation, state toggles).
- `tests/pricing-model.test.ts`: 5/5 passed (Stripe fees, infra COGS, > 94% margins on Starter & Pro Creator).
- `tests/caption-styles.test.mjs`: 123/123 passed (18 caption presets verified).
- `tests/billing-redirects.test.ts`: 4/4 passed (`invalid_selection` safety redirect).

### 2. TypeScript & Next.js Build
- `npx tsc --noEmit`: 0 errors.
- `next build`: 64/64 static & dynamic routes compiled without errors.

### 3. Live Server Deployment
- EC2 IP: `13.62.192.145` (`/opt/nology`)
- PM2 Processes Online:
  - `nology-web` (pid: 1939618, port: 3000)
  - `nology-worker` (pid: 1939661, status: online)
  - `nology-bot` (pid: 1926679, status: online)
  - `pot-provider` (pid: 1926725, status: online)
- Live Health Check:
  ```json
  {
    "status": "healthy",
    "uptime": 93.5,
    "version": "0.1.0",
    "checks": {
      "database": { "status": "healthy", "latency_ms": 1041 },
      "storage": { "status": "healthy" }
    }
  }
  ```
- Worker Log Verification:
  `[worker] online — premium=true, parallel=4, env=db+r2+cookies+groq+`
