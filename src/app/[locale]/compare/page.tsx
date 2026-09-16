import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, X, ArrowRight, Sparkles, Zap } from 'lucide-react'
import { MarketingLayout } from '@/components/marketing-layout'
import { getMessages } from '@/lib/i18n'
import { LOCALES, isValidLocale, type Locale, SITE_URL } from '@/lib/seo/constants'
import { buildPageMetadata } from '@/lib/seo/metadata'
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildFAQSchema,
  buildBreadcrumbSchema,
} from '@/lib/seo/schema'

export function generateStaticParams() {
  return LOCALES.filter((loc) => loc !== 'en').map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isValidLocale(locale)) return {}

  const m = getMessages(locale)
  return buildPageMetadata({
    locale: locale as Locale,
    path: 'compare',
    title: `${m.compare.h1} | Clipzila`,
    description: m.compare.subtitle,
  })
}

export default async function LocalizedComparePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isValidLocale(locale) || locale === 'en') {
    notFound()
  }

  const m = getMessages(locale)
  const c = m.compare
  const isRtl = m.dir === 'rtl'

  const orgSchema = buildOrganizationSchema()
  const appSchema = buildSoftwareApplicationSchema()
  const faqSchema = buildFAQSchema(m.faqs)
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: `${SITE_URL}/${locale}` },
    { name: 'Compare', url: `${SITE_URL}/${locale}/compare` },
  ])

  return (
    <div dir={m.dir} className={isRtl ? 'font-arabic' : ''}>
      <MarketingLayout locale={locale as Locale}>
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

          {/* Answer-First Summary Block */}
          <div className="mt-10 rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-onyx-2 to-onyx-2 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2.5 text-gold text-sm font-bold uppercase tracking-wider">
              <Zap className="h-4 w-4" />
              <span>{c.tldrHeading}</span>
            </div>
            <p className="mt-2 text-base leading-relaxed text-pearl">
              {c.tldrAnswer}
            </p>
          </div>

          {/* Comparison Table */}
          <div className="mt-14 overflow-hidden rounded-3xl border border-hair bg-onyx-2/90 shadow-xl">
            <div className="border-b border-hair bg-black/40 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-pearl">{c.tableTitle}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isRtl ? 'text-right' : 'text-left'}`}>
                <thead className="border-b border-hair/60 bg-black/20 text-xs uppercase tracking-wider text-mist">
                  <tr>
                    <th className="px-6 py-4">{c.colFeature}</th>
                    <th className="px-6 py-4 text-gold font-bold bg-gold/5">{c.colClipzila}</th>
                    <th className="px-6 py-4">{c.colOpus}</th>
                    <th className="px-6 py-4">{c.colKlap}</th>
                    <th className="px-6 py-4">{c.colSubmagic}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair/40 text-pearl">
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-semibold">{c.rowPricing.feature}</td>
                    <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowPricing.clipzila}</td>
                    <td className="px-6 py-4 text-mist">{c.rowPricing.opus}</td>
                    <td className="px-6 py-4 text-mist">{c.rowPricing.klap}</td>
                    <td className="px-6 py-4 text-mist">{c.rowPricing.submagic}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-semibold">{c.rowArabic.feature}</td>
                    <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowArabic.clipzila}</td>
                    <td className="px-6 py-4 text-mist">{c.rowArabic.opus}</td>
                    <td className="px-6 py-4 text-mist">{c.rowArabic.klap}</td>
                    <td className="px-6 py-4 text-mist">{c.rowArabic.submagic}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-semibold">{c.rowSplit.feature}</td>
                    <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowSplit.clipzila}</td>
                    <td className="px-6 py-4 text-mist">{c.rowSplit.opus}</td>
                    <td className="px-6 py-4 text-mist">{c.rowSplit.klap}</td>
                    <td className="px-6 py-4 text-mist">{c.rowSplit.submagic}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-semibold">{c.rowWhop.feature}</td>
                    <td className="px-6 py-4 font-bold text-champagne bg-gold/5">{c.rowWhop.clipzila}</td>
                    <td className="px-6 py-4 text-mist">{c.rowWhop.opus}</td>
                    <td className="px-6 py-4 text-mist">{c.rowWhop.klap}</td>
                    <td className="px-6 py-4 text-mist">{c.rowWhop.submagic}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Best For / Not Best For */}
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

          {/* FAQ */}
          <div className="mt-16 border-t border-hair pt-12">
            <h2 className="font-display text-2xl font-bold text-pearl text-center">
              {locale === 'ar' ? 'أسئلة شائعة حول المقارنة' : 'Frequently Asked Questions'}
            </h2>
            <div className="mt-8 space-y-4">
              {m.faqs.map((faq, index) => (
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

          {/* CTA */}
          <div className="mt-16 text-center">
            <Link
              href="/register"
              className="btn-lux btn-primary inline-flex items-center gap-2 !px-8 !py-3.5 !text-base"
            >
              <span>{m.hero.ctaPrimary}</span>
              <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </MarketingLayout>
    </div>
  )
}
