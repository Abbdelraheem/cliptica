# Clipzila — AI Video Clipping & Repurposing Platform

Clipzila is a production-grade SaaS application that transforms long-form videos (YouTube URLs or raw video uploads) into viral 9:16 vertical short clips. The platform automates audio transcription via Groq Whisper, ranks candidate hooks using multimodal LLM scoring, reframes footage to vertical with InsightFace speaker tracking, and burns synchronized karaoke captions across 18 creator styling presets.

---

## 1. System Architecture

```
Browser (Next.js 15) ──► PostgreSQL (Prisma) + Cloudflare R2 (Presigned Uploads)
                                │
                                │ ProcessingJob (QUEUED)
                                ▼
Worker Process (`worker/worker.mjs` via PM2 / Docker)
  ├── 1. Media Fetch: yt-dlp (SSRF-guarded, proxy rotation) or direct R2 download
  ├── 2. Length Validation: ffprobe duration check against user subscription tier
  ├── 3. Audio Extraction: ffmpeg 64k mono MP3 extraction
  ├── 4. Speech Recognition: Groq Whisper Large-v3 ──► Local faster-whisper fallback
  ├── 5. Viral Moment Scoring: NVIDIA NIM ──► Groq LLaMA ──► OpenAI ──► Heuristics
  ├── 6. Video Reframing: InsightFace Python tracker for dominant speaker centering
  ├── 7. Karaoke Subtitles: ASS subtitle generator with word-level highlight animation
  ├── 8. Final Render: FFmpeg filter complex (9:16 crop, scale, subtitle burn-in)
  └── 9. Delivery: Direct upload to Cloudflare R2 + atomic credit deduction
```

---

## 2. Tech Stack

- **Framework**: Next.js 15 (App Router, React 19, Server Actions, Route Handlers)
- **Database & ORM**: PostgreSQL via Prisma ORM 6 (connection pooling, atomic transactions)
- **Authentication**: NextAuth.js v4 (bcrypt password hashing, Google OAuth 2.0, device fingerprinting)
- **Styling**: Tailwind CSS v4, Lucide React, Manrope (display font), Inter (body font)
- **Worker Pipeline**: Node.js ESM (`worker/worker.mjs`), FFmpeg 6+, `yt-dlp`, Python 3 + InsightFace
- **Cloud Storage**: Cloudflare R2 (S3 API compatible)
- **Billing Providers**: Paddle Billing (Primary Merchant of Record), Stripe, and Whop
- **AI Infrastructure**: Groq Cloud (Whisper Large-v3, LLaMA), NVIDIA NIM, OpenAI
- **Email Delivery**: Resend SDK (`resend`) with React Email templates

---

## 3. Local Development Setup (<10 Commands)

Get Clipzila running locally in under 5 minutes:

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/Abbdelraheem/cliptica.git
cd cliptica
npm install

# 2. Configure environment variables (see .env.example)
cp .env.example .env.local

# 3. Generate Prisma client & push schema to local Postgres
npx prisma generate
npx prisma db push

# 4. Start Next.js development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open the application.

> **Environment Variables**: See [.env.example](file:///.env.example) for a comprehensive list of all required and optional configuration keys with inline documentation.

---

## 4. Running Tests & Quality Checks

Clipzila maintains a 100% passing test suite across all billing, security, and rendering modules:

```bash
# Run unit & integration test suite (Vitest)
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint validation
npm run lint

# Production build check
npm run build
```

---

## 5. How the Background Worker Operates

The video processing pipeline (`worker/worker.mjs`) is intentionally decoupled from Next.js web requests to ensure zero serverless timeout restrictions:

1. **Queueing**: The `ProcessingJob` PostgreSQL table serves as the queue. Workers claim jobs atomically via conditional row updates (`claimNextJob()`). Multiple worker instances can run in parallel without race conditions.
2. **Fail-Fast Safety**: Raw media duration is checked immediately via `ffprobe` before any costly AI API requests are triggered.
3. **Resilience**: The scoring engine employs a 4-tier fallback chain (NVIDIA NIM ──► Groq ──► OpenAI ──► Offline Heuristics). If an external API is degraded, the job falls back seamlessly without failing.
4. **Local Worker Execution**:
   ```bash
   cd worker
   npm install
   node worker.mjs
   ```

---

## 6. Production Deployment

### Option A: Ubuntu VPS with PM2 (Current Production Setup)
Clipzila is currently provisioned on Ubuntu using PM2 for process management:
```bash
# 1. Install system binaries
sudo apt-get install ffmpeg python3-pip
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# 2. Start web & worker via PM2 ecosystem
pm2 start deploy/pm2.ecosystem.config.cjs
pm2 save
```

### Option B: Docker Container
A multi-stage [Dockerfile](file:///Dockerfile) is provided at the repository root, packaging Node 20, Python 3, FFmpeg, and InsightFace dependencies for containerized deployments (AWS ECS, Google Cloud Run, or Kubernetes).

---

## 7. Operational Documentation

- **System Architecture**: [docs/ARCHITECTURE.md](file:///docs/ARCHITECTURE.md)
- **Production Operations Runbook**: [docs/OPERATIONS.md](file:///docs/OPERATIONS.md)
- **Billing Providers & Plan Mappings**: [docs/BILLING.md](file:///docs/BILLING.md)
- **Known Issues & Triage**: [docs/KNOWN_ISSUES.md](file:///docs/KNOWN_ISSUES.md)
- **Technical Buyer Handover Package**: [HANDOVER.md](file:///HANDOVER.md)

---

## 8. License

Proprietary and confidential commercial software. See [LICENSE](file:///LICENSE) for details.
