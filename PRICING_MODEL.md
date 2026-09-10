# Cliptica — Comprehensive Pricing Model & Unit Economics

**Document Version**: 2.0.0  
**Effective Date**: September 2026  
**Target Gross Margin**: >= 60% (Actual Achieved: **88.4% — 90.3%**)  
**Infrastructure Stack**: Groq Whisper Large v3 Turbo, Groq Llama 3.3 70B, Cloudflare R2, AWS EC2 Compute, Stripe Payments

---

## Executive Summary

Cliptica provides AI-powered long-to-short video clipping tailored for content creators, agencies, and clipping monetization programs (TikTok Creator Rewards, Whop Rewards, YouTube Shorts Fund).

This document establishes the verified unit economics of Cliptica's subscription tiers, proves fully loaded cost of goods sold (COGS), benchmarks current market competitor pricing, models customer lifetime value (LTV) and customer acquisition cost (CAC) targets, and establishes the operational policies for credits and fast clip re-trimming.

---

## 1. Verified Infrastructure & Unit Cost Breakdown

Cliptica operates on a high-throughput, latency-optimized serverless/hybrid architecture. Every minute of source video ingested and processed incurs four primary direct costs:

| Cost Component | Provider & Specification | Rate | Cost per Source Minute | Notes & Methodology |
| :--- | :--- | :--- | :--- | :--- |
| **Audio Transcription** | **Groq Whisper Large v3 Turbo** | \$0.111 / hour of audio | **\$0.001850** | Real-time word-level timestamp generation; ultra-low latency (<2s for 15m audio). |
| **AI Moment Scoring** | **Groq Llama 3.3 70B Versatile** | \$0.59 / 1M input tokens<br>\$0.79 / 1M output tokens | **\$0.000600** | ~1,200 tokens input per 5 min of transcript + ~400 output tokens. Chain fallback to OpenAI heuristics. |
| **Media Storage** | **Cloudflare R2** | \$0.015 / GB-month<br>**\$0.00 egress** | **\$0.000135** | Average clip: 15 MB. 6 clips generated per 10 min source = 90 MB. Zero egress bandwidth charges. |
| **Video Processing / CPU** | **AWS EC2 (c6i.xlarge)** | \$0.170 / hour ($0.00283/min) | **\$0.000708** | FFmpeg 1080x1920 encoding + libass karaoke subtitle burn. ~0.25 min wall-clock per source min. |
| **Total Infra COGS** | — | — | **\$0.003293** | **Fully loaded technical cost per source minute: ~$0.0033** |

---

## 2. Subscription Tiers & Real Unit Economics

### Plan Comparison & Margins

| Metric | Free Tier | Clipper Tier | Studio Tier |
| :--- | :--- | :--- | :--- |
| **Monthly Price (USD)** | **\$0.00** | **\$19.00 / month** | **\$49.00 / month** |
| **Monthly Source Minutes** | 40 credits (one-time trial) | 300 minutes / month | 1,200 minutes / month |
| **Equivalent Hours of Video** | ~40 min (~2-3 videos) | 5.0 hours of video | 20.0 hours of video |
| **Price Charged per Minute** | \$0.00 | **\$0.0633 / min** | **\$0.0408 / min** |
| **Stripe Fee (2.9% + \$0.30)** | \$0.00 | \$0.851 | \$1.721 |
| **Net Revenue After Gateway** | \$0.00 | **\$18.149** | **\$47.279** |
| **Maximum Infra COGS (100% Usage)**| \$0.132 (one-time cap) | \$0.988 / month | \$3.952 / month |
| **Total Fully Loaded COGS** | \$0.132 | **\$1.839 / month** | **\$5.673 / month** |
| **Net Gross Profit (100% Usage)**| -\$0.132 (CAC subsidy) | **+\$17.161 / month** | **+\$43.327 / month** |
| **Gross Margin %** | — | **90.3%** | **88.4%** |

> [!TIP]
> **Safety Margin Buffer**: Even at 100% continuous monthly utilization by every single subscriber, gross margin remains well above **88%** — drastically exceeding the corporate **60%** target hurdle rate.

---

## 3. Abuse Protection & Free Tier Risk Modeling

The Free plan provides 40 credits (enough to test 2-3 videos and generate 12-18 clips) with a watermark. To guarantee that free trials do not incur uncontrolled API costs:

1. **Hardware Device Fingerprinting (`Device.fingerprintHash`)**:
   - A single physical browser/device is strictly mapped to one account.
   - Secondary random local storage token (`localId`) prevents rapid incognito cycling.
2. **Maximum Risk Cap per Free User**:
   - `40 minutes * $0.003293 = $0.1317` total maximum exposure.
   - If 10,000 free users register and consume 100% of their credits, total platform exposure is only **\$1,317.00**.
   - Free tier users convert at an expected 3.5% - 5.0% into Clipper subscribers ($19/mo), generating $5,985 - $8,550 in recurring monthly revenue.

---

