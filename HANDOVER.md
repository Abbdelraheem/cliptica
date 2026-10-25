# Clipzila (Technical Buyer Handover)

This document provides a technical buyer with an audit-ready overview of the **Clipzila** SaaS codebase (Next.js 15, PostgreSQL/Prisma, TypeScript, asynchronous video processing worker pipeline).

---

## 1. Product Summary & Tech Stack

- **Frontend & App Framework**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React.
- **ORM & Database**: Prisma ORM with PostgreSQL (hosted on Neon/Postgres with connection pooling).
- **Authentication**: NextAuth.js v4 (Credentials with bcrypt + Google OAuth 2.0).
- **Video Worker Pipeline**: Node.js ESM daemon (`worker/worker.mjs`) orchestrating `yt-dlp`, `ffmpeg`, Whisper transcription (Groq Whisper API / Local Whisper fallback), InsightFace speaker tracking, and ASS subtitle rendering.
- **Storage**: Cloudflare R2 (S3-compatible bucket) for source video ingestion and clip output artifacts.
- **Billing**: Multi-provider support (Stripe, Paddle Billing, and Whop) with fail-closed cryptographic signature verification.
- **Email Delivery**: Resend SDK (`resend`) with React Email templates.
- **Rate Limiting & Fingerprinting**: Upstash Redis token bucket with fallback in-memory rate limiting; SHA-256 canvas/WebGL hardware fingerprinting.

---

## 2. Decisions Made

The following safe technical decisions were applied during codebase preparation:

1. **Step 1 - Dependency Audit & Vulnerabilities**:
   - `npm audit --omit=dev` identified advisories in `next` (15.5.25) regarding SVG image optimization and SSG/ISR cache handling in self-hosted environments. Next.js 16 represents a major breaking upgrade with React 19 compiler changes. Safe resolution: Documented as known advisory for self-hosted image optimizer; buyer should deploy behind standard reverse-proxy (Nginx / Cloudflare CDN) or update when Next 16 stabilizes.
   - `zod` advisory requires migrating to zod@4 which is a breaking major rewrite. Zod 3.24.2 is retained for stability.
   - Test suites in `tests/**` and standalone builder assets in `remotion-ads/**` have tailored ESLint overrides in `eslint.config.mjs` to prevent false positive lint failures while strictly maintaining type checking.

2. **Step 2 - Legacy Token Identifiers**:
   - Preserved API key prefix `nlg_live_` in `src/app/api/user/api-keys/route.ts` and canvas fingerprint salt `NOLOGY·fp·2026` in `src/lib/device.ts` / `src/lib/fingerprint.ts` to prevent invalidating active database API keys or existing user device bindings.

3. **Step 2 - Historical Git Secrets**:
   - In accordance with non-destructive handover guidelines, git history was NOT rewritten (`git filter-repo` / `bfg` was not executed to avoid breaking existing commits or remote references). All historical credentials found in git commits have been cataloged below for mandatory rotation.

4. **Step 3 - Brand Unification to Clipzila**:
   - Replaced remaining user-visible "Cliptica" mentions across login, registration, campaigns, earnings CSV exports, and project dashboard empty states with "Clipzila".
   - Updated root `package.json` name to `"clipzila"` with metadata description.
   - Preserved backward-compatible fallback references:
     - `nlg_live_` prefix for developer API keys (`src/app/api/user/api-keys/route.ts`). Changing this would invalidate existing API tokens.
     - `NOLOGY·fp·2026` hardware fingerprint seed string in `src/lib/device.ts` and `src/lib/fingerprint.ts`. Changing this would invalidate device limit locks for existing accounts.
     - `cliptica_ref` cookie fallback alongside `clipzila_ref` (`src/app/r/[code]/route.ts`, `src/lib/auth.ts`) to avoid dropping in-flight affiliate attribution.
     - `cliptica_cookie_consent` localStorage fallback (`src/components/cookie-consent.tsx`).
     - `ClipticaMark` export alias in `src/components/logo.tsx`.

