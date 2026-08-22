# Cliptica — AI Video Clipping Platform

A production-ready platform that turns long videos into ready-to-post short clips with AI-powered editing, captions, motion graphics, and campaign earnings tracking.

## Features

### 🎬 AI Auto Editor
- One-click full edit: cinematic color grading, animated motion graphics, B-roll cutaways, sound design
- Word-perfect captions with 15 styles previewed live
- Speaker-locked 9:16 reframe with face tracking
- Story-paced cuts, zoom punch-ins, automatic B-roll

### 📊 Smart Clipping
- AI reviews entire video, ranks every potential moment
- Viral scores with hook/retention/share breakdown
- Brief-aware clipping targeting specific moments
- Only the clips worth posting reach your grid

### 💰 Campaign Ledger
- Track Whop Content Rewards, brand deals, own channels
- P&L chart with pending/approved/paid stacking
- Calendar heatmap for posting cadence
- CSV export for accounting

### ⚡ 20× Faster Throughput
- 8 hours by hand → 20 minutes with Cliptica
- Paste link → AI finds, cuts, reframes, captions, scores
- Review & post in one sitting

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 (Credentials + OAuth)
- **Payments**: Stripe (Subscriptions + Webhooks)
- **State**: TanStack Query + Zustand
- **UI**: Radix UI + Custom Components
- **Video**: Remotion + FFmpeg (Worker)

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Stripe account (for billing)

### Installation

```bash
# Clone and install
cd cliptica
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Set up database
npx prisma migrate dev
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/cliptica"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_CLIPPER_MONTHLY="price_..."
STRIPE_PRICE_STUDIO_MONTHLY="price_..."

# Video Processing
VIDEO_WORKER_URL="https://your-worker.modal.run"
VIDEO_WORKER_API_KEY="..."
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login, Register pages
│   ├── (dashboard)/      # Protected dashboard routes
│   │   ├── dashboard/    # Main dashboard
│   │   ├── projects/     # Project management
│   │   ├── campaigns/    # Campaign tracking
│   │   ├── earnings/     # P&L, payouts, calendar
│   │   ├── billing/      # Subscription management
│   │   └── settings/     # User settings
│   ├── (marketing)/      # Landing page
│   └── api/              # API routes
├── components/
│   ├── ui/               # Base UI components
│   ├── dashboard-*.tsx   # Dashboard layout components
│   └── marketing-*.tsx   # Marketing layout components
├── lib/
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── stripe.ts         # Stripe configuration
│   └── utils.ts          # Utility functions
└── types/                # TypeScript types
```

## Database Schema

Key models:
- **User**: Auth, credits, subscription, role
- **Project**: Video uploads, processing status
- **Clip**: Generated clips with viral scores
- **Campaign**: Whop/brand/own channel tracking
- **Payout**: Pending/approved/paid earnings
- **CreditTransaction**: Credit ledger

## Video Processing Pipeline

The platform uses a hybrid approach:
1. **Client**: Fast preview, trim, caption editing
2. **Serverless Workers**: Heavy FFmpeg rendering, AI processing
3. **Queue**: Redis/BullMQ for job management

Worker endpoints (deploy separately):
- `POST /api/worker/transcribe` - Whisper transcription
- `POST /api/worker/analyze` - Moment detection/scoring
- `POST /api/worker/render` - Remotion + FFmpeg render

## Deployment

### Vercel (Frontend)
```bash
npm run build
vercel deploy
```

### Worker Infrastructure
- **Modal/RunPod/Replicate** for GPU workers
- **Redis** for queue (Upstash/Vercel KV)
- **S3/R2** for video storage (UploadThing)

## Pricing

| Plan | Credits/mo | Max Video | Resolution | Price |
|------|-----------|-----------|------------|-------|
| Free | 40 (one-time) | 20 min | 720p + watermark | $0 |
| Clipper | 300 | 90 min | 1080p 60fps | $19/mo |
| Studio | 1,200 | 180 min | 1080p 60fps + priority | $49/mo |

1 credit ≈ 1 minute of source footage. AI auto-edit = 5 credits flat.

## Development

```bash
# Run dev server
npm run dev

# Run linting
npm run lint

# Type check
npm run typecheck

# Database commands
npx prisma studio
npx prisma migrate dev
npx prisma db push
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a PR

## License

MIT License - see LICENSE file for details.