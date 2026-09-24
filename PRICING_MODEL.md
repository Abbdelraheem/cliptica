# Cliptica — Comprehensive Pricing Model & Unit Economics

**Document Version**: 3.0.0  
**Effective Date**: September 2026  
**Target Gross Margin**: >= 60% (Actual Achieved: **94.4%**)  
**Infrastructure Stack**: Groq Whisper Large v3 Turbo, Groq Allam-2-7B / Llama 3.3 70B, Cloudflare R2, AWS EC2 Compute (c6i.xlarge), Stripe Payments

---

## Executive Summary

Cliptica provides AI-powered long-to-short video clipping tailored for content creators, agencies, and clipping monetization programs (TikTok Creator Rewards, Whop Rewards, YouTube Shorts Fund).

Pricing is anchored on a clear, user-centric principle: **"1 credit = 1 final video operation"**. Users know that 1 credit yields a complete, polished, reframed, karaoke-captioned short video ready for publication.

This document establishes the verified unit economics of Cliptica's live subscription tiers and credit packs, proves fully loaded cost of goods sold (COGS), models customer lifetime value (LTV) and customer acquisition cost (CAC) targets, and documents operational policies for credit reservations, settlement parity, plan duration limits, and AutoPilot circuit breakers.

---

## 1. Verified Infrastructure & Unit Cost Breakdown

Cliptica operates on a high-throughput, latency-optimized serverless/hybrid architecture. Every minute of source video ingested and processed incurs four primary direct costs:

| Cost Component | Provider & Specification | Rate | Cost per Source Minute | Notes & Methodology |
| :--- | :--- | :--- | :--- | :--- |
| **Audio Transcription** | **Groq Whisper Large v3 Turbo** | \$0.111 / hour of audio | **\$0.001850** | Real-time word-level timestamp generation; ultra-low latency (<2s for 15m audio). |
| **AI Moment Scoring** | **Groq Allam 2 7B / Llama 3.3 70B** | \$0.59 / 1M input tokens<br>\$0.79 / 1M output tokens | **\$0.000600** | ~1,200 tokens input per 5 min of transcript + ~400 output tokens. Chain fallback to OpenAI heuristics. |
| **Media Storage** | **Cloudflare R2** | \$0.015 / GB-month<br>**\$0.00 egress** | **\$0.000135** | Average clip: 15 MB. 3-6 clips generated per source. Zero egress bandwidth charges. |
| **Video Processing / CPU** | **AWS EC2 (c6i.xlarge)** | \$0.170 / hour ($0.00283/min) | **\$0.000708** | FFmpeg 1080x1920 encoding + libass karaoke subtitle burn. ~0.25 min wall-clock per source min. |
| **Total Infra COGS** | — | — | **\$0.003293** | **Fully loaded technical cost per source minute: ~$0.0033** |

---

## 2. Subscription Tiers & Real Unit Economics

### Plan Comparison & Margins

| Metric | Free Tier | Starter (Clipper) | Pro Creator (Studio) |
| :--- | :--- | :--- | :--- |
| **Monthly Price (USD)** | **\$0.00** | **\$29.00 / month** | **\$59.00 / month** |
| **Monthly Credits** | **15 credits** (signup grant) | **150 credits / month** | **400 credits / month** |
| **Price Charged per Credit** | \$0.00 | **\$0.1933 / credit** | **\$0.1475 / credit** |
| **Max Source Video Length** | **20 minutes** | **90 minutes** | **120 minutes** |
| **Daily Project Limit** | 3 videos / day | 50 videos / day | 200 videos / day |
| **Export Quality** | 720p (with watermark) | 1080p (no watermark) | 1080p high-bitrate (no watermark) |
| **Stripe Fee (2.9% + \$0.30)** | \$0.00 | **\$1.141** | **\$2.011** |
| **Net Revenue After Gateway** | \$0.00 | **\$27.859** | **\$56.989** |
| **Maximum Infra COGS (100% Usage)**| \$0.0494 (one-time cap) | \$0.494 / month | \$1.317 / month |
| **Total Fully Loaded COGS** | \$0.0494 | **\$1.635 / month** | **\$3.328 / month** |
| **Net Gross Profit (100% Usage)**| -\$0.0494 (CAC subsidy) | **+\$27.365 / month** | **+\$55.672 / month** |
| **Gross Margin %** | — | **94.4%** | **94.4%** |

