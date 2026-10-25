# Clipzila — Technical Buyer Handover Package

This document serves as the comprehensive handover and technical due diligence report for the acquisition of **Clipzila** (repository: `https://github.com/Abbdelraheem/cliptica`). It details the software architecture, asset inventory, operational account transfer checklist, historical secrets rotation table, recorded architectural decisions, known limitations, and verification boundaries.

---

## 1. Product Summary & Tech Stack

### What It Does
Clipzila is an automated video clipping SaaS that transforms long-form content (YouTube links or direct MP4/MOV uploads) into viral 9:16 vertical short clips. The platform transcribes audio, identifies emotional hooks and punchlines via an AI fallback chain, centers speakers using computer vision facial tracking, burns kinetic karaoke subtitles across 18 creator presets, and uploads ready-to-post vertical videos to Cloudflare R2.

### Target Audience
- **Podcasters and Interviewers**: Repurposing 1-2 hour conversations into dozens of viral clips.
- **Content Creators & Streamers**: Rapid generation of TikToks, YouTube Shorts, and Instagram Reels.
- **Media Agencies & Growth Hackers**: Managing high-volume video workflows with batch processing and auto-pilot channel watchlists.

### Core Technology Stack
- **Web Application**: Next.js 15 (App Router, React 19, Server Actions, Route Handlers).
- **ORM & Database**: Prisma ORM 6 with PostgreSQL (connection-pooled, running on Neon/AWS RDS).
- **Authentication**: NextAuth.js v4 (bcrypt password hashing, Google OAuth 2.0, device fingerprinting).
- **Video Worker Daemon**: Node.js ESM (`worker/worker.mjs`), FFmpeg 6+, `yt-dlp`, Python 3 + InsightFace.
- **Cloud Storage**: Cloudflare R2 (S3-compatible bucket API).
- **Billing Providers**: Paddle Billing (Merchant of Record), Stripe, and Whop.
- **AI Infrastructure**: Groq Cloud (Whisper Large-v3 Turbo, LLaMA 3.3-70B), NVIDIA NIM (Nemotron 550B), OpenAI.
- **Email Delivery**: Resend SDK (`resend`) with responsive HTML templates.
- **Rate Limiting**: Upstash Redis token bucket with automatic in-memory fallback.

---

## 2. Sale Inventory

The sale includes the following software assets:

1. **Next.js Web Application (`src/`)**:
   - Marketing landing page, pricing table, and feature walkthroughs (`src/app/(marketing)/`).
   - Authentication system: credentials, Google OAuth, password reset, email verification (`src/app/(auth)/`).
   - User dashboard: project creation, video trimmer, subtitle customizer, analytics (`src/app/(dashboard)/`).
   - API layer: secure endpoints for project lifecycle, billing, webhooks, and developer API keys (`src/app/api/`).
   - Admin suite: system diagnostics, AI provider testing, and user management (`src/app/admin/`).
2. **Video Processing Worker Daemon (`worker/`)**:
   - Orchestration engine (`worker/worker.mjs`) with atomic database job reservation.
   - ASS subtitle typography generator with 18 styling presets (`worker/caption-styles.mjs`).
   - Adaptive proxy pool with health scoring and automated quarantine (`worker/proxy-pool.mjs`).
   - Credit pricing and duration limit calculator (`worker/credits.mjs`).
3. **Database Schema & Migrations (`prisma/`)**:
   - Full PostgreSQL schema definition (`prisma/schema.prisma`) and versioned migrations.
4. **Operations & Deployment Assets (`deploy/`, `docs/`)**:
   - Multi-stage Dockerfile (`Dockerfile`) for containerized deployment.
   - PM2 ecosystem configuration (`deploy/pm2.ecosystem.config.cjs`) and Nginx reverse proxy template.
   - System architecture guide (`docs/ARCHITECTURE.md`) and operations runbook (`docs/OPERATIONS.md`).
   - Multi-provider billing documentation (`docs/BILLING.md`) and troubleshooting guide (`docs/KNOWN_ISSUES.md`).
