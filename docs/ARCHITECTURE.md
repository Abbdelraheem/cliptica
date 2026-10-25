# Clipzila — System Architecture & Technical Specifications

This document outlines the architecture, data flows, execution lifecycles, and third-party service dependencies of the **Clipzila** AI video clipping SaaS platform.

---

## 1. High-Level Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Client Web Browser       │
                                  └──────────────┬────────────────┘
                                                 │ HTTPS / WSS
                                                 ▼
               ┌──────────────────────────────────────────────────────────────────┐
               │              Next.js 15 Web Application (App Router)             │
               │  - Auth (NextAuth v4)        - Projects & Media Dashboard        │
               │  - Multi-Provider Billing    - Presigned Upload Dispatcher       │
               │  - Social OAuth Connect      - SSRF-Safe Ingestion Validation    │
               └──────────────┬───────────────────────────────┬───────────────────┘
                              │                               │
                      SQL (Prisma Pool)               Presigned S3 URLs
                              ▼                               ▼
       ┌──────────────────────────────┐              ┌───────────────────────────┐
       │   PostgreSQL Database        │              │  Cloudflare R2 Bucket     │
       │   (Neon / Postgres RDS)      │              │  - Source Video Storage   │
       │   - User & Subscription      │              │  - Rendered 9:16 MP4s     │
       │   - ProcessingJob Queue      │              │  - Transcripts & ASS      │
       │   - Credit & Payout Ledgers  │              └─────────────▲─────────────┘
       └──────────────▲───────────────┘                            │
                      │ Atomic Job Claim (SKIP LOCKED)             │ Video Artifacts
                      │ & Progress Updates                         │ (Direct S3 SDK)
                      ▼                                            │
       ┌───────────────────────────────────────────────────────────┴─────────────┐
       │                 Background Video Processing Worker Daemon               │
       │                          (`worker/worker.mjs`)                          │
       │                                                                         │
       │   1. Media Ingestion: `yt-dlp` (SSRF Guarded) or Direct R2 Stream       │
       │   2. Media Probe: `ffprobe` Duration Extraction & Plan Validation       │
       │   3. Audio Extraction: `ffmpeg` 64kbps mono MP3 extraction              │
       │   4. Speech Transcription: Groq Whisper Large-v3 ──► Local Whisper      │
       │   5. Moment Scoring: NVIDIA NIM ──► Groq LLaMA ──► OpenAI ──► Heuristic │
       │   6. Video Framing: InsightFace Facial Tracker (Python OpenCV)          │
       │   7. Subtitle Engine: ASS Kinetic Karaoke Typography (18 presets)       │
       │   8. Video Rendering: FFmpeg Filter Complex (Scale, Pad, Subtitles)     │
       └─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Processing Request Lifecycle

### Phase 1: Ingestion & Safety Verification
1. **User Submission**: The client submits a project creation request via `POST /api/projects` providing either a YouTube URL or requesting a presigned direct upload URL via `GET /api/projects/upload-url`.
2. **SSRF Guard**: External URLs are validated using `src/lib/ssrf.ts` to ensure:
   - Protocol is strictly `http:` or `https:`.
   - Hostname resolves via DNS strictly to public IP addresses (private RFC 1918, loopback 127.0.0.0/8, link-local 169.254.0.0/16, and cloud metadata 169.254.169.254 IPs are rejected with HTTP 400).
3. **Credit Reservation**: Initial credit sufficiency is validated against `User.credits`.

### Phase 2: Asynchronous Job Enqueueing
1. Next.js creates a `Project` and enqueues a `ProcessingJob` record in PostgreSQL with status `QUEUED`.
2. HTTP 201 is returned to the client immediately. The client begins polling `GET /api/projects/[id]` for real-time progress percentages.

### Phase 3: Worker Claim & Execution Loop (`worker/worker.mjs`)
1. **Atomic Claim**: The worker runs a continuous polling loop (`loop()`). It executes an atomic database transaction using `claimNextJob()` with PostgreSQL row locks to claim the next pending job without concurrency races.
2. **Download & Probe**:
   - `download()`: Ingests the media via `yt-dlp` with automated cookie rotation and proxy fallback (`worker/proxy-pool.mjs`).
   - `probeDuration()`: Runs `ffprobe` to verify media duration against user plan limits (`planMaxMinutes`). Violations fail early before incurring AI compute expenses.
3. **Audio Extraction**: Extracts a 64k mono MP3 file (`extractAudio()`).
4. **Speech-to-Text Transcription**:
   - **Primary**: `transcribeGroq()` sends audio to Groq Whisper Large-v3 Turbo API returning word-level millisecond timestamps.
   - **Fallback**: If Groq experiences rate limits (429) or timeouts, it automatically falls back to `transcribeLocal()` via local CPU/GPU `faster-whisper`.
5. **Viral Moment Detection & AI Scoring**:
   - `generateCandidateMoments()` creates prospective video segments based on speech pauses, sentence density, and target clip length.
   - Candidates are scored using the **AI Resilience Fallback Chain**:
     1. **Tier 1 (Flagship)**: NVIDIA NIM (`nvidia/nemotron-3-ultra-550b-a55b`).
     2. **Tier 2 (Fast AI)**: Groq (`openai/gpt-oss-120b` or `qwen/qwen3.8-27b`).
     3. **Tier 3 (Commercial Backup)**: OpenAI API (`gpt-4o-mini`).
     4. **Tier 4 (Offline Rule-Based)**: `heuristicScoreMoments()` based on emotional words, exclamation frequency, and acoustic laughter/dB peak detection.
