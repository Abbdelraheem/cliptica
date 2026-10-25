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

*(This section will be expanded during Steps 4, 5, and 6.)*
