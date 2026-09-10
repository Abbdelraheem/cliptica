# Cliptica — Competitive Gap Closure & Unit Economics Rebuild Report

**Date**: September 11, 2026  
**Status**: All Blocks & Gaps Successfully Shipped, Tested, Verified, and Deployed to Production Host (`13.62.192.145`)  
**Services Online**: `nology-web` (PID 919295, online), `nology-worker` (PID 919325, online), `nology-bot` (PID 757263, online)  
**Total Test Suite Status**: **12 passed / 12 test suites, 144 passed / 144 unit tests (100%)**

---

## 1. Executive Summary

This report documents the resolution of Cliptica's primary marketing discrepancies, the closure of its two most consequential competitive product gaps against Opus Clip and Vizard.ai, and the financial verification of its pricing architecture with audited unit economics.

| Workstream | Objective | Implementation | Verification & Output | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Urgent Fix** | Eliminate false claim of "All 15 caption styles" across app | Replaced with "Karaoke captions (Hormozi Pop)" and "Karaoke captions" across billing, marketing, registration, and Stripe config | Grep verified: 0 instances remaining. Built & deployed to EC2. | **COMPLETED & DEPLOYED** |
| **Gap 1** | Multiple Caption Style Presets | Modular ASS engine (`worker/caption-styles.mjs`) with 6 distinct presets, ASS injection sanitization, and visual UI picker | 45 unit tests passed; FFmpeg libass renders on EC2 passed at 1080x1920 (474ms–493ms/clip). | **COMPLETED & DEPLOYED** |
| **Gap 2** | Fast In-Product Clip Trim Adjustment | `POST /api/.../adjust` endpoint, lightweight re-trim worker path reusing transcript/faces, UI nudge controls (±1s, ±5s) | Trims & renders 1080x1920 video in **7.9s on EC2 host** (<20s SLA). 11 unit tests passed. | **COMPLETED & DEPLOYED** |
| **Gap 3** | Pricing Rebuild with Real Unit Economics | Calculated fully loaded COGS ($0.0033/min), researched competitors, authored `PRICING_MODEL.md` | Clipper delivers **90.3% GM**, Studio delivers **88.4% GM**. 5 unit tests pinning cost equations. | **COMPLETED & DEPLOYED** |

---

## 2. Workstream Breakdown

### Part A: Urgent False Advertising Remediation
- **Audit Findings**: `src/app/(dashboard)/dashboard/billing/page.tsx` and `src/app/(marketing)/page.tsx` previously advertised "All 15 caption styles" for Free, Clipper, and Studio tiers, while only a single hardcoded style existed in `worker/worker.mjs`.
- **Action Taken**:
  - Replaced false claims across `src/app/(dashboard)/dashboard/billing/page.tsx`, `src/lib/stripe.ts`, `src/app/(marketing)/page.tsx`, and `src/app/(auth)/register/page.tsx`.
  - Replaced with strictly accurate copy: "Karaoke captions (Hormozi Pop)" and "Karaoke captions".
- **Commit**: `11cd683` — `fix(billing): eliminate false claim of 15 caption styles across UI and marketing`

---

### Part B: Gap 1 — 6 Production Caption Style Presets
- **Modular ASS Style Engine (`worker/caption-styles.mjs`)**:
  - `hormozi`: High-contrast Arial Black, yellow highlight on current spoken word, black outline, uppercase styling, 3-4 words per card.
  - `clean_minimal`: Mixed-case subtitle with soft translucent box background, lowercase friendly, 5-7 words per card.
  - `neon_highlight`: Electric cyan text with pulsing neon glow, modern uppercase styling, 3-4 words per card.
  - `bold_impact`: High-impact red/gold punchy stacked typography with drop shadow, 2-3 words per card.
  - `classic_subtitle`: Cinema standard white Arial with subtle drop shadow, lower-third placement, 7-10 words per card.
  - `highlighter`: Neon lime highlight marker effect simulating highlighter pen reveal, 3-5 words per card.
- **Security & Unicode Handling**:
  - Full ASS markup injection sanitization (`sanitizeAssText`) stripping curly-brace control tags and escaping backslashes.
  - Full support for RTL/Arabic Unicode text, emoji symbols, and extreme token lengths.