6. **Facial Tracking & Framing**:
   - Runs `faceTrack()` using InsightFace and OpenCV to compute bounding boxes and frame center coordinates for speakers throughout the candidate duration.
7. **Subtitle Synthesis & Typography**:
   - Compiles word-level timestamps into ASS subtitle scripts with highlight animations (`worker/caption-styles.mjs`).
8. **FFmpeg Rendering**:
   - Crops raw footage to 9:16 portrait ratio centering on tracked faces, synchronizes audio PTS, and burns ASS subtitles into the video.
9. **Cloudflare R2 Upload**:
   - Uploads completed MP4 clips and cover thumbnails to Cloudflare R2 via `@aws-sdk/client-s3`.
10. **Settlement**:
    - Marks `ProcessingJob` as `COMPLETED`.
    - Atomically updates `Project` clips and deducts credits via `CreditTransaction`.

---

## 3. Third-Party Integrations

| Provider | Purpose | Authentication | Failure Behavior |
| :--- | :--- | :--- | :--- |
| **Cloudflare R2** | Video asset storage (source footage, rendered clips, subtitle files) | S3 API Credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) | Retry upload with exponential backoff; surface error on terminal fail. |
| **Paddle Billing** | Primary Merchant of Record (Subscriptions, global tax/VAT, credit packs) | Paddle API Key (`PADDLE_API_KEY`) + Webhook secret verification | Disables checkout modal gracefully if keys absent; fails closed on bad signature. |
| **Stripe** | Secondary payment gateway | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Webhook signature checked; defaults to safe mock keys in dev/test. |
| **Whop** | Digital marketplace & creator bounties | `WHOP_API_KEY` + `WHOP_WEBHOOK_SECRET` | Standard Webhooks v1 signature validation; returns 503 if secret missing. |
| **Groq Cloud** | High-speed Whisper transcription & LLaMA moment ranking | `GROQ_API_KEY` | Auto-failover to Local Whisper (speech) or NVIDIA/OpenAI (LLM). |
| **NVIDIA NIM** | Tier-1 ultra-scale moment scoring | `NVIDIA_NIM_API_KEY` | Seamless fallthrough to Groq / OpenAI. |
| **OpenAI** | Tier-3 fallback LLM scoring | `OPENAI_API_KEY` | Fallthrough to heuristic rule engine. |
| **Resend** | Transactional emails (Email verification, password reset, receipts) | `RESEND_API_KEY` | In dev without key, logs preview links directly to console without error. |
| **Upstash Redis** | Distributed token-bucket rate limiting | `UPSTASH_REDIS_REST_URL`, `TOKEN` | In-memory token bucket fallback automatically activates if Redis offline. |

---

## 4. Security Architecture

1. **Fail-Closed Webhooks**: All payment webhooks (Paddle, Stripe, Whop) reject unsigned or improperly signed requests with HTTP 400. Missing webhook secrets return HTTP 500/503 without executing database mutations.
2. **Hashed Developer API Keys**: API keys created via `/api/user/api-keys` are hashed with SHA-256 before storage in PostgreSQL (`hashedKey`). Plaintext keys are shown only once at generation time.
3. **SSRF Guard**: Every remote video URL fetched by worker or server actions is checked against private IP ranges using strict DNS pre-resolution.
4. **Token Encryption at Rest**: Social OAuth publishing tokens (YouTube, TikTok, Instagram) are encrypted using AES-256-GCM (`ENCRYPTION_SECRET`).
5. **Device Binding & Multi-Account Prevention**: Hardware fingerprints generated via WebGL/Canvas hashes prevent promotional credit abuse.


---

## 5. Design Tokens & UI Architecture

### 5.1 Color Tokens & Palette
- **Surfaces**: `--onyx` (`#050505` canvas background), `--onyx-2` (`#0a0a0a` elevated cards/sidebars), `--surface` (`rgba(255, 255, 255, 0.04)` card overlay).
- **Ink / Typography**: `--pearl` (`#ffffff`, 21:1 AAA contrast), `--mist` (`rgba(255, 255, 255, 0.75)`, 12.4:1 AAA), `--mist-2` (`rgba(255, 255, 255, 0.58)`, 5.3:1 AA compliant).
- **Forge Orange Brand Accents**: `--gold` (`#ff5a1f` primary action), `--gold-2` (`#e8430a` hover/gradient endpoint), `--champagne` (`#ff7a3d` focus ring / links), `--emerald-soft` (`rgba(255, 90, 31, 0.25)` ambient glow).
- **Hairlines**: `--hair` (`rgba(255, 255, 255, 0.08)` border), `--hair-soft` (`rgba(255, 255, 255, 0.05)` divider).

### 5.2 Typography & Radii
- **Fonts**: Display font `Manrope`, body font `Inter`.
- **Corner Radii**: `--radius-sm` (`10px`), `--radius` (`18px` cards/video containers), `--radius-lg` (`28px`), `pill` (`9999px`).
- **Glassmorphism**: `.glass-card` uses `backdrop-filter: blur(20px)`, `border: 1px solid var(--hair)`, and `background: linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))`.
- **Accessibility**: All interactive elements support WCAG 2.1 AA with `:focus-visible` styling (`outline: 2px solid var(--champagne)`).
