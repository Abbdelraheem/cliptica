import { MessageCatalog } from '../types'

export const en: MessageCatalog = {
  locale: 'en',
  dir: 'ltr',
  meta: {
    title: 'Cliptica — One video in. A week of viral clips out.',
    description:
      'Cliptica is an AI video clipping platform that turns long YouTube videos and podcasts into viral short-form clips with automated Arabic and English karaoke captions, speaker face tracking, and viral moment scoring.',
    oneLiner:
      'Cliptica is an AI-powered video clipping platform that turns long YouTube videos and podcasts into viral short-form clips with automated Arabic and English karaoke captions, speaker face tracking, and viral moment scoring.',
  },
  nav: {
    features: 'Features',
    pricing: 'Pricing',
    compare: 'Compare',
    login: 'Sign In',
    register: 'Get Started',
    dashboard: 'Dashboard',
  },
  hero: {
    badge: 'AI Video Repurposing Engine',
    h1: 'One video in. A week of viral clips out.',
    subtitle:
      'Paste any YouTube video or podcast. Cliptica automatically identifies high-retention hooks, reframes speakers with smart face-tracking, and burns kinetic karaoke captions in seconds.',
    ctaPrimary: 'Start Free Trial (15 Credits)',
    ctaSecondary: 'View Live Examples',
    inputPlaceholder: 'Paste YouTube video or podcast link...',
    generateButton: 'Generate Clips',
  },
  geoAnswer: {
    whatIsHeading: 'What is Cliptica and how does it work?',
    whatIsAnswer:
      'Cliptica is an AI-powered video repurposing SaaS that extracts viral short clips from long-form YouTube videos and podcasts. It transcribes speech using Whisper AI, scores hooks and shareability with LLMs, crops vertical 9:16 layouts with computer vision speaker tracking, and burns animated karaoke subtitles ready for TikTok, Instagram Reels, and YouTube Shorts.',
    whatIsFact:
      'Cliptica charges a flat 1 credit per completed video clip, with Starter starting at $29/mo for 150 credits and Pro Creator at $59/mo for 400 credits.',
    pricingHeading: 'How does Cliptica credit pricing work?',
    pricingAnswer:
      'Unlike legacy competitors that bill per audio minute regardless of output, Cliptica uses a predictable 1-credit per final video model. Every credit yields one fully rendered, captioned, and reframed 1080p short video clip. Unused credits never expire during an active billing cycle, and additional credit packs can be purchased anytime without subscription upgrades.',
    pricingFact:
      'Infra COGS is capped at $0.0033 per minute, guaranteeing over 94% gross margin while delivering 3x to 5x more video output than per-minute alternatives.',
    arabicHeading: 'Does Cliptica support Arabic subtitles and typography?',
    arabicAnswer:
      'Yes, Cliptica provides native, high-precision Arabic transcription and 18 dedicated typography presets, including Arabic Luxury Gold, Saudi High-Bitrate, and TikTok Viral. Subtitles feature right-to-left (RTL) word-by-word karaoke synchronization, custom Arabic ligature font rendering, and automated emoji pop triggers calibrated for Gulf, Levantine, and Egyptian dialects.',
    arabicFact:
      'Cliptica uses fine-tuned speech models with 98.4% Arabic word accuracy, eliminating the broken letters and reverse-direction glitches common in English-first tools.',
    whopHeading: 'Can Cliptica be used for Whop Content Rewards and TikTok Creator programs?',
    whopAnswer:
      'Yes, Cliptica includes a specialized Content Rewards ingestion engine. Creators can paste campaign links from Whop, content bounty hubs, or brand partnerships. Cliptica automatically detects the sponsor brand guidelines, pinpoints the most viral discussion moments, and exports formatted 9:16 shorts optimized to maximize views and monetization payouts.',
    whopFact:
      'Active clippers on Cliptica produce up to 200 videos daily on the Pro Creator plan ($59/mo), enabling full-time monetization across creator reward programs.',
  },
  compare: {
    badge: 'Unbiased Head-to-Head Comparison',
    h1: 'Cliptica vs. Opus Clip vs. Klap vs. Submagic',
    subtitle:
      'Explore how Cliptica compares with the leading AI video clipping tools across pricing model, Arabic typography, split-screen podcast framing, and content monetization workflows.',
    tldrHeading: 'Quick Summary: Which AI clipper should you choose?',
    tldrAnswer:
      'Choose Cliptica if you want transparent per-video pricing (1 credit = 1 final video), superior Arabic and English kinetic subtitles, two-person podcast split-screen, or Whop Content Rewards ingestion. Choose Opus Clip if you only need English long-form processing and prefer per-minute meter billing.',
    tableTitle: 'Feature & Pricing Matrix',
    colFeature: 'Feature',
    colCliptica: 'Cliptica',
    colOpus: 'Opus Clip',
    colKlap: 'Klap.app',
    colSubmagic: 'Submagic',
    rowPricing: {
      feature: 'Pricing Model',
      cliptica: 'Flat 1 credit / video ($0.14 - $0.19)',
      opus: 'Per source minute ($0.095 / min)',
      klap: 'Per source minute ($0.290 / min)',
      submagic: 'Strict video quotas ($0.167 - $0.333)',
    },
    rowArabic: {
      feature: 'Arabic Subtitles & RTL',
      cliptica: 'Native RTL · 18 presets · Luxury Gold',
      opus: 'Basic translation · Limited fonts',
      klap: 'English focused · Poor RTL',
      submagic: 'Standard templates · High latency',
    },
    rowSplit: {
      feature: 'Podcast 2-Person Split',
      cliptica: 'Automated speaker detection & split',
      opus: 'Single face-crop only',
      klap: 'Center-crop only',
      submagic: 'Manual crop adjustments',
    },
    rowWhop: {
      feature: 'Whop & Campaign Hub',
      cliptica: 'Built-in campaign link ingestion',
      opus: 'None (YouTube only)',
      klap: 'None',
      submagic: 'None',
    },
    bestForHeading: 'Cliptica is Best For:',
    bestForText:
      'Creators producing short-form videos for TikTok, Reels, and Shorts; podcast hosts wanting automated two-speaker split screens; MENA & international creators requiring flawless Arabic typography; and clippers monetizing through Whop Content Rewards or TikTok Creator Rewards.',
    notBestForHeading: 'Cliptica is Not Best For:',
    notBestForText:
      'Long-form video editing that requires non-linear multi-track timeline cuts, cinematic color grading, or documentary-style manual transitions. Cliptica is engineered specifically for high-velocity short-form repurposing.',
  },
  pricingSection: {
    badge: 'Transparent Value',
    h1: 'Simple pricing. 1 Credit = 1 Final Video.',
    subtitle:
      'No surprise minute meters or hidden compute charges. Every credit delivers a complete, captioned, reframed 1080p video clip ready for instant posting.',
    flatModelNote: 'Every plan includes all 18 caption styles, AI face tracking, and 1080p high bitrate exports.',
    freeName: 'Free Trial',
    freePrice: '$0',
    freePeriod: 'forever',
    freeCredits: '15 credits to test the pipeline',
    starterName: 'Starter (Clipper)',
    starterPrice: '$29',
    starterPeriod: '/ month',
    starterCredits: '150 credits / month ($0.19 / video)',
    proName: 'Pro Creator (Studio)',
    proPrice: '$59',
    proPeriod: '/ month',
    proCredits: '400 credits / month ($0.14 / video)',
    packsTitle: 'One-Time Credit Packs (No Subscription Required)',
    pack50: '50 Credits — $15 ($0.30 / credit)',
    pack150: '150 Credits — $35 ($0.23 / credit · Most Popular)',
    pack500: '500 Credits — $89 ($0.17 / credit · Best Value)',
  },
  faqs: [
    {
      question: 'How does Cliptica differ from Opus Clip and Klap?',
      answer:
        'Cliptica charges a flat 1 credit per final video instead of charging per source minute. If you upload a 45-minute podcast and extract 3 clips, you spend 3 credits ($0.45 - $0.57 total) instead of paying for 45 minutes of expensive processing time. Cliptica also provides market-leading Arabic typography, podcast two-speaker split screens, and Whop campaign ingestion.',
    },
    {
      question: 'What video platforms and formats are supported?',
      answer:
        'Cliptica accepts YouTube public and unlisted URLs, direct MP4/MOV file uploads from your desktop or phone, and direct video links from Whop Content Rewards campaigns. Output formats include vertical 9:16 (TikTok, Reels, Shorts), square 1:1 (LinkedIn, Instagram Feed), and widescreen 16:9.',
    },
    {
      question: 'How accurate is the AI transcription in Arabic and English?',
      answer:
        'Cliptica runs Whisper Large v3 Turbo on high-speed Groq tensor units. It delivers 98.4% word accuracy in Arabic and 99.1% in English, generating word-level millisecond timestamps to power lively karaoke pop highlights.',
    },
    {
      question: 'What happens if a video processing job fails?',
      answer:
        'If a video cannot be processed due to source issues or unavailable media, any reserved credits are immediately and automatically refunded to your balance with a full audit log in your dashboard.',
    },
    {
      question: 'Can I cancel or change my subscription at any time?',
      answer:
        'Yes. You can upgrade, downgrade, or cancel your subscription at any time via the Stripe Customer Portal in your billing settings. Your existing credits remain valid until the end of the billing period.',
    },
  ],
  footer: {
    rights: 'All rights reserved.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    refund: 'Refund Policy',
  },
}
