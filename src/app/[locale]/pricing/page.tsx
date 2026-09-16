import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Sparkles, ShieldCheck } from 'lucide-react'
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
    path: 'pricing',
    title: `${m.pricingSection.h1} | Clipzila`,
    description: m.pricingSection.subtitle,
  })
}

export default async function LocalizedPricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isValidLocale(locale) || locale === 'en') {
    notFound()
  }

  const m = getMessages(locale)
  const p = m.pricingSection
  const isRtl = m.dir === 'rtl'

  const orgSchema = buildOrganizationSchema()
  const appSchema = buildSoftwareApplicationSchema()
  const faqSchema = buildFAQSchema(m.faqs)
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: `${SITE_URL}/${locale}` },
    { name: 'Pricing', url: `${SITE_URL}/${locale}/pricing` },
  ])

  const localizedLabels = {
    ar: {
      mostPopular: 'الأكثر شيوعاً',
      faqTitle: 'أسئلة شائعة حول الأسعار والفواتير',
      ctaFree: 'ابدأ مجاناً',
      ctaStarter: 'اختر باقة ستارتر',
      ctaPro: 'اختر باقة المحترف',
      featuresFree: [
        '15 رصيد فيديو مجاني',
        'جميع أنماط النصوص الـ 18',
        'تصدير 720p بعلامة مائية',
        'فيديوهات أصلية حتى 20 دقيقة',
      ],
      featuresStarter: [
        '150 رصيد شهرياً (150 مقطع)',
        'بدون علامة مائية · جودة 1080p فائقة',
        'خطوط عربية فاخرة وأنماط كينيتك',
        'فيديوهات أصلية حتى 90 دقيقة',
      ],
      featuresPro: [
        '400 رصيد شهرياً (400 مقطع)',
        'أولوية قصوى في طابور المعالجة',
        'نظام الطيار الآلي ومراقبة القنوات',
        'سحب مسابقات ومكافآت Whop التلقائي',
        'فيديوهات أصلية حتى 120 دقيقة',
      ],
    },
    de: {
      mostPopular: 'Beliebteste Wahl',
      faqTitle: 'Häufige Fragen zu Preisen & Abrechnung',
      ctaFree: 'Kostenlos starten',
      ctaStarter: 'Starter wählen',
      ctaPro: 'Pro Creator wählen',
      featuresFree: [
        '15 kostenlose Video-Credits',
        'Alle 18 Untertitel-Vorlagen',
        '720p-Export mit Wasserzeichen',
        'Videos bis zu 20 Minuten',
      ],
      featuresStarter: [
        '150 Credits / Monat (150 Clips)',
        'Kein Wasserzeichen · 1080p HD',
        'Dynamische virale Untertitel',
        'Videos bis zu 90 Minuten',
      ],
      featuresPro: [
        '400 Credits / Monat (400 Clips)',
        'Prioritäts-Warteschlange',
        'KI-Autopilot Kanalüberwachung',
        'Whop Content Rewards Integration',
        'Videos bis zu 120 Minuten',
      ],
    },
    fr: {
      mostPopular: 'Le Plus Populaire',
      faqTitle: 'Questions fréquentes sur les tarifs',
      ctaFree: 'Commencer gratuitement',
      ctaStarter: 'Choisir Starter',
      ctaPro: 'Choisir Pro Creator',
      featuresFree: [
        '15 crédits vidéo gratuits',
        'Tous les 18 styles de sous-titres',
        'Export 720p avec filigrane',
        'Vidéos sources max 20 minutes',
      ],
      featuresStarter: [
        '150 crédits / mois (150 clips)',
        'Sans filigrane · 1080p HD',
        'Sous-titres dynamiques viraux',
        'Vidéos sources max 90 minutes',
      ],
      featuresPro: [
        '400 crédits / mois (400 clips)',
        'File de rendu prioritaire',
        'Surveillance automatique des chaînes',
        'Intégration récompenses Whop',
        'Vidéos sources max 120 minutes',
      ],
    },
    es: {
      mostPopular: 'Más Popular',
      faqTitle: 'Preguntas frecuentes sobre precios',
      ctaFree: 'Comenzar gratis',
      ctaStarter: 'Elegir Starter',
      ctaPro: 'Elegir Pro Creator',
      featuresFree: [
        '15 créditos de video gratis',
        'Las 18 plantillas de subtítulos',
        'Exportación 720p con marca de agua',
        'Videos fuente de hasta 20 minutos',
      ],
      featuresStarter: [
        '150 créditos / mes (150 clips)',
        'Sin marca de agua · 1080p HD',
        'Subtítulos cinéticos virales',
        'Videos fuente de hasta 90 minutos',
      ],
      featuresPro: [
        '400 créditos / mes (400 clips)',
        'Cola de renderizado prioritaria',
        'Piloto automático de canales',
        'Integración Whop Content Rewards',
        'Videos fuente de hasta 120 minutos',
      ],
    },
  }

  const l = localizedLabels[locale as 'ar' | 'de' | 'fr' | 'es'] || localizedLabels.de

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
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Free Tier */}
            <div className="flex flex-col justify-between rounded-3xl border border-hair/60 bg-onyx-2 p-7">
              <div>
                <h3 className="font-display text-lg font-bold text-pearl">{p.freeName}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-pearl">{p.freePrice}</span>
                  <span className="text-xs text-mist">/ {p.freePeriod}</span>
                </div>
                <p className="mt-2 text-xs text-mist">{p.freeCredits}</p>
                <ul className="mt-6 space-y-3 text-xs text-mist">
                  {l.featuresFree.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-pearl">
                      <Check className="h-4 w-4 text-gold shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/register" className="btn-secondary mt-8 w-full text-center text-xs font-semibold py-2.5">
                {l.ctaFree}
              </Link>
            </div>

            {/* Starter Plan (Featured) */}
            <div className="relative flex flex-col justify-between rounded-3xl border border-gold/50 bg-gradient-to-b from-gold/10 via-onyx-2 to-onyx-2 p-7 shadow-2xl">
              <span className={`absolute -top-3 ${isRtl ? 'left-6' : 'right-6'} rounded-full bg-gold px-3 py-0.5 text-[10px] font-extrabold text-black uppercase tracking-wider`}>
                {l.mostPopular}
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-pearl">{p.starterName}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-champagne">{p.starterPrice}</span>
                  <span className="text-xs text-mist">{p.starterPeriod}</span>
                </div>
                <p className="mt-2 text-xs text-champagne font-medium">{p.starterCredits}</p>
                <ul className="mt-6 space-y-3 text-xs text-mist">
                  {l.featuresStarter.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-pearl">
                      <Check className="h-4 w-4 text-gold shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/register?plan=clipper" className="btn-lux btn-primary mt-8 w-full text-center text-xs font-semibold py-2.5">
                {l.ctaStarter}
              </Link>
            </div>

            {/* Pro Creator Plan */}
            <div className="flex flex-col justify-between rounded-3xl border border-hair/60 bg-onyx-2 p-7">
              <div>
                <h3 className="font-display text-lg font-bold text-pearl">{p.proName}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-pearl">{p.proPrice}</span>
                  <span className="text-xs text-mist">{p.proPeriod}</span>
                </div>
                <p className="mt-2 text-xs text-champagne font-medium">{p.proCredits}</p>
                <ul className="mt-6 space-y-3 text-xs text-mist">
                  {l.featuresPro.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-pearl">
                      <Check className="h-4 w-4 text-gold shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/register?plan=studio" className="btn-secondary mt-8 w-full text-center text-xs font-semibold py-2.5">
                {l.ctaPro}
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
              {l.faqTitle}
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