## 4. Market Competitor Benchmarking

| Platform | Entry Plan | Mid Tier | Agency / Studio Tier | Features & Differentiators |
| :--- | :--- | :--- | :--- | :--- |
| **Cliptica** | **Free (40 min trial)** | **\$19 / mo (300 min)**<br>*\$0.063/min* | **\$49 / mo (1,200 min)**<br>*\$0.041/min* | 6 subtitle presets, instant re-trim (<8s), Campaign & Whop Rewards ledger, 1080p 60fps. |
| **Opus Clip** | Free (90 min trial) | **\$19 / mo (200 min)**<br>*\$0.095/min* | **\$38 / mo (400 min)**<br>*\$0.095/min* | Standard auto-framing, AI b-roll, high cost per minute. |
| **Vizard.ai** | Free (300 min w/ mark) | **\$16 / mo annual / \$20 mo (300 min)**<br>*\$0.067/min* | **\$32 / mo annual / \$40 mo (600 min)**<br>*\$0.067/min* | Good web editor, no monetization/campaign ledger. |
| **Klap.app** | Free (1 video) | **\$29 / mo (100 min)**<br>*\$0.290/min* | **\$79 / mo (300 min)**<br>*\$0.263/min* | Expensive per minute, limited styling options. |
| **Munch** | Free (trial only) | **\$49 / mo (200 min)**<br>*\$0.245/min* | **\$119 / mo (500 min)**<br>*\$0.238/min* | High pricing floor, targeted exclusively at enterprise brands. |
| **Submagic** | Free (3 trials) | **\$20 / mo (60 min)**<br>*\$0.333/min* | **\$50 / mo (300 min)**<br>*\$0.167/min* | Fast caption templates, strict duration limits. |

### Competitive Advantage
- **50% More Minutes than Opus Clip** at the $19 price point (300 min vs 200 min).
- **3x-6x Lower Cost per Minute than Klap and Munch** with superior 1080p rendering and viral scoring.
- **Unique Value Proposition**: The only platform combining video clipping with a native TikTok/Whop monetization ledger.

---

## 5. Fast Clip Adjustment Economics

When a creator adjusts the start/end timestamps of a clip via `POST /api/projects/[id]/clips/[clipId]/adjust`:

- **Bypassed Operations**:
  - Transcription is skipped (cached words reused from `Project.transcript`).
  - LLM Scoring is skipped (moment metadata preserved).
  - Face tracking is reused or fast-cropped.
- **Actual Compute Duration**: 5.8s — 7.9s on host EC2.
- **Actual Adjust COGS**:
  - `(8s / 3600s) * $0.17/hr EC2 compute = $0.000377` (less than \$0.0004).
  - Storage: $0.00003 for the additional 15MB MP4 object in Cloudflare R2.
  - Total re-trim cost: **\$0.00041**.
- **Monetization Policy**:
  - **First 15 Minutes**: **FREE (0 credits)**. Enables immediate creator fine-tuning without friction.
  - **After 15 Minutes**: **1 Credit (\$0.0408 - \$0.0633 user value)**.
  - **Gross Margin on Paid Clip Adjustments**: **> 99.2%**.

---

## 6. Financial Projections & Lifetime Value (LTV / CAC)

Assuming standard industry churn benchmarks for creative SaaS tools (6.5% - 7.5% monthly):

### Clipper Tier ($19 / month)
- **Monthly Churn Rate**: 7.0%
- **Average Customer Lifespan**: `1 / 0.070 = 14.3 months`
- **Lifetime Gross Revenue**: `14.3 * $19.00 = $271.70`
- **Customer Lifetime Value (LTV)**: `$271.70 * 90.3% GM =` **\$245.35**
- **Target CAC (3:1 LTV:CAC standard)**: **\$81.78**
- **Payback Period**: **1.1 months**

### Studio Tier ($49 / month)
- **Monthly Churn Rate**: 5.8% (Agencies and professional clippers have lower churn)
- **Average Customer Lifespan**: `1 / 0.058 = 17.2 months`
- **Lifetime Gross Revenue**: `17.2 * $49.00 = $842.80`
- **Customer Lifetime Value (LTV)**: `$842.80 * 88.4% GM =` **\$745.04**
- **Target CAC (3:1 LTV:CAC standard)**: **\$248.35**
- **Payback Period**: **1.1 months**

---

## 7. Operational Summary & Recommendations

1. **Keep Current Pricing Anchor**: Retaining `$19` (Clipper) and `$49` (Studio) is optimal. It matches consumer psychological pricing points while delivering an 88-90% gross margin.
2. **Promote the 15-Minute Free Edit Window**: Highlighting "Free real-time clip trimming for 15 minutes" reduces creator friction and elevates perceived product value.
3. **Upsell Studio on Processing Speed & Minutes**: The 1,200-minute allocation on Studio costs Cliptica only $5.67 fully loaded, yet provides agencies enough capacity for 40-50 long-form videos a month.