- **Database & UI Integration**:
  - Added `captionStyle String @default("hormozi")` to Prisma schema `Project` model and synced to production Neon PostgreSQL.
  - Added visual caption style picker grid to `/dashboard/projects/new` with live styled previews and badge indicators.
  - Worker reads `project.captionStyle` and applies the designated preset during rendering.
- **Host Verification (`scripts/test-render-styles.mjs`)**:
  - Installed `fonts-liberation` on Ubuntu 24.04 EC2 host for metric compatibility with Arial, Arial Black, and Times New Roman.
  - Live FFmpeg libass renders on EC2 (`13.62.192.145`):
    - `hormozi`: 1080x1920 rendered in 474ms (✓ PASS)
    - `clean_minimal`: 1080x1920 rendered in 483ms (✓ PASS)
    - `neon_highlight`: 1080x1920 rendered in 491ms (✓ PASS)
    - `bold_impact`: 1080x1920 rendered in 479ms (✓ PASS)
    - `classic_subtitle`: 1080x1920 rendered in 493ms (✓ PASS)
    - `highlighter`: 1080x1920 rendered in 472ms (✓ PASS)
- **Commit**: `820ed88` — `feat(captions): implement 6 distinct caption styles with visual picker and worker pipeline support`

---

### Part C: Gap 2 — Fast In-Product Clip Adjustment & Lightweight Re-Render
- **Problem Statement**: Previously, users wanting to tweak start/end timestamps had to re-transcribe and re-score the entire video or settle for the AI cut.
- **Lightweight Architecture**:
  - Added `transcript Json?` to `model Project` in Prisma schema to cache word-level timestamps permanently upon initial processing.
  - Implemented local persistent source caching in `tmpdir/nology-sources` so re-trims avoid re-downloading media.
  - Implemented `processClipAdjust(job)` in `worker/worker.mjs` that:
    1. Bypasses Whisper transcription and LLM scoring entirely.
    2. Filters cached word timestamps to the new `[start, end]` window.
    3. Generates the updated ASS subtitle file with the chosen caption preset.
    4. Trims, crops, burns subtitles, and applies audio normalization (`loudnorm`) in a single fast FFmpeg pass.
    5. Uploads the adjusted clip and new thumbnail to Cloudflare R2 and updates the database row.
- **API Endpoint (`POST /api/projects/[id]/clips/[clipId]/adjust`)**:
  - Validates `start >= 0`, `end > start`, duration between 15s and 120s, and `end <= source duration`.
  - Enforces project and clip ownership with session authentication and rate limiting.
  - Credit policy: **Free (0 credits) within 15 minutes of creation**; **1 credit thereafter**.
  - Automatically refunds the 1 credit if worker processing fails.
- **Creator UI (`project-detail.tsx`)**:
  - Added "Adjust Trim" toggle button on each clip card.
  - Inline collapsible trim panel featuring:
    - Current Start / End timestamp display in `mm:ss` format.
    - Dedicated `[-5s]`, `[-1s]`, `[+1s]`, `[+5s]` nudge buttons.
    - Duration indicator badge (green when 15s–120s, red when out-of-bounds).
    - Caption preset selector dropdown.
    - Real-time credit cost notice (Free vs 1 credit).
    - "Re-render Clip (~10-20s)" action button.
  - Active re-trim status overlay on clip preview card with animated progress indicator.
  - Reactive 4s polling automatically picks up completed renders and refreshes video playback.
- **Host Verification (`scripts/test-clip-adjust.mjs`)**:
  - Executed end-to-end clip adjustment test on live EC2 host:
    - 30-second source trimmed to [5s, 22s] (17s duration) with `neon_highlight` caption preset.
    - Retained 13/21 words synchronized in window.
    - Probe verified: 1080x1920 vertical video at exactly 17.00 seconds.
    - Total execution time on EC2: **7,995ms** (7.99 seconds, beating the <20s SLA by 60%).
- **Commits**:
  - `6a19fd0` — `feat(editor): add fast clip trim adjustment and lightweight re-render`
  - `ab1f2f0` — `fix(editor): resolve ESLint unused variable and type warnings in project detail and worker`

