export interface MessageCatalog {
  locale: string
  dir: 'ltr' | 'rtl'
  meta: {
    title: string
    description: string
    oneLiner: string
  }
  nav: {
    features: string
    pricing: string
    compare: string
    login: string
    register: string
    dashboard: string
  }
  hero: {
    badge: string
    h1: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
    inputPlaceholder: string
    generateButton: string
  }
  geoAnswer: {
    whatIsHeading: string
    whatIsAnswer: string
    whatIsFact: string
    pricingHeading: string
    pricingAnswer: string
    pricingFact: string
    arabicHeading: string
    arabicAnswer: string
    arabicFact: string
    whopHeading: string
    whopAnswer: string
    whopFact: string
  }
  compare: {
    badge: string
    h1: string
    subtitle: string
    tldrHeading: string
    tldrAnswer: string
    tableTitle: string
    colFeature: string
    colCliptica: string
    colOpus: string
    colKlap: string
    colSubmagic: string
    rowPricing: { feature: string; cliptica: string; opus: string; klap: string; submagic: string }
    rowArabic: { feature: string; cliptica: string; opus: string; klap: string; submagic: string }
    rowSplit: { feature: string; cliptica: string; opus: string; klap: string; submagic: string }
    rowWhop: { feature: string; cliptica: string; opus: string; klap: string; submagic: string }
    bestForHeading: string
    bestForText: string
    notBestForHeading: string
    notBestForText: string
  }
  pricingSection: {
    badge: string
    h1: string
    subtitle: string
    flatModelNote: string
    freeName: string
    freePrice: string
    freePeriod: string
    freeCredits: string
    starterName: string
    starterPrice: string
    starterPeriod: string
    starterCredits: string
    proName: string
    proPrice: string
    proPeriod: string
    proCredits: string
    packsTitle: string
    pack50: string
    pack150: string
    pack500: string
  }
  faqs: Array<{
    question: string
    answer: string
  }>
  footer: {
    rights: string
    terms: string
    privacy: string
    refund: string
  }
}
