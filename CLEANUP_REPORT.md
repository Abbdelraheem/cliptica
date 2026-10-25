# Clipzila — Repository Cleanup & Hygiene Report

**Branch**: `cleanup-1`  
**Base**: `origin/main` (synced with `sale-ready-1`)  
**Product**: Clipzila (AI Video Clipping Platform)  
**Date**: October 2026  

---

## 1. Metrics: Before vs After

| Metric | Before Cleanup | After Cleanup | Change |
| :--- | :--- | :--- | :--- |
| **Tracked Files Count** | **342 files** | **287 files** | **-55 files (-16.1%)** |
| **Tracked Files Size (Disk)** | **10.26 MB** (10,506,240 B) | **5.02 MB** (5,261,696 B) | **-5.24 MB (-51.1%)** |
| **TypeScript Typecheck** | 0 errors | 0 errors | Clean pass |
| **ESLint Errors / Warnings** | 0 errors, 21 warnings | 0 errors, 20 warnings | -1 warning eliminated |
| **Automated Tests (Vitest)** | 39 files passed, 341 tests | 39 files passed, 341 tests | 100% pass rate (341/341) |
| **Next.js Production Build** | Standalone build passed | Standalone build passed | Clean pass (86 routes) |

---

## 2. Deletions Summary by Category

| Category | Files Deleted | Size Saved | Safety Proof & Justification |
| :--- | :--- | :--- | :--- |
| **Unused Promo & Heavy Media** | 8 files (`public/images/whop/*`, `public/images/bg-terrain.jpg`, `public/images/logo/clipzila_iconic_logo.jpg`, `public/brand-logo-test.png`, `public/marketing/clipzila_free_trial.jpg`, `public/marketing/clipzila_pricing_compare.jpg`) | **4.85 MB** | Zero references in code, CSS, or docs. Active CSS uses lightweight WebP (`bg-terrain.webp`, 85 KB). |
| **Stray Prototypes & Demo HTML** | 4 files (`cliptica-3d.html`, `cliptica-aurora.html`, `design-demo.html`, `simple-demo.html`) | **63.6 KB** | Standalone HTML prototypes from early prototyping phases. Unreferenced by Next.js application routes. |
| **Obsolete Logs & Agent Reports** | 16 files (`AGENT_LOG.md`, `AUDIT_REPORT.md`, `COMPETITIVE_GAP_ANALYSIS.md`, `CREDIT_MODEL_FIX_REPORT.md`, `DEPLOYMENT-READINESS-REPORT.md`, `DETECTIVE_FINDINGS.md`, `DOMAIN_AND_PAYMENT_CHECKLIST.md`, `GAP_CLOSURE_REPORT.md`, `INFRASTRUCTURE_NOTES.md`, `LAUNCH_READINESS_REPORT.md`, `MOBILE_AUDIT_REPORT.md`, `MOCK_TESTING_GUIDE.md`, `NEEDS_HUMAN_DECISION.md`, `PLATFORM_APPROVAL_CHECKLIST.md`, `PRICING_MODEL.md`, `PROXY_UPGRADE_GUIDE.md`) | **315 KB** | Historical agent scratchpads and internal checklists. Essential unit economics moved to `docs/BILLING.md`; proxy configurations consolidated in `docs/OPERATIONS.md`. |
| **Dead Code & Unused UI Components** | 17 files (`src/components/ui/avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `hover-card.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `slider.tsx`, `switch.tsx`, `tabs.tsx`, `tooltip.tsx`) + dead helpers in `src/lib/utils.ts` | **31.2 KB** | Unused shadcn/ui boilerplates (the application UI uses custom Tailwind CSS classes and `DESIGN_SYSTEM.md`). Zero imports verified repo-wide. |
| **Dead Public Starter Assets** | 6 files (`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`, `public/logo.png`) | **363 KB** | Default Create-Next-App template icons and duplicate logo copy. Code exclusively references `/brand/logo.png`. |
| **Unused Dependencies** | 15 packages (`@radix-ui/*` [13 packages], `class-variance-authority`, `enhanced-resolve`) | **53 packages removed** from `node_modules` | Confirmed zero imports across application, worker, and test suites. Lockfile and Dockerfile synchronized. |
| **Scratch Test Scripts** | 4 files (`scripts/test-ai.mjs`, `scripts/test-clip-adjust.mjs`, `scripts/test-render-styles.mjs`, `scripts/build-email-preview.mjs`) | **16.8 KB** | Manual dev test scripts completely superseded by automated Vitest suites (`tests/admin-ai-test-guard.test.ts`, `tests/clip-adjust.test.ts`, `tests/caption-styles.test.mjs`). |

---

## 3. Kept Because Uncertain

The following items were retained after verification:

1. **`deploy/ecosystem.config.cjs` & `deploy/pm2.ecosystem.config.cjs`**: Retained both identical files because operational shell scripts (`deploy/backup.sh`, `deploy/deploy.sh`) reference `pm2.ecosystem.config.cjs` while provisioning scripts and README reference `ecosystem.config.cjs`.
2. **`public/brand/watermark.png`**: Retained because it is dynamically loaded at runtime by `worker/worker.mjs` for branding free-tier video exports.
3. **`public/google314901eae7d7629d.html`**: Retained because it provides site ownership verification for Google Search Console.
4. **`public/images/bg-terrain.webp`** (85 KB): Retained because it is actively referenced in `src/app/globals.css` for dashboard backdrop styling.
5. **`public/marketing/clipzila_amber_vault.jpg`, `clipzila_story_reel.jpg`, `clipzila_viral_growth.jpg`**: Retained because they are actively showcased in `src/app/(marketing)/page.tsx`.
6. **`scripts/seed-admin.mjs` & `scripts/set-admin.mjs`**: Retained for system bootstrapping and runbook administration documented in `docs/OPERATIONS.md`.
7. **`scripts/smoke-test-yt.mjs` & `scripts/metrics-exporter.py`**: Retained for VPS maintenance and Prometheus infrastructure monitoring.

---

## 4. Production Secrets Rotation Ledger

As documented in `HANDOVER.md`, no secrets exist in the working tree. Historical commits containing keys prior to the security hardening phase must be rotated upon ownership handover:
- **Groq API Key**: `gsk_************************************************` (rotate in Groq Console)
- **Stripe Secret / Webhooks**: `sk_live_************************************************`, `whsec_****************` (rotate in Stripe Dashboard)
- **NVIDIA NIM Key**: `nvapi-************************************************` (rotate at build.nvidia.com)
- **Resend Key**: `re_************************************************` (rotate in Resend Dashboard)
- **NextAuth Secret / Encryption Secret**: Generate fresh 32-byte keys via `openssl rand -base64 32` for production `.env`.