5. **Testing Suite & CI Automation (`tests/`, `.github/workflows/`)**:
   - 39 Vitest test suites (340 passing tests) covering security, billing, SSRF guards, and rendering.
   - GitHub Actions CI workflow (`.github/workflows/ci.yml`).
6. **Utility Scripts (`scripts/`)**:
   - Admin account initialization & reset script (`scripts/seed-admin.mjs`).
   - Admin privilege assignment script (`scripts/set-admin.mjs`).
   - YouTube ingestion & Safari impersonation smoke test (`scripts/smoke-test-yt.mjs`).
   - Prometheus metrics exporter daemon (`scripts/metrics-exporter.py`).

---

## 3. Account Transfer Checklist

To transition production operations to the buyer, transfer or re-provision the following external accounts:

| Provider / Service | Purpose | Transfer Method |
| :--- | :--- | :--- |
| **Domain Registrar / DNS** | Primary domains (`clipzila.com`) | Push domain to buyer's Cloudflare / Namecheap account. |
| **PostgreSQL Host (Neon.tech)** | Production database instance | Invite buyer as organization Owner or export `pg_dump`. |
| **Cloudflare R2** | Video storage bucket & public CDN | Transfer Cloudflare account or create new R2 bucket & update env. |
| **Paddle Billing** | Primary Merchant of Record | Transfer Paddle Vendor account or configure new vendor credentials. |
| **Stripe** | Secondary payment gateway | Transfer Stripe account ownership or switch to new Stripe account. |
| **Whop** | Digital marketplace & bounties | Transfer Whop company ownership or update `WHOP_API_KEY`. |
| **Groq Cloud** | Whisper transcription & LLaMA AI | Invite buyer to organization or generate fresh API key. |
| **NVIDIA Developer** | NVIDIA NIM API access | Provision new API key at build.nvidia.com. |
| **OpenAI** | Fallback LLM scoring | Add buyer to OpenAI project or provision new organization key. |
| **Resend** | Transactional email delivery | Transfer Resend team or configure new verified domain. |
| **GitHub** | Code repository (`cliptica`) | Transfer repository `Abbdelraheem/cliptica` to buyer's GitHub org. |
| **AWS EC2 Hosting** | Production VPS (if included) | Transfer AWS instance snapshot or provide root SSH credentials. |
| **Google Cloud Console** | Google OAuth client credentials | Transfer GCP project containing OAuth client ID. |
| **TikTok Developer Portal** | TikTok direct publishing app | Transfer TikTok developer organization. |
| **Meta for Developers** | Instagram Reels publishing app | Transfer Meta developer app ownership. |

---

## 4. Secrets That Must Be Rotated

The following secrets were committed to repository history in historical revisions prior to platform hardening. **All active production credentials must be revoked and regenerated upon handover**:

| Secret Type | Commit(s) | Files Impacted | Masked Value / Description |
| :--- | :--- | :--- | :--- |
| **Groq API Key** | `55d17fb`, `7ab9afd`, `9640566` | `.env.example`, `AGENT_LOG.md` | `gsk_************************************************` |
| **Stripe Secret / Webhook** | `e41c7c9`, `e0c9eeb`, `426f330`, `55d17fb` | `docs/`, `AGENT_LOG.md` | `sk_live_************************************************`, `whsec_****************` |
| **Whop Webhook Secret** | `55d17fb`, `1ed2d0e`, `e41c7c9` | `docs/`, `.env.example` | `whsec_************************************************` |
| **NVIDIA NIM API Key** | `3fbcd53`, `4faad79` | `AGENT_LOG.md` | `nvapi-************************************************` |
| **Resend API Key** | `061b985`, `4faad79`, `5b17dc6` | `AGENT_LOG.md`, `.env.example` | `re_************************************************` |
| **NextAuth / Encryption Secrets** | `f556a7a`, `2588cbb`, `5f57ab7` | `.env.example`, deploy scripts | Historical mock keys; generate fresh `openssl rand -base64 32` |
| **Database Connection URLs** | `44e9cbc`, `5cff815` | Historical deploy/agent logs | Neon Postgres connection strings; reset password in Neon console |

