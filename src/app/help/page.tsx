'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  HelpCircle,
  CreditCard,
  Video,
  Captions,
  Share2,
  Shield,
  ChevronDown,
  Mail,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react'
import { MarketingLayout } from '@/components/marketing-layout'

interface FaqItem {
  id: string
  category: string
  q: string
  a: string
}

const FAQ_CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: HelpCircle },
  { id: 'start', label: 'Getting Started', icon: Video },
  { id: 'billing', label: 'Credits & Billing', icon: CreditCard },
  { id: 'captions', label: 'Subtitles & Styles', icon: Captions },
  { id: 'social', label: 'Social & Auto-Pilot', icon: Share2 },
  { id: 'security', label: 'Account & Security', icon: Shield },
]

const ALL_FAQS: FaqItem[] = [
  // Getting Started
  {
    id: 'how-it-works',
    category: 'start',
    q: 'How does Clipzila turn long videos into viral shorts?',
    a: 'Simply paste any public YouTube video link or upload your raw MP4/MOV footage. Clipzila transcribes the entire video using high-precision Groq Whisper, analyzes pacing and emotional energy with LLaMA 3.3 to score moments, crops each segment into vertical 9:16 using intelligent speaker face-tracking, and burns word-by-word animated captions.',
  },
  {
    id: 'supported-sources',
    category: 'start',
    q: 'What video sources and formats are supported?',
    a: 'Clipzila supports all public YouTube videos, podcasts, interviews, and livestreams. You can also upload direct video files (MP4, MOV, WebM, MKV) up to 2GB directly through our secure high-speed upload pipeline.',
  },
  {
    id: 'processing-time',
    category: 'start',
    q: 'How fast does video processing take?',
    a: 'A standard 30–60 minute podcast finishes processing in approximately 3 to 5 minutes. Our parallel rendering lanes extract audio, score viral segments, and render 1080p clips simultaneously.',
  },

  // Credits & Billing
  {
    id: 'fair-pricing',
    category: 'billing',
    q: 'How does Clipzila’s Fair Pricing model work?',
    a: 'Unlike competitors who charge you per raw source minute (burning your budget on dead silence and intro banter), Clipzila charges strictly per final exported video clip (1 Credit = 1 Final 1080p Video). If a 1-hour podcast produces 5 viral clips, you only use 5 credits.',
  },
  {
    id: 'credit-expiry',
    category: 'billing',
    q: 'Do credits expire?',
    a: 'Purchased pay-as-you-go credits never expire on active accounts. Monthly subscription plan credits renew every month and rollover while your subscription remains active.',
  },
  {
    id: 'paddle-payments',
    category: 'billing',
    q: 'What payment methods are supported and how secure is checkout?',
    a: 'We partner with Paddle, a global Merchant of Record. We support major credit and debit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and PayPal with bank-grade 256-bit SSL encryption.',
  },
  {
    id: 'cancel-subscription',
    category: 'billing',
    q: 'Can I cancel or change my subscription at any time?',
    a: 'Yes, absolutely. You can upgrade, downgrade, or cancel your subscription at any time with a single click from your Billing Settings via the Paddle Customer Portal. You retain full access to your remaining credits until the end of your billing cycle.',
  },

  // Captions & Subtitles
  {
    id: 'arabic-support',
    category: 'captions',
    q: 'Does Clipzila support Arabic subtitles and typography?',
    a: 'Yes! Clipzila offers native Arabic language support with custom Arabic luxury fonts (Cairo, Tajawal, Amiri) engineered with true right-to-left (RTL) spring animation, dynamic keyword highlights, and color glow styles.',
  },
  {
    id: 'subtitle-presets',
    category: 'captions',
    q: 'What subtitle styles are available?',
    a: 'We offer 18 professionally designed caption styles, including Hormozi Pop, Clean Minimalist, Neon Cyberpunk, Beast Impact, Vintage Cinema, and Luxury Gold. You can switch styles with one click and re-render instantly.',
  },

  // Social & Auto-Pilot
  {
    id: 'social-publishing',
    category: 'social',
    q: 'Can I post directly to TikTok, Instagram Reels, and YouTube Shorts?',
    a: 'Yes. Connect your social channels once under Settings > Social Platforms. From the clip player, you can publish directly to TikTok, Instagram Reels, or YouTube Shorts with custom titles, descriptions, and hashtags.',
  },
  {
    id: 'auto-pilot',
    category: 'social',
    q: 'What is the Auto-Pilot feature?',
    a: 'Auto-Pilot allows you to enter a YouTube channel URL. Clipzila automatically monitors the channel for new uploads, automatically extracts top viral moments, generates captions, and prepares them for your approval or automated social publishing.',
  },

  // Account & Security
  {
    id: 'content-privacy',
    category: 'security',
    q: 'Is my video footage and account data kept private?',
    a: 'Yes. All uploads and generated clips are stored in encrypted private Cloudflare R2 storage. Your videos are never shared, sold, or used to train third-party public AI models. Only you have access to your workspace.',
  },
  {
    id: 'device-security',
    category: 'security',
    q: 'How is account security and abuse prevented?',
    a: 'All passwords are cryptographically hashed using industry-standard Bcrypt. We enforce anti-bot honeypots, rate limiting, and device authentication to prevent unauthorized credential stuffing and automated abuse.',
  },
]

