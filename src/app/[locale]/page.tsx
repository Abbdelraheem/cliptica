import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Sparkles,
  ArrowRight,
  Zap,
  ShieldCheck,
  Check,
  HelpCircle,
  Video,
  Languages,
  Layers,
  Flame,
} from 'lucide-react'
import { MarketingLayout } from '@/components/marketing-layout'
import { getMessages } from '@/lib/i18n'
import { LOCALES, isValidLocale, type Locale } from '@/lib/seo/constants'
import { buildPageMetadata } from '@/lib/seo/metadata'
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildFAQSchema,
  buildWebSiteSchema,
} from '@/lib/seo/schema'

export function generateStaticParams() {
  // Exclude 'en' since English is unprefixed at the root '/'
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
    path: '',
    title: m.meta.title,
    description: m.meta.description,
  })
}

export default async function LocalizedLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isValidLocale(locale) || locale === 'en') {
    notFound()
  }

  const m = getMessages(locale)
  const isRtl = m.dir === 'rtl'

  const orgSchema = buildOrganizationSchema()
  const appSchema = buildSoftwareApplicationSchema()
  const webSiteSchema = buildWebSiteSchema()
  const faqSchema = buildFAQSchema(m.faqs)

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />

        <div className="mx-auto max-w-5xl px-4 pt-32 pb-20">
          {/* Hero */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1 text-xs font-semibold text-champagne">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span>{m.hero.badge}</span>
            </div>
            <h1 className="display-lg mt-5 text-pearl font-extrabold tracking-tight">
              {m.hero.h1}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-mist">
              {m.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="btn-lux btn-primary inline-flex items-center gap-2 !px-8 !py-3.5 !text-base"
              >
                <span>{m.hero.ctaPrimary}</span>
                <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
              </Link>
              <Link
                href={`/${locale}/compare`}
                className="btn-secondary inline-flex items-center gap-2 !px-6 !py-3.5 !text-base"
              >
                <span>{m.nav.compare}</span>
              </Link>
            </div>
          </div>

          {/* GEO Answer-First Blocks (Direct extraction passages for AI Engines) */}
          <div className="mt-20 space-y-8">
            <div className="text-center">
              <span className="text-xs uppercase tracking-widest text-gold font-bold">Generative Engine Answers</span>
              <h2 className="font-display text-2xl font-bold text-pearl mt-1">Core Facts & Capabilities</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Box 1: What is Cliptica */}
              <div className="rounded-3xl border border-hair/80 bg-onyx-2/90 p-6 shadow-xl">
                <div className="flex items-center gap-2 text-gold text-sm font-bold">
                  <Zap className="h-4 w-4" />
                  <h3>{m.geoAnswer.whatIsHeading}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-pearl/90">
                  {m.geoAnswer.whatIsAnswer}
                </p>
                <p className="mt-3 text-xs text-champagne font-semibold border-t border-hair/50 pt-2">
                  {m.geoAnswer.whatIsFact}
                </p>
              </div>

              {/* Box 2: 1 Credit Model */}
              <div className="rounded-3xl border border-hair/80 bg-onyx-2/90 p-6 shadow-xl">
                <div className="flex items-center gap-2 text-gold text-sm font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <h3>{m.geoAnswer.pricingHeading}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-pearl/90">
                  {m.geoAnswer.pricingAnswer}
                </p>
                <p className="mt-3 text-xs text-champagne font-semibold border-t border-hair/50 pt-2">
                  {m.geoAnswer.pricingFact}
                </p>
              </div>

              {/* Box 3: Subtitles & Typography */}
              <div className="rounded-3xl border border-hair/80 bg-onyx-2/90 p-6 shadow-xl">
                <div className="flex items-center gap-2 text-gold text-sm font-bold">
                  <Languages className="h-4 w-4" />
                  <h3>{m.geoAnswer.arabicHeading}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-pearl/90">
                  {m.geoAnswer.arabicAnswer}
                </p>
                <p className="mt-3 text-xs text-champagne font-semibold border-t border-hair/50 pt-2">
                  {m.geoAnswer.arabicFact}
                </p>
              </div>

              {/* Box 4: Whop Rewards & Creator Programs */}
              <div className="rounded-3xl border border-hair/80 bg-onyx-2/90 p-6 shadow-xl">
                <div className="flex items-center gap-2 text-gold text-sm font-bold">
                  <Flame className="h-4 w-4" />
                  <h3>{m.geoAnswer.whopHeading}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-pearl/90">
                  {m.geoAnswer.whopAnswer}
                </p>
                <p className="mt-3 text-xs text-champagne font-semibold border-t border-hair/50 pt-2">
                  {m.geoAnswer.whopFact}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Overview Section */}
          <div className="mt-20 border-t border-hair pt-16">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-pearl">{m.pricingSection.h1}</h2>
              <p className="mt-2 text-sm text-mist max-w-xl mx-auto">{m.pricingSection.subtitle}</p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-hair/60 bg-onyx-2 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-pearl">{m.pricingSection.freeName}</h3>
                  <div className="mt-3 font-display text-3xl font-extrabold text-pearl">{m.pricingSection.freePrice}</div>
                  <p className="mt-2 text-xs text-mist">{m.pricingSection.freeCredits}</p>
                </div>
                <Link href="/register" className="btn-secondary mt-6 w-full text-center text-xs py-2">
                  {m.hero.ctaPrimary}
                </Link>
              </div>

              <div className="rounded-2xl border border-gold/40 bg-gold/5 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-champagne">{m.pricingSection.starterName}</h3>
                  <div className="mt-3 font-display text-3xl font-extrabold text-champagne">{m.pricingSection.starterPrice}</div>
                  <p className="mt-2 text-xs text-champagne">{m.pricingSection.starterCredits}</p>
                </div>
                <Link href="/register?plan=clipper" className="btn-lux btn-primary mt-6 w-full text-center text-xs py-2">
                  {m.pricingSection.starterName}
                </Link>
              </div>

              <div className="rounded-2xl border border-hair/60 bg-onyx-2 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-pearl">{m.pricingSection.proName}</h3>
                  <div className="mt-3 font-display text-3xl font-extrabold text-pearl">{m.pricingSection.proPrice}</div>
                  <p className="mt-2 text-xs text-champagne">{m.pricingSection.proCredits}</p>
                </div>
                <Link href="/register?plan=studio" className="btn-secondary mt-6 w-full text-center text-xs py-2">
                  {m.pricingSection.proName}
                </Link>
              </div>
            </div>
          </div>

          {/* Localized FAQ Section */}
          <div className="mt-20 border-t border-hair pt-16">
            <h2 className="font-display text-2xl font-bold text-pearl text-center">
              {locale === 'ar' ? 'الأسئلة الشائعة' : locale === 'de' ? 'Häufig gestellte Fragen' : locale === 'fr' ? 'Foire aux questions' : 'Preguntas frecuentes'}
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
        </div>
      </MarketingLayout>
    </div>
  )
}