> [!TIP]
> **Exceptional Safety Margin**: Even assuming 100% monthly utilization across all subscriber accounts, gross margin remains firmly at **94.4%** — dramatically exceeding the corporate **60%** target hurdle rate.

---

## 3. One-Time Credit Packs

For creators and agencies with bursty workloads or who need additional credits without changing their subscription tier:

| Pack ID | Pack Name | Credits | Price (USD) | Price per Credit | Target Audience |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **pack_50** | **50 Credits** | 50 | **\$15.00** | \$0.30 | Quick testing, occasional projects |
| **pack_150** | **150 Credits** | 150 | **\$35.00** | \$0.23 | Active weekly creators (Most Popular) |
| **pack_500** | **500 Credits** | 500 | **\$89.00** | \$0.17 | High-volume clipping & agencies (Best Value) |

### Credit Pack Economics
- **pack_50**: Revenue $15.00, Stripe fee $0.735, Infra COGS ~$0.165, Net profit: **$14.10 (94.0% margin)**.
- **pack_150**: Revenue $35.00, Stripe fee $1.315, Infra COGS ~$0.494, Net profit: **$33.19 (94.8% margin)**.
- **pack_500**: Revenue $89.00, Stripe fee $2.881, Infra COGS ~$1.647, Net profit: **$84.47 (94.9% margin)**.

---

## 4. Abuse Protection & Platform Guardrails

To prevent financial exposure and infrastructure overload:

1. **Hardware Device Fingerprinting (`Device.fingerprintHash`)**:
   - A single physical browser/device is strictly mapped to one free credit grant.
   - Secondary random local storage token (`localId`) prevents rapid incognito cycling.
2. **Free Tier Lifetime Exposure Cap**:
   - `15 credits * $0.003293 = $0.0494` maximum theoretical infra cost per free user.
   - Even if 20,000 free trial accounts sign up and consume all 15 credits, total company cost is under **\$1,000.00**.
   - With an expected 3.5% - 5.0% conversion rate into Starter ($29/mo), 20,000 free users yield **\$20,300 - \$29,000 in monthly recurring revenue**.
3. **Plan Duration Caps & Hard Platform Ceiling**:
   - Free tier: 20 minutes max source duration.
   - Starter tier: 90 minutes max source duration.
   - Pro Creator tier: 120 minutes max source duration.
   - Absolute platform hard ceiling: **180 minutes** (`MAX_SOURCE_MINUTES = 180`).
   - Enforced pre-download via `probeUrlDuration` and post-download via `probeDuration`.
4. **AutoPilot Channel Watcher Circuit Breakers**:
   - Per-user daily creation limit: 10 projects/day (`AUTOPILOT_MAX_DAILY_PROJECTS`).
   - Pre-download duration check skips oversized videos (e.g. 5-hour podcasts/streams) without charging credits.
   - Interactive Pause/Resume controls in dashboard allow instant user management.

---

## 5. Credit Reservation & Settlement Parity

- **Reservation**: At project creation (`POST /api/projects`), exactly **1 credit** is reserved from the user's balance and recorded as `creditsUsed = 1`.
- **Settlement**: Upon successful rendering and R2 upload (`worker.mjs`), `creditsSpent = 1`. Because `alreadyPaid = 1`, `diff = 0`.
  - **Zero drift**: No automatic refund desync occurs.
- **Failure Safe**: If a job fails during download, transcription, or rendering, the full upfront reserved credit is automatically and idempotently refunded to the user's balance with an audit transaction log.

