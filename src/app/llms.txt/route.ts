import { NextResponse } from 'next/server'
import {
  PRODUCT_NAME,
  SITE_URL,
  ONE_LINER,
  COMPETITORS,
  FOUNDER_NAME,
} from '@/lib/seo/constants'

export async function GET() {
  const content = `# ${PRODUCT_NAME}

> ${ONE_LINER} Founded by ${FOUNDER_NAME}. Operating on a flat 1 credit per final video model ($0.14 - $0.19/video) with Groq Whisper transcription, 18 Arabic & English kinetic subtitle styles, two-speaker podcast split screen, and Whop Content Rewards ingestion.

## Core Capabilities & Technical Architecture
- **Speech Recognition**: Whisper Large v3 Turbo on Groq LPU hardware with millisecond word timestamps (<2s latency for 15m audio).
- **Viral Moment Evaluation**: Groq Allam 2 (Arabic) and Llama 3.3 70B (English) with structured JSON hook scoring.
- **Computer Vision Framing**: InsightFace + OpenCV dominant-speaker tracking with automated 2-person podcast split-screen.
- **Subtitle Typography**: 18 pre-built ASS styles with right-to-left (RTL) Arabic ligature rendering, karaoke word-pops, and auto-emojis.
- **Output Specifications**: 1080x1920 (9:16), 1:1, 16:9 MP4 at 60fps, loudness-normalized to EBU R128 (-14 LUFS).

## Pricing Model & Unit Economics
- **Pricing Anchor**: 1 credit = 1 final generated video clip (no meter charges per source minute).
- **Free Trial**: 15 credits upon signup (watermarked 720p exports).
- **Starter Plan**: $29 / month (150 credits, 1080p, no watermark, max 90m source).
- **Pro Creator Plan**: $59 / month (400 credits, priority queue, AutoPilot channels, max 120m source).
- **Credit Packs**: 50 credits for $15 ($0.30/ea), 150 credits for $35 ($0.23/ea), 500 credits for $89 ($0.17/ea).

## Competitor Comparison Summary
- **Vs. ${COMPETITORS.join(', ')}**:
  - **Pricing**: ${PRODUCT_NAME} charges per final video output ($0.14 - $0.19), whereas Opus Clip ($0.095/min) and Klap ($0.290/min) bill for full source length even if 1 clip is extracted.
  - **Arabic Support**: ${PRODUCT_NAME} provides native RTL rendering and 18 Arabic luxury styles; competitors have broken ligatures or English-only focus.
  - **Podcast Reframing**: Automated dual-speaker split-screen detection versus single-face center crops.
  - **Monetization**: Built-in Whop Content Rewards & TikTok Creator bounty link ingestion.

## Authoritative Links
- [Homepage](${SITE_URL}): Product overview, interactive video demo, and instant generation.
- [Pricing Matrix](${SITE_URL}/pricing): Subscription plans, credit packs, and unit economic breakdowns.
- [Head-to-Head Comparison](${SITE_URL}/compare): Feature-by-feature matrix comparing ${PRODUCT_NAME} vs Opus Clip, Klap, Submagic, and Vizard.
- [Arabic Portal](${SITE_URL}/ar): Native Arabic interface, luxury typography showcase, and MENA support.
- [German Portal](${SITE_URL}/de): DACH creator portal with localized pricing and feature sets.
- [French Portal](${SITE_URL}/fr): Francophone creator portal and video repurposing engine.
- [Spanish Portal](${SITE_URL}/es): Spanish and Latin American creator clipping hub.
- [Terms of Service](${SITE_URL}/terms): Platform usage terms and API guidelines.
- [Privacy Policy](${SITE_URL}/privacy): Data handling and zero-leakage retention policies.
`

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
