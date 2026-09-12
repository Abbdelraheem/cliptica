# Cliptica Project Map

> **Directive for Agents:** When given a small, specific fix request, go directly to the relevant file(s) below rather than re-scanning the full repository structure.

---

## 1. Authentication & Session Management
- `src/lib/auth.ts`: NextAuth configuration, credential & Google OAuth providers, JWT token population (`dbUser.name`, `role`, `credits`), session callbacks, and password validation.
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth HTTP route handler entry point.
- `src/app/(auth)/login/page.tsx`: Sign-in UI, device fingerprint check, and credential submit handler.
- `src/app/(auth)/register/page.tsx`: Sign-up UI, device account limits, and new account provisioning.
- `src/app/(auth)/verify-email/page.tsx` & `reset-password/page.tsx`: Email confirmation and password recovery flows.

## 2. User Profile & Settings API
- `src/app/api/auth/me/route.ts`: Profile retrieval and PATCH updates (`name`, email sync).
- `src/app/api/auth/change-password/route.ts`: Password change handler with current-hash verification and bcrypt hashing.
- `src/app/api/auth/forgot-password/route.ts` & `reset-password/route.ts`: Password reset token generation, verification, and update.
- `src/app/api/user/api-keys/route.ts`: User developer API key generation and management.
- `src/app/api/user/sessions/route.ts`: Active device session tracking and revocation.

## 3. Settings UI
- `src/app/(dashboard)/dashboard/settings/page.tsx`: User profile management, password update with autocomplete, social platform connections, API keys, active sessions, and account deletion.

## 4. Billing & Stripe Payments
- `src/app/api/billing/checkout/route.ts`: Stripe checkout session creation (Clipper & Studio tiers).
- `src/app/api/billing/portal/route.ts`: Stripe Customer Billing Portal redirect handler.
- `src/app/api/billing/webhook/route.ts`: Idempotent Stripe webhook receiver (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_succeeded`).
- `src/app/(dashboard)/dashboard/billing/page.tsx`: Plan comparison, credit allocations, and subscription upgrade UI.
- `src/lib/stripe.ts`: Stripe SDK client, plan definitions (`PLANS`), prices, and role mappings.

## 5. Projects & Video Processing API
- `src/app/api/projects/route.ts`: Project list query and project creation (validates credits, duration limit, and enqueues `ProcessingJob`).
- `src/app/api/projects/[id]/route.ts`: Single project retrieval, status polling, and project deletion.
- `src/app/api/projects/upload-url/route.ts`: Presigned Cloudflare R2 upload URL generator for direct video file uploads.
- `src/app/api/projects/[id]/clips/[clipId]/adjust/route.ts`: Clip re-trimming and re-rendering job dispatcher.

## 6. Project Creation & Video Dashboard UI
- `src/app/(dashboard)/dashboard/projects/new/page.tsx`: 3-tab creation interface (YouTube URL, Direct Video Upload, Whop/ContentReward Campaign Ingestion).
- `src/app/(dashboard)/dashboard/projects/page.tsx`: Project listing and status grid.
- `src/app/(dashboard)/dashboard/projects/detail/page.tsx` & `project-detail.tsx`: Video player, 3-clip selection gallery, subtitle style switching, and social export kit.

## 7. Worker Pipeline (Video Processing Engine)
Main orchestrator: `worker/worker.mjs`
- **Config & Environment Sync**: `loadEnvFile` (~L40), `syncConfigInto` (~L145)
- **Source Ingestion & Proxy Fallback**:
  - `download` (~L172–249): `yt-dlp` download with Safari-18.4 impersonation, cookies, and fast-failing proxy rotation.
  - `downloadFromR2` (~L250–258): AWS S3/R2 direct asset retrieval.
  - `probeDuration` (~L265–274): `ffprobe` video duration extractor.
- **Audio Extraction & Transcription**:
  - `extractAudio` (~L301–308): Extracts 64k mono MP3 for transcription.
  - `transcribeGroq` (~L309–331): Fast Groq Whisper API transcription (`whisper-large-v3`).
  - `transcribeLocal` (~L332–350): Local Python/Whisper fallback on CPU.
  - `transcribe` (~L351–369): Unified transcription router (Groq -> Local).
- **Viral Moment Detection & Scoring**:
  - `generateCandidateMoments` (~L379–462): Boundary detection, word pacing, and candidate generation.
  - `llmScoreMoments` (~L463–524): AI evaluation using Groq LLaMA 3.3-70B with JSON schema.
  - `heuristicScoreMoments` (~L525–591): Rule-based fallback scoring.
  - `scoreMoments` (~L592–600): Candidate moment selector.
- **Video Rendering & Framing**:
  - `faceTrack` (~L601–621): Python InsightFace & OpenCV speaker tracker.
  - `renderClip` (~L622–731): FFmpeg 9:16 / 1:1 / 16:9 crop, PTS timing sync, and ASS karaoke burn-in.
  - `renderAll` (~L741–759): Parallel multi-clip rendering lane.
- **Job Lifecycle Loop**:
  - `processClipAdjust` (~L787–912): Clip re-trimming execution.
  - `processJob` (~L913–1061): Complete pipeline (8% fetch -> 30% transcribe -> 52% score -> 58% render -> R2 upload -> credit billing).
  - `claimNextJob` (~L1112–1128): Atomic database job reservation.
  - `loop` (~L1129–1229): Continuous polling daemon.

## 8. Caption Styles & Typography
- `worker/caption-styles.mjs`: ASS subtitle styling generators for all 10 presets (Hormozi Pop, Clean Minimal, Neon Glow, Bold Impact, etc.) with font bindings, highlight colors, and spring scaling.
- `worker/credits.mjs`: Pricing calculation (`calcClipCredits`: 1 credit per final video) and plan length limits (`planMaxMinutes`).
- `worker/proxy-pool.mjs`: Adaptive proxy health scoring, quarantine management, and priority sorting.

## 9. Database & Storage
- `prisma/schema.prisma`: Complete PostgreSQL schema (`User`, `Project`, `ProcessingJob`, `Clip`, `Account`, `Session`, `CreditTransaction`, `SocialConnection`, `Campaign`, `Payout`, `Setting`).
- `src/lib/prisma.ts`: PrismaClient singleton with connection pooling.
- `src/lib/r2.ts`: Cloudflare R2 S3 client for video storage, presigned URLs, and asset deletion.

## 10. Validation & Rate Limiting
- `src/lib/validation.ts`: Zod schemas for all request payloads (`projectCreateSchema`, `authRegisterSchema`, `userProfileSchema`, `billingCheckoutSchema`).
- `src/lib/rate-limit.ts`: Upstash Redis and in-memory token bucket rate limiters for auth and API routes.
- `src/lib/device.ts`: SHA-256 canvas/WebGL hardware fingerprint generator and duplicate-account prevention.

## 11. Social Media Publishing
- `src/lib/social/*`: OAuth 2.0 connection, token refresh, and publishing integrations for YouTube, TikTok, and Instagram Reels.
- `prisma/schema.prisma` -> `model SocialConnection`: Encrypted OAuth access tokens, refresh tokens, and channel metadata.

## 12. Design Tokens & Styling
- `DESIGN_SYSTEM.md`: Complete UI specification, color palette (near-black, charcoal, forge orange `#FF5A1F`, champagne gold), and typography guidelines.
- `src/app/globals.css`: Tailwind CSS v4 design system, surface variables, button styles (`btn-lux`, `btn-gold`), ambient glow effects, and typography.
- `src/components/logo.tsx`: `ClipticaMark` and `Wordmark` SVG branding components.