---

## 6. Fast Clip Adjustment Economics

When a creator adjusts the start/end timestamps of an existing clip via `POST /api/projects/[id]/clips/[clipId]/adjust`:

- **Bypassed Operations**:
  - Audio transcription is skipped (cached words reused from `Project.transcript`).
  - LLM Scoring is skipped (moment metadata preserved).
  - Source video is read from local EC2 cache (`tmpdir/nology-sources/{id}.mp4`).
- **Actual Compute Duration**: 5.8s — 7.9s on host EC2.
- **Adjust COGS**:
  - EC2 encoding: `(8s / 3600s) * $0.17/hr = $0.000377`.
  - Storage: $0.00003 for the 15MB MP4 object in Cloudflare R2.
  - Total adjust cost: **\$0.00041**.
- **Monetization Policy**:
  - **First 15 Minutes**: **FREE (0 credits)**. Enables immediate creator fine-tuning without friction.
  - **After 15 Minutes**: **1 Credit (\$0.1475 - \$0.1933 user value)**.
  - **Gross Margin on Paid Clip Adjustments**: **> 99.7%**.

---

## 7. Financial Projections & Lifetime Value (LTV / CAC)

Assuming standard industry churn benchmarks for creative SaaS tools (6.0% - 7.0% monthly):

### Starter Tier ($29 / month)
- **Monthly Churn Rate**: 7.0%
- **Average Customer Lifespan**: `1 / 0.070 = 14.3 months`
- **Lifetime Gross Revenue**: `14.3 * $29.00 = $414.70`
- **Customer Lifetime Value (LTV)**: `$414.70 * 94.4% GM =` **\$391.48**
- **Target CAC (3:1 LTV:CAC standard)**: **\$130.49**
- **Payback Period**: **1.05 months**

### Pro Creator Tier ($59 / month)
- **Monthly Churn Rate**: 5.8%
- **Average Customer Lifespan**: `1 / 0.058 = 17.2 months`
- **Lifetime Gross Revenue**: `17.2 * $59.00 = $1,014.80`
- **Customer Lifetime Value (LTV)**: `$1,014.80 * 94.4% GM =` **\$957.97**
- **Target CAC (3:1 LTV:CAC standard)**: **\$319.32**
- **Payback Period**: **1.06 months**

---

## 8. Storage-Efficient Video Delivery Architecture & R2 Unit Economics

To dramatically minimize Cloudflare R2 object storage costs while maintaining pristine broadcast quality for final exports:

### Two-Tier Video Encoding Specification
1. **Preview Tier (Default Generation)**:
   - **Video**: `libx264`, preset `superfast`, CRF `28`, maxrate `1500k`, bufsize `3000k`
   - **Audio**: `aac`, bitrate `96k`
   - **Bitrate**: ~1.3 Mbps
   - **Average File Size (40s clip)**: **~6.5 MB** (vs previous ~16.0 MB)
   - **Storage Savings**: **59.4% reduction** in upfront Cloudflare R2 storage footprint.
   - **User Benefit**: Instant browser video loading and playback responsiveness without buffering.

2. **Download HD Master Tier (On-Demand Generation)**:
   - **Video**: `libx264`, preset `fast`, CRF `20`
   - **Audio**: `aac`, bitrate `192k`
   - **Bitrate**: ~3.2 - 4.0 Mbps
   - **Generation**: Triggered on-demand via `GET /api/projects/[id]/clips/[clipId]/download` and background worker `clip_render_hd`.
   - **Target Audience**: Exported directly for platform posting (TikTok, Instagram Reels, YouTube Shorts).

### Automated HD Retention Lifecycle Policy
- Configurable window: `HD_RETENTION_DAYS` (default: 30 days).
- Background worker daemon (`cleanExpiredHdClips`) automatically purges expired HD files from Cloudflare R2, leaving lightweight preview clips intact.
- Long-term storage cost reduction: **> 70%** for inactive older projects.