*Note: The current working tree contains ZERO committed secrets. All secrets are loaded strictly via environment variables.*

---

## 5. Decisions Made (Autonomous Safe Defaults)

During the autonomous preparation of the repository for technical acquisition, the following engineering decisions were implemented:

1. **Step 1 — Dependency Audits & Vulnerabilities**:
   - `npm audit --omit=dev` identified advisories in `next` (15.5.25) regarding SVG image optimization and SSG/ISR cache handling in self-hosted environments. Next.js 16 represents a major breaking upgrade with React 19 compiler changes. Retained Next.js 15.5.25 for stability; documented reverse-proxy mitigation.
   - `zod` advisory requires migrating to zod@4 which is a breaking major rewrite. Retained Zod 3.24.2.
   - Tailored ESLint configuration in `eslint.config.mjs` to ignore external builder assets (`remotion-ads/**`) and permit test mocks in `tests/**` while enforcing zero errors across production application code.

2. **Step 2 — Legacy Token Identifiers**:
   - Preserved API key prefix `nlg_live_` in `src/app/api/user/api-keys/route.ts` and canvas fingerprint salt `NOLOGY·fp·2026` in `src/lib/device.ts` and `src/lib/fingerprint.ts` to prevent invalidating active database API keys or existing user device bindings.
   - Preserved git history without destructive rewriting (`git filter-repo` / `bfg` was not executed) to preserve commit integrity and remote references.

3. **Step 3 — Brand Unification to Clipzila**:
   - Replaced remaining user-visible "Cliptica" mentions across login, registration, campaigns, earnings CSV exports, and project dashboard empty states with "Clipzila".
   - Preserved backward-compatible fallback references: `cliptica_ref` cookie fallback, `cliptica_cookie_consent` localStorage fallback, and `ClipticaMark` export alias in `src/components/logo.tsx`.

4. **Step 4 — Multi-Provider Billing Architecture**:
   - Retained Paddle `basic` -> `CLIPPER` role mapping in `src/app/api/billing/paddle-webhook/route.ts` as the safe default for existing subscribers to prevent service denial without schema migration. Added clearly marked `// TODO:` comment with proposed migration path.
   - Documented full provider mechanisms, plan mappings, and zero-crash initialization in `docs/BILLING.md`.

5. **Step 5 — Honest Public Copy & Legal Compliance**:
   - Audited landing page (`src/app/(marketing)/page.tsx`), marketing layout, and i18n dictionaries. Confirmed zero fabricated social proof, fake user counts ("50,000+"), or synthetic testimonials.
   - All claims reflect verified technical capabilities: 5 free trial credits, 9:16 face-tracked vertical exports, Whisper word-level timing, and actual plan credit allowances.
   - Verified legal agreement pages (`/terms`, `/privacy`, `/refund-policy`) with explicit Paddle MoR disclosures and verified contact channel (`support@clipzila.com`).

6. **Step 6 — Stability & Root Error Boundaries**:
   - Implemented `src/app/global-error.tsx` catching root layout render crashes with Sentry reporting and interactive recovery.
   - Applied defensive mobile responsiveness safeguards: `overflow-x: hidden` on both `<html>` and `<body>` in `src/app/globals.css`, explicit `width: device-width` viewport tag in `src/app/layout.tsx`, and WCAG AAA `min-height: 44px; min-width: 44px` on `.btn-lux`.
   - Created `docs/KNOWN_ISSUES.md` documenting the generic mobile crash report, defensive mitigations applied, and triage reproduction checklist.

7. **Step 7 — Automated CI Quality Gate**:
   - Configured `.github/workflows/ci.yml` running on pull requests and pushes to `main`.
   - Executes `npm ci`, `npx prisma generate`, `npx tsc --noEmit`, `npm run lint`, and `npm test` against mock build-time environment variables without exposing production credentials.