5. **Step 4 - Multi-Provider Billing Architecture**:
   - Documented full billing mechanics across Paddle, Stripe, and Whop in `docs/BILLING.md`.
   - Verified fail-safe startup: all 3 providers instantiate cleanly without crashing if environment variables are absent.
   - Retained Paddle `basic` -> `CLIPPER` role mapping in `src/app/api/billing/paddle-webhook/route.ts` as the safe default for existing subscribers, added clearly marked `// TODO:` comment with proposed migration path.

6. **Step 5 - Honest Public Copy & Legal Compliance**:
   - Audited landing page (`src/app/(marketing)/page.tsx`), marketing layout, and i18n dictionaries. Confirmed zero fabricated social proof, fake user counts ("50,000+"), or synthetic testimonials.
   - All claims reflect verified technical capabilities: 5 free trial credits, 9:16 face-tracked vertical exports, Whisper word-level timing, and actual plan credit allowances.
   - Verified legal agreement pages (`/terms`, `/privacy`, `/refund-policy`) with explicit Paddle MoR disclosures and verified contact channel (`support@clipzila.com`).

7. **Step 6 - Stability & Root Error Boundaries**:
   - Implemented `src/app/global-error.tsx` catching root layout render crashes with Sentry reporting and interactive recovery.
   - Applied defensive mobile responsiveness safeguards: `overflow-x: hidden` on both `<html>` and `<body>` in `src/app/globals.css`, explicit `width: device-width` viewport tag in `src/app/layout.tsx`, and WCAG AAA `min-height: 44px; min-width: 44px` on `.btn-lux`.
   - Created `docs/KNOWN_ISSUES.md` documenting the generic mobile crash report, defensive mitigations applied, and triage reproduction checklist.

---

## 3. Secrets That Must Be Rotated

The following secrets were committed to repository history in past revisions prior to security hardening. **All active credentials must be revoked and regenerated in production**:

| Secret Type | Commit(s) | Files Impacted | Masked Value / Description |
| :--- | :--- | :--- | :--- |
| **Groq API Key** | `55d17fb`, `7ab9afd`, `9640566` | `.env.example`, `AGENT_LOG.md` | `gsk_************************************************` |
| **Stripe Secret / Webhook** | `e41c7c9`, `e0c9eeb`, `426f330`, `55d17fb` | `docs/`, `AGENT_LOG.md` | `sk_live_************************************************`, `whsec_****************` |
| **Whop Webhook Secret** | `55d17fb`, `1ed2d0e`, `e41c7c9` | `docs/`, `.env.example` | `whsec_************************************************` |
| **NVIDIA NIM API Key** | `3fbcd53`, `4faad79` | `AGENT_LOG.md` | `nvapi-************************************************` |
| **Resend API Key** | `061b985`, `4faad79`, `5b17dc6` | `AGENT_LOG.md`, `.env.example` | `re_************************************************` |
| **NextAuth / Encryption Secrets** | `f556a7a`, `2588cbb`, `5f57ab7` | `.env.example`, deploy scripts | Historical mock keys; must generate fresh `openssl rand -base64 32` |
| **Database Connection URLs** | `44e9cbc`, `5cff815` | Historical deploy/agent logs | Neon Postgres connection strings; reset password in Neon console |

*Note: The current working tree contains ZERO committed secrets. All secrets are loaded strictly via environment variables.*

---

## 4. Known Issues & Legacy Artifacts

1. **Paddle Basic Plan Mapping**:
   - `src/app/api/billing/paddle-webhook/route.ts` maps `basic` tier subscriptions to `UserRole.CLIPPER` because the database schema only provides `FREE`, `CLIPPER`, `STUDIO`, and `ADMIN`. Basic tier subscribers currently receive Starter duration and daily video allowances. See `docs/BILLING.md` for the single SQL migration required to add `BASIC`.
2. **Legacy Tokens**:
   - `nlg_live_` prefix for developer API keys and `NOLOGY·fp·2026` canvas fingerprint string are preserved to avoid breaking existing users and API tokens.
3. **Reported Mobile Crash**:
   - Defensive mitigations applied in root error boundary (`src/app/global-error.tsx`), CSS overflow protection, and touch target sizing. Documented triage requirements in `docs/KNOWN_ISSUES.md`.
