import { Metadata } from 'next'
import Link from 'next/link'
import { Check, Sparkles, ShieldCheck } from 'lucide-react'
import { MarketingLayout } from '@/components/marketing-layout'
import { buildPageMetadata } from '@/lib/seo/metadata'
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildFAQSchema,
  buildBreadcrumbSchema,
} from '@/lib/seo/schema'
import { en } from '@/lib/i18n/messages/en'
import { SITE_URL } from '@/lib/seo/constants'

export const metadata: Metadata = buildPageMetadata({
  locale: 'en',
  path: 'pricing',
  title: 'Pricing Plans & Credit Packs — 1 Credit = 1 Final Video | Clipzila',
  description:
    'Transparent per-video pricing. Start with 5 free credits. Basic plan at $15/mo for 50 videos, Starter at $29/mo for 120 videos, Pro Creator at $59/mo for 400 videos. Never pay for raw source minutes.',
  keywords: [
    'Clipzila pricing',
    'AI video clipping cost',
    'cheap video clipper',
    'Opus Clip pricing comparison',
    'video repurposing credit packs',
  ],
})

export default function PricingPage() {
  const p = en.pricingSection
  const faqs = en.faqs

  const orgSchema = buildOrganizationSchema()
  const appSchema = buildSoftwareApplicationSchema()
  const faqSchema = buildFAQSchema(faqs)
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Pricing', url: `${SITE_URL}/pricing` },
  ])

  return (
    <MarketingLayout locale="en">
      {/* Inject Structured Data for Generative Engines & Google Rich Results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-32 pb-20">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1 text-xs font-semibold text-champagne">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span>{p.badge}</span>
          </div>
          <h1 className="display-lg mt-4 text-pearl font-extrabold tracking-tight">
            {p.h1}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-mist">
            {p.subtitle}
          </p>
        </div>

        {/* Answer Box */}
        <div className="mt-8 rounded-2xl border border-hair/80 bg-onyx-2/80 p-5 text-center text-sm text-champagne">
          <ShieldCheck className="mx-auto mb-1.5 h-5 w-5 text-gold" />
          <p>{p.flatModelNote}</p>
        </div>

        {/* Subscription Tier Cards */}
        <div className="mt-12 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Free Tier */}
          <div className="flex flex-col justify-between rounded-3xl border border-hair/60 bg-onyx-2 p-6">
            <div>
              <h3 className="font-display text-lg font-bold text-pearl">{p.freeName}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-pearl">{p.freePrice}</span>
                <span className="text-xs text-mist">/ {p.freePeriod}</span>
              </div>
              <p className="mt-2 text-xs text-mist">{p.freeCredits}</p>
              <ul className="mt-6 space-y-3 text-xs text-mist">
                <li className="flex items-center gap-2 text-pearl">
                  <Check className="h-4 w-4 text-gold" />
                  <span>5 free video credits</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>All 18 subtitle presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>720p watermarked exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>Max 20 min source videos</span>
                </li>
              </ul>
            </div>
            <Link href="/register" className="btn-secondary mt-8 w-full text-center text-xs font-semibold py-2.5">
              Start Free
            </Link>
          </div>

          {/* Basic Plan */}
          <div className="flex flex-col justify-between rounded-3xl border border-hair/60 bg-onyx-2 p-6">
            <div>
              <h3 className="font-display text-lg font-bold text-pearl">{p.basicName}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-pearl">{p.basicPrice}</span>
                <span className="text-xs text-mist">{p.basicPeriod}</span>
              </div>
              <p className="mt-2 text-xs text-champagne font-medium">{p.basicCredits}</p>
              <ul className="mt-6 space-y-3 text-xs text-mist">
                <li className="flex items-center gap-2 text-pearl font-medium">
                  <Check className="h-4 w-4 text-gold" />
                  <span>50 credits / month</span>
                </li>
                <li className="flex items-center gap-2 text-pearl">
                  <Check className="h-4 w-4 text-gold" />
                  <span>No watermark · 1080p HD</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>All 18 subtitle presets</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>Max 45 min source videos</span>
                </li>
              </ul>
            </div>
            <Link href="/register?plan=basic" className="btn-secondary mt-8 w-full text-center text-xs font-semibold py-2.5">
              Choose Basic
            </Link>
          </div>

          {/* Starter Plan (Featured) */}
          <div className="relative flex flex-col justify-between rounded-3xl border border-gold/50 bg-gradient-to-b from-gold/10 via-onyx-2 to-onyx-2 p-6 shadow-2xl">
            <span className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-0.5 text-[10px] font-extrabold text-black uppercase tracking-wider">
              Most Popular
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-pearl">{p.starterName}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-champagne">{p.starterPrice}</span>
                <span className="text-xs text-mist">{p.starterPeriod}</span>
              </div>
              <p className="mt-2 text-xs text-champagne font-medium">{p.starterCredits}</p>
              <ul className="mt-6 space-y-3 text-xs text-mist">
                <li className="flex items-center gap-2 text-pearl font-medium">
                  <Check className="h-4 w-4 text-gold" />
                  <span>120 credits / month</span>
                </li>
                <li className="flex items-center gap-2 text-pearl">
                  <Check className="h-4 w-4 text-gold" />
                  <span>No watermark · 1080p high bitrate</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>Opening hooks & Title cards</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>Max 90 min source videos</span>
                </li>
              </ul>
            </div>
            <Link href="/register?plan=clipper" className="btn-lux btn-primary mt-8 w-full text-center text-xs font-semibold py-2.5">
              Choose Starter
            </Link>
          </div>

          {/* Pro Creator Plan */}
          <div className="flex flex-col justify-between rounded-3xl border border-hair/60 bg-onyx-2 p-6">
            <div>
              <h3 className="font-display text-lg font-bold text-pearl">{p.proName}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-pearl">{p.proPrice}</span>
                <span className="text-xs text-mist">{p.proPeriod}</span>
              </div>
              <p className="mt-2 text-xs text-champagne font-medium">{p.proCredits}</p>
              <ul className="mt-6 space-y-3 text-xs text-mist">
                <li className="flex items-center gap-2 text-pearl font-medium">
                  <Check className="h-4 w-4 text-gold" />
                  <span>400 credits / month</span>
                </li>
                <li className="flex items-center gap-2 text-pearl">
                  <Check className="h-4 w-4 text-gold" />
                  <span>VIP Priority render queue</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>AI Auto-Pilot channel monitoring</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold" />
                  <span>Podcast 2-person split screen</span>
                </li>
              </ul>
            </div>
            <Link href="/register?plan=studio" className="btn-secondary mt-8 w-full text-center text-xs font-semibold py-2.5">
              Choose Pro Creator
            </Link>
          </div>
        </div>

        {/* Credit Packs Section */}
        <div className="mt-14 rounded-3xl border border-hair/70 bg-black/40 p-8">
          <h2 className="font-display text-xl font-bold text-pearl text-center">{p.packsTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3 text-center text-sm">
            <div className="rounded-2xl border border-hair/50 bg-onyx-2 p-4">
              <p className="font-bold text-pearl">{p.pack50}</p>
            </div>
            <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
              <p className="font-bold text-champagne">{p.pack150}</p>
            </div>
            <div className="rounded-2xl border border-hair/50 bg-onyx-2 p-4">
              <p className="font-bold text-pearl">{p.pack500}</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 border-t border-hair pt-12">
          <h2 className="font-display text-2xl font-bold text-pearl text-center">
            Pricing & Billing Questions
          </h2>
          <div className="mt-8 space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-2xl border border-hair/60 bg-onyx-2 p-5">
                <h3 className="font-display text-base font-semibold text-pearl">
                  {faq.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}
