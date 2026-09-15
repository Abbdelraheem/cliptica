import { Metadata } from 'next'
import Link from 'next/link'
import { Check, X, ArrowRight, Sparkles, Shield, Zap, HelpCircle } from 'lucide-react'
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
  path: 'compare',
  title: 'Cliptica vs. Opus Clip, Klap & Submagic — Best AI Video Clipper (2026)',
  description:
    'Detailed head-to-head comparison of Cliptica vs Opus Clip, Klap, Submagic, and Vizard. Compare pricing per video vs per minute, Arabic subtitles, podcast split-screen, and Whop rewards.',
  keywords: [
    'Opus Clip alternative',
    'Cliptica vs Opus Clip',
    'Klap alternative',
    'Submagic alternative',
    'best AI video clipper 2026',
    'podcast to shorts AI',
    'Arabic video clipping software',
  ],
})

export default function ComparePage() {
  const c = en.compare
  const faqs = en.faqs

  const orgSchema = buildOrganizationSchema()
  const appSchema = buildSoftwareApplicationSchema()
  const faqSchema = buildFAQSchema(faqs)
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Compare', url: `${SITE_URL}/compare` },
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
            <span>{c.badge}</span>
          </div>
          <h1 className="display-lg mt-4 text-pearl font-extrabold tracking-tight">
            {c.h1}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-mist">
            {c.subtitle}
          </p>
        </div>

        {/* Answer-First GEO Summary Block (Extractable 40-60 words) */}
        <div className="mt-10 rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-onyx-2 to-onyx-2 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2.5 text-gold text-sm font-bold uppercase tracking-wider">
            <Zap className="h-4 w-4" />
            <span>{c.tldrHeading}</span>
          </div>
          <p className="mt-2 text-base leading-relaxed text-pearl">
            {c.tldrAnswer}
          </p>
          <p className="mt-2 text-sm text-champagne font-medium">
            Fact: Cliptica starts at $29/mo for 150 complete 1080p videos ($0.19/clip), whereas Opus Clip bills $0.095 per source minute regardless of how many clips you keep.
          </p>
        </div>

        {/* Feature Comparison Table (AI Engines extract HTML tables) */}
        <div className="mt-14 overflow-hidden rounded-3xl border border-hair bg-onyx-2/90 shadow-xl">
          <div className="border-b border-hair bg-black/40 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-pearl">{c.tableTitle}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hair/60 bg-black/20 text-xs uppercase tracking-wider text-mist">
                <tr>
                  <th className="px-6 py-4">{c.colFeature}</th>
                  <th className="px-6 py-4 text-gold font-bold bg-gold/5">{c.colCliptica}</th>
                  <th className="px-6 py-4">{c.colOpus}</th>
                  <th className="px-6 py-4">{c.colKlap}</th>
                  <th className="px-6 py-4">{c.colSubmagic}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair/40 text-pearl">
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-semibold">{c.rowPricing.feature}</td>
                  <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowPricing.cliptica}</td>
                  <td className="px-6 py-4 text-mist">{c.rowPricing.opus}</td>
                  <td className="px-6 py-4 text-mist">{c.rowPricing.klap}</td>
                  <td className="px-6 py-4 text-mist">{c.rowPricing.submagic}</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-semibold">{c.rowArabic.feature}</td>
                  <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowArabic.cliptica}</td>
                  <td className="px-6 py-4 text-mist">{c.rowArabic.opus}</td>
                  <td className="px-6 py-4 text-mist">{c.rowArabic.klap}</td>
                  <td className="px-6 py-4 text-mist">{c.rowArabic.submagic}</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-semibold">{c.rowSplit.feature}</td>
                  <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowSplit.cliptica}</td>
                  <td className="px-6 py-4 text-mist">{c.rowSplit.opus}</td>
                  <td className="px-6 py-4 text-mist">{c.rowSplit.klap}</td>
                  <td className="px-6 py-4 text-mist">{c.rowSplit.submagic}</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-semibold">{c.rowWhop.feature}</td>
                  <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowWhop.cliptica}</td>
                  <td className="px-6 py-4 text-mist">{c.rowWhop.opus}</td>
                  <td className="px-6 py-4 text-mist">{c.rowWhop.klap}</td>
                  <td className="px-6 py-4 text-mist">{c.rowWhop.submagic}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Best For / Not Best For Callout Cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-6">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Check className="h-5 w-5" />
              <h3>{c.bestForHeading}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-pearl/90">
              {c.bestForText}
            </p>
          </div>

          <div className="rounded-3xl border border-hair/60 bg-black/30 p-6">
            <div className="flex items-center gap-2 text-mist font-bold">
              <X className="h-5 w-5 text-red-400" />
              <h3>{c.notBestForHeading}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              {c.notBestForText}
            </p>
          </div>
        </div>

        {/* Answer Engine FAQ Section */}
        <div className="mt-16 border-t border-hair pt-12">
          <h2 className="font-display text-2xl font-bold text-pearl text-center">
            Frequently Asked Comparison Questions
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

        {/* Call To Action */}
        <div className="mt-16 text-center">
          <Link
            href="/register"
            className="btn-lux btn-primary inline-flex items-center gap-2 !px-8 !py-3.5 !text-base"
          >
            <span>Start Free with 15 Credits</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-2 text-xs text-mist">No credit card required · Full editor access</p>
        </div>
      </div>
    </MarketingLayout>
  )
}