---

### Part D: Gap 3 — Pricing Rebuild with Real Unit Economics
- **Unit Cost Breakdown**:
  - Groq Whisper Large v3: $0.111 / hour = **$0.001850 / minute**.
  - Groq Llama 3.3 70B Scoring: **$0.000600 / minute**.
  - Cloudflare R2 Storage (15MB/clip, 0 egress): **$0.000135 / minute-month**.
  - AWS EC2 Compute (c6i.xlarge @ $0.17/hr, 0.25 encoding ratio): **$0.000708 / minute**.
  - **Total Technical Infrastructure COGS**: **$0.003293 / minute** (~$0.0033).
- **Plan Profitability**:
  - **Free Tier (40 credits)**: Maximum total lifetime exposure is strictly capped at **$0.1317** per user, protected by hardware device fingerprinting.
  - **Clipper Tier ($19 / month, 300 minutes)**:
    - Stripe fee: $0.851.
    - Maximum infra COGS: $0.988.
    - Total COGS: $1.839.
    - Net Gross Profit: **+$17.161 / month**.
    - **Gross Margin**: **90.3%**.
  - **Studio Tier ($49 / month, 1,200 minutes)**:
    - Stripe fee: $1.721.
    - Maximum infra COGS: $3.952.
    - Total COGS: $5.673.
    - Net Gross Profit: **+$43.327 / month**.
    - **Gross Margin**: **88.4%**.
- **Fast Clip Adjustment Economics**:
  - Technical COGS per re-trim: **$0.00041** (< 0.05¢).
  - Paid adjustments (1 credit = ~$0.04 - $0.06 value) yield **>99.2% gross margin**.
- **Market Benchmarks**:
  - Cliptica delivers **50% more minutes** than Opus Clip ($19 for 300 min vs 200 min).
  - Cliptica is **3x–6x cheaper per minute** than Klap ($0.29/min) and Munch ($0.25/min).
  - Cliptica is the only platform featuring a native TikTok/Whop Creator Rewards Campaign Ledger.
- **Artifacts & Tests**:
  - Authored comprehensive financial model: `PRICING_MODEL.md`.
  - Created unit tests in `tests/pricing-model.test.ts` (5 tests asserting COGS < $0.005, gross margin > 60% and > 85%, free exposure < $0.20, and re-trim margin > 95%).
- **Commit**: `36818a7` — `feat(pricing): rebuild subscription tiers with verified unit economics`

---

## 3. Verification & Test Suite Summary

### Test Suite Execution
Across all 12 test suites in the repository, 100% of tests are passing cleanly:

```
 RUN  v4.1.11 /opt/nology (EC2 Host)

 ✓ tests/settings-features.test.ts (5 tests)
 ✓ tests/webhook-idempotency.test.ts (5 tests)
 ✓ tests/proxy-pool.test.mjs (15 tests)
 ✓ tests/caption-styles.test.mjs (45 tests)
 ✓ tests/pricing-model.test.ts (5 tests)
 ✓ tests/validation.test.ts (13 tests)
 ✓ tests/clip-adjust.test.ts (11 tests)
 ✓ tests/billing-redirects.test.ts (4 tests)
 ✓ tests/ssrf.test.mjs (22 tests)
 ✓ tests/credits.test.mjs (8 tests)
 ✓ tests/device.test.ts (6 tests)
 ✓ tests/clip-from.test.ts (5 tests)

 Test Files  12 passed (12)
      Tests  144 passed (144)
   Duration  2.63s
```

### Production Build & PM2 Process Status on EC2 (`13.62.192.145`)
- Next.js Production Build: **57/57 routes compiled cleanly** (0 type errors, 0 ESLint errors).
- PM2 Service Status:
  - `nology-web` (PID 919295): **online** (0% CPU, 202.3 MB RAM, 0 downtime reload)
  - `nology-worker` (PID 919325): **online** (0% CPU, 71.4 MB RAM, listening for jobs)
  - `nology-bot` (PID 757263): **online** (0% CPU, 79.2 MB RAM, 15h uptime)
- Database: Neon PostgreSQL in sync with `prisma/schema.prisma` (including `captionStyle` and `transcript` columns).