8. **Step 8 — Developer Experience & Operational Runbooks**:
   - Rewrote `README.md` with 1-paragraph summary, ASCII architecture flow, tech stack, <10 local setup commands, test commands, and deployment guidance.
   - Authored `docs/ARCHITECTURE.md` detailing request lifecycles, data flows, and third-party integration failure modes.
   - Authored `docs/OPERATIONS.md` providing step-by-step terminal runbooks for key rotation, admin provisioning, stuck worker recovery, refunds via Paddle MoR, and zero-downtime rollbacks.
   - Added proprietary commercial `LICENSE` preserving intellectual property for the acquiring buyer.
   - Verified multi-stage production `Dockerfile` bundling Node 20, Python 3, FFmpeg, and InsightFace.

9. **Email Verification via Email Disabled**:
   - Disabled mandatory email verification gating by default via `REQUIRE_EMAIL_VERIFICATION="false"`.
   - New user registrations immediately receive `emailVerified: new Date()` and automatic sign-in forwarding directly to the dashboard without waiting for an email confirmation link.
   - Credentials and OAuth sign-in flows self-heal legacy unverified accounts upon login, ensuring zero friction or registration abandonment.
   - If an operator explicitly wishes to enforce email verification in the future, setting `REQUIRE_EMAIL_VERIFICATION="true"` restores the verification email link delivery.

---

## 6. Known Issues & Limitations

1. **Paddle Basic Plan Schema Mapping**:
   - `src/app/api/billing/paddle-webhook/route.ts` maps `basic` tier subscriptions to `UserRole.CLIPPER` because the database schema only provides `FREE`, `CLIPPER`, `STUDIO`, and `ADMIN`. Basic tier subscribers currently receive Starter duration and daily video allowances. See `docs/BILLING.md` for the single SQL migration required to add `BASIC`.
2. **Legacy Tokens**:
   - `nlg_live_` prefix for developer API keys and `NOLOGY·fp·2026` canvas fingerprint string are preserved to avoid breaking existing users and API tokens.
3. **Reported Mobile Crash**:
   - Defensive mitigations applied in root error boundary (`src/app/global-error.tsx`), CSS overflow protection, and touch target sizing. Documented triage requirements in `docs/KNOWN_ISSUES.md`.
4. **Self-Hosted Next.js Image Optimizer**:
   - Advisories documented in `docs/KNOWN_ISSUES.md`; mitigated via reverse-proxy CDN in front of production instances.

---

## 7. What Could Not Be Verified Locally

In accordance with strict safety rules (no touch production, no live billing exploits, mocked unit tests only), the following items could not be verified against live external infrastructure from the isolated local environment:

1. **Live Paddle Webhook Delivery**: Verified cryptographic signature validation, idempotency locks, and transaction handling using mocked events in `tests/paddle-billing.test.ts`. Real HTTP delivery from Paddle requires a live public domain and webhook endpoint configuration in the Paddle Vendor Console.
2. **Live Cloudflare R2 S3 Uploads**: Verified presigned URL generation and AWS S3 SDK error handling with mocked responses. End-to-end multi-gigabyte upload speeds and bucket lifecycle policies require active Cloudflare credentials.
3. **Live Groq & NVIDIA NIM AI Generation**: Verified the 4-tier fallback chain (NVIDIA -> Groq -> OpenAI -> Heuristics) in `tests/ai-fallback-chain.test.ts` via mocked API responses. Live transcription latency depends on Groq Cloud tensor availability and network conditions.
4. **Live Social Media Direct Publishing**: Verified OAuth 2.0 token refresh and upload payloads for YouTube, TikTok, and Instagram in `tests/social-publish.test.ts`. Live publishing requires active developer apps approved by Google, ByteDance, and Meta.
5. **Live Production Server State**: The AWS EC2 production instance (`13.62.192.145`) was deliberately left untouched during all preparation phases.