export default function HelpCenterPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>('how-it-works')

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return ALL_FAQS.filter((item) => {
      const matchesCat = activeCategory === 'all' || item.category === activeCategory
      const matchesQuery = !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      return matchesCat && matchesQuery
    })
  }, [activeCategory, searchQuery])

  // JSON-LD structured data for Google FAQPage Rich Results
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ALL_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }

  return (
    <MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="mx-auto max-w-5xl px-5 pt-28 pb-20 sm:px-6 sm:pt-36">
        {/* Header Hero */}
        <div className="text-center">
          <p className="eyebrow mx-auto inline-flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-gold" />
            Support & Knowledge Base
          </p>
          <h1 className="display-lg mt-4">
            How can we <span className="gold-text">help you</span> today?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-mist leading-relaxed">
            Find instant answers to billing questions, video processing, subtitle styles, and social integrations.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="input-lux flex items-center gap-3 !rounded-2xl !py-2.5 px-4 shadow-xl">
              <Search className="h-5 w-5 text-champagne shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, questions, features (e.g. credits, arabic subtitles, tiktok)..."
                className="w-full bg-transparent text-sm text-pearl placeholder:text-mist-2 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-mist hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {FAQ_CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'border border-gold/40 bg-gold/15 text-champagne shadow-md shadow-gold/5'
                    : 'border border-hair bg-onyx-2/60 text-mist hover:border-hair/80 hover:text-pearl'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-gold' : 'text-mist'}`} />
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* FAQ Accordion List */}
        <div className="mt-10 space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="rounded-2xl border border-hair bg-onyx-2 p-12 text-center">
              <HelpCircle className="mx-auto h-8 w-8 text-mist-2" />
              <p className="mt-3 text-base font-semibold text-pearl">No matching answers found</p>
              <p className="mt-1 text-xs text-mist">
                Try searching for different keywords or browse all categories.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setActiveCategory('all')
                }}
                className="btn-lux btn-outline mt-4 !px-4 !py-1.5 !text-xs"
              >
                Reset Search
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = expandedId === faq.id
              return (
                <div
                  key={faq.id}
                  className={`glass-card overflow-hidden rounded-2xl transition-all duration-200 ${
                    isOpen ? '!border-champagne/40 bg-onyx-2/90 shadow-lg' : 'bg-onyx-2/40 hover:border-hair'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="font-display text-sm font-semibold text-pearl sm:text-base">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-champagne transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-hair/40 px-5 pt-3 pb-5">
                      <p className="text-sm leading-relaxed text-mist font-light">
                        {faq.a}
                      </p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Still need help? Contact Support Card */}
        <div className="mt-16 rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/10 via-onyx-2 to-black p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/40 bg-gold/15 text-gold">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold text-pearl mt-4">
            Still have questions?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist font-light leading-relaxed">
            Our engineering and creator support team is here to assist you 24/7 with custom plans, API access, or troubleshooting.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="mailto:support@clipzila.com?subject=Clipzila%20Help%20Center%20Inquiry"
              className="btn-lux btn-primary inline-flex items-center gap-2 !rounded-xl !px-6 !py-3 !text-sm"
            >
              <Mail className="h-4 w-4" />
              Email Creator Support
            </a>
            <Link
              href="/register"
              className="btn-lux btn-outline inline-flex items-center gap-2 !rounded-xl !px-6 !py-3 !text-sm"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-mist-2">
            Average response time: under 2 hours · Official email: support@clipzila.com
          </p>
        </div>
      </div>
    </MarketingLayout>
  )
}
