# Cliptica vs. Opus Clip & Vizard.ai — Competitive Gap Analysis

> Systematic benchmark of Cliptica (NOLOGY) against industry category leaders Opus Clip, Vizard.ai, and CapCut.

---

## 1. Executive Summary

Cliptica provides a complete end-to-end AI video clipping platform: high-performance YouTube & file ingestion with residential proxy fallback, Groq Whisper Large v3 transcript-driven moment detection, face-tracking reframing (`buffalo_l` InsightFace), modular ASS caption styling (6 distinct presets), in-product timestamp trim adjustment with fast re-render (<8s), and native TikTok/Whop Rewards campaign earnings tracking.

Through systematic engineering cycles, Cliptica has closed its two most consequential product gaps (caption presets & fast in-product clip trim adjustment) and verified its unit economics, securing an **88.4% — 90.3% gross margin** while offering creators 50% more video minutes than Opus Clip at the same $19 price point.

---

## 2. Competitive Feature Matrix (Updated Post-Gap Closure)

| Feature Dimension | Cliptica (Current State) | Opus Clip (Leader) | Vizard.ai (Challenger) | Gap Status |
|---|---|---|---|---|
| **1. AI Moment Selection & Virality Scoring** | Groq LLaMA 3.3-70B + Hook Scoring, reasons, and viral tier badges (90%+ VIRAL, 75%+ HIGH). | Multimodal scoring with 4 sub-scores (Hook, Flow, Value, Call-to-Action). | AI highlighting with topic categorization. | **CLOSED / PARITY** |
| **2. Social Quick-Post Kit (Hashtags + Copy)** | 1-click Social Kit clipboard copy with viral title, AI hook, and targeted hashtags. | Full social title, caption, hashtags for TikTok, IG Reels, YT Shorts. | AI caption generator with hashtags. | **CLOSED / PARITY** |
| **3. Face-Tracking & Dynamic Reframing** | InsightFace `buffalo_l` dominant speaker tracking (`sendcmd` crop) + center, blur, and letter modes. | Active speaker switching, split-screen dialogue layout. | Auto-reframe with single speaker focus and screen-share layout. | **HIGH PARITY** |
| **4. Caption Styling & Templates** | **6 Production Presets**: Hormozi Pop, Clean Minimal, Neon Highlight, Bold Impact, Classic Subtitle, Highlighter Marker with visual picker. | 15+ caption presets with manual styling customization. | 10+ caption templates with auto-emojis. | **CLOSED (6 Core Styles Shipped)** |
| **5. In-Browser Clip Trimming & Fast Editor** | **Fast Trim Adjustment (<8s Re-render)**: Start/End nudge controls (±1s, ±5s), caption preset switcher, cached transcript/face reuse, free within 15m. | Interactive timeline trimmer with manual word-level boundary editing. | Full text-based video editor (cut video by deleting words). | **CLOSED (Fast Path Shipped)** |
| **6. Multi-Aspect Ratio Export** | Fixed 9:16 vertical (1080x1920) format optimized for Shorts/Reels/TikTok. | 9:16, 1:1, 16:9. | 9:16, 1:1, 16:9, 4:5. | **MEDIUM (Planned)** |
| **7. Campaign Hub & Creator Rewards Ledger** | **Native Feature**: Track Whop rewards, brand deals, client views, and calculated payouts directly linked to clips. | None. Third-party or manual spreadsheet tracking required. | None. | **CLIPTICA EXCLUSIVE ADVANTAGE** |
| **8. Real Unit Cost & Margin** | **COGS: \$0.0033/min**; Gross Margin: **88.4% — 90.3%**. 300 min for $19 / 1,200 min for $49. | ~$0.095/min; 200 min for $19. | ~$0.067/min; 300 min for $20. | **CLIPTICA COST & CAPACITY ADVANTAGE** |

---

## 3. Detailed Gap Closure Summary

### Gap 1: Modular Caption Styles Engine
- **Shipped**: `worker/caption-styles.mjs` with 6 distinct ASS preset generators (`hormozi`, `clean_minimal`, `neon_highlight`, `bold_impact`, `classic_subtitle`, `highlighter`).
- **Sanitization**: Added ASS tag injection stripping, UTF-8 bidirectional/Arabic handling, emoji rendering, and word timing interpolation.
- **UI Integration**: Visual preset picker with real-time style badges on project creation (`/dashboard/projects/new`).
- **Verification**: 45 unit tests passing; live FFmpeg libass renders on EC2 host passed at 1080x1920 (474ms–493ms per clip).

### Gap 2: Fast In-Product Clip Trim Adjustment
- **Shipped**: `POST /api/projects/[id]/clips/[clipId]/adjust` with validation, boundary checks, and credit policies.
- **Lightweight Worker Pipeline**: Bypasses Whisper transcription and LLM scoring entirely by reusing cached `Project.transcript` and local cached source media.
- **Performance**: Verified on production EC2 host — trims and re-renders full 1080x1920 video with burned-in subtitles in **7.9 seconds** (exceeding <20s SLA).
- **Creator UX**: Inline collapsible editor on clip detail cards with `±1s` and `±5s` nudge buttons, duration badge, preset switcher, and live progress indicators.
- **Credit Policy**: Free for 15 minutes post-creation; 1 credit thereafter with automatic refund on failure.

### Gap 3: Verified Pricing & Unit Economics
- **Shipped**: `PRICING_MODEL.md` and unit tests in `tests/pricing-model.test.ts`.
- **Unit Economics**: Proved fully loaded technical cost of **$0.003293 per minute**.
- **Margins**: Clipper ($19/mo, 300 min) delivers **90.3% gross margin**; Studio ($49/mo, 1,200 min) delivers **88.4% gross margin** after all Stripe fees and infrastructure.
- **Free Tier Safety**: Lifetime maximum exposure per free user strictly capped at **$0.1317**, protected by 1-device-1-account hardware fingerprinting.
