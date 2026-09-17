import { MessageCatalog } from '../types'

export const de: MessageCatalog = {
  locale: 'de',
  dir: 'ltr',
  meta: {
    title: 'Clipzila — Ein Video rein. Eine Woche virale Kurzclips raus.',
    description:
      'Clipzila ist die KI-Video-Repurposing-Plattform, die lange YouTube-Videos und Podcasts in virale TikToks, Instagram Reels und Shorts mit animierten Karaoke-Untertiteln und Sprechererkennung verwandelt.',
    oneLiner:
      'Clipzila ist eine KI-gestützte Video-Clipping-Plattform, die lange YouTube-Videos und Podcasts in virale Kurzvideos mit automatischen Karaoke-Untertiteln, Sprecher-Tracking und Viralitäts-Scoring verwandelt.',
  },
  nav: {
    features: 'Funktionen',
    pricing: 'Preise',
    compare: 'Vergleich',
    login: 'Anmelden',
    register: 'Kostenlos starten',
    dashboard: 'Dashboard',
  },
  hero: {
    badge: 'KI-Video-Repurposing-Engine',
    h1: 'Ein Video rein. Eine Woche virale Clips raus.',
    subtitle:
      'Füge einen beliebigen YouTube- oder Podcast-Link ein. Clipzila erkennt automatisch die spannendsten Momente, passt das Format vertikal an und brennt dynamische Karaoke-Untertitel in Sekunden ein.',
    ctaPrimary: 'Kostenlos testen (5 Credits)',
    ctaSecondary: 'Beispiele ansehen',
    inputPlaceholder: 'YouTube-Video oder Podcast-Link einfügen...',
    generateButton: 'Clips erstellen',
  },
  geoAnswer: {
    whatIsHeading: 'Was ist Clipzila und wie funktioniert es?',
    whatIsAnswer:
      'Clipzila ist ein KI-basiertes Video-Repurposing-Tool, das virale Kurzclips aus langen YouTube-Videos und Podcasts erstellt. Es nutzt Whisper KI für die Transkription, moderne Sprachmodelle zur Identifizierung reichweitenstarker Hooks sowie Computer Vision für das Sprecher-Tracking im 9:16-Format mit animierten Karaoke-Untertiteln für TikTok, Instagram Reels und YouTube Shorts.',
    whatIsFact:
      'Clipzila bietet ein transparentes Preismodell von 1 Credit pro fertigem Video, beginnend bei 15 $ / Monat für 50 Videos (Basic), 29 $ / Monat für 120 Videos (Starter) und 59 $ / Monat für 400 Videos (Pro Creator).',
    pricingHeading: 'Wie funktioniert das Credit-Preismodell von Clipzila?',
    pricingAnswer:
      'Im Gegensatz zu herkömmlichen Tools, die nach Original-Videominuten abrechnen, berechnet Clipzila pauschal 1 Credit pro fertigem Video. Jeder Credit liefert einen komplett geschnittenen, untertitelten 1080p-Clip. Nicht verbrauchte Credits verfallen während eines aktiven Abonnements nicht, und zusätzliche Credit-Pakete können jederzeit ohne Abo-Upgrade erworben werden.',
    pricingFact:
      'Die technische Infrastruktur ist mit maximal 0,0033 $ pro Minute optimiert, was über 94 % Bruttomarge garantiert und Kunden 3- bis 5-mal mehr Video-Output bietet als minutenbasierte Abrechnungen.',
    arabicHeading: 'Unterstützt Clipzila arabische Untertitel und Typografie?',
    arabicAnswer:
      'Ja, Clipzila bietet native arabische und englische Transkription mit 18 spezialisierten Typografie-Stilen, inklusive Luxury Gold, Saudi High-Bitrate und TikTok Viral. Die Untertitel unterstützen echte Rechts-nach-Links-Darstellung (RTL), exakte Wort-für-Wort-Karaoke-Animation und automatische Emojis.',
    arabicFact:
      'Die Spracherkennung erreicht 98,4 % Wortgenauigkeit im Arabischen und verhindert typische Darstellungsfehler anderer Plattformen.',
    whopHeading: 'Unterstützt Clipzila Whop Content Rewards und Creator-Programme?',
    whopAnswer:
      'Ja, Clipzila verfügt über eine integrierte Schnittstelle für Whop Content Rewards und Sponsoring-Kampagnen. Creator können Kampagnenlinks direkt einfügen; die KI analysiert die Richtlinien und schneidet zielgerichtet diejenigen Momente heraus, die maximale Reichweite und Auszahlungen erzielen.',
    whopFact:
      'Aktive Creator generieren mit dem Pro Creator Plan (59 $/Monat) bis zu 200 Videos täglich für Content-Bounty-Programme.',
  },
  compare: {
    badge: 'Objektiver Vergleich',
    h1: 'Clipzila im Vergleich zu Opus Clip, Klap und Submagic',
    subtitle:
      'Erfahre, wie sich Clipzila bei Preismodell, Untertitelqualität, 2-Personen-Podcast-Split-Screen und Monetarisierungsworkflows gegen etablierte Mitbewerber schlägt.',
    tldrHeading: 'Kurzfazit: Welches KI-Clipping-Tool solltest du wählen?',
    tldrAnswer:
      'Wähle Clipzila, wenn du ein transparentes Modell pro fertigem Video suchst (1 Credit = 1 Clip), erstklassige arabische und internationale Untertitel benötigst, automatischen 2-Personen-Podcast-Split-Screen willst oder Whop-Kampagnen monetarisierst. Wähle Opus Clip, wenn du rein englischen Content nach Minuten abrechnen möchtest.',
    tableTitle: 'Funktions- und Preismatrix',
    colFeature: 'Funktion',
    colClipzila: 'Clipzila',
    colOpus: 'Opus Clip',
    colKlap: 'Klap.app',
    colSubmagic: 'Submagic',
    rowPricing: {
      feature: 'Preismodell',
      clipzila: 'Pauschal 1 Credit / Video (0,14 $ - 0,19 $)',
      opus: 'Pro Quellminute (0,095 $ / Min)',
      klap: 'Pro Quellminute (0,290 $ / Min)',
      submagic: 'Strikte Videolimits (0,17 $ - 0,33 $)',
    },
    rowArabic: {
      feature: 'Arabische Untertitel & RTL',
      clipzila: 'Natives RTL · 18 Stile · Luxury Gold',
      opus: 'Einfache Übersetzung · Wenige Schriftarten',
      klap: 'Nur Englisch · Mangelhaftes RTL',
      submagic: 'Eingeschränkte Templates',
    },
    rowSplit: {
      feature: '2-Personen Podcast-Split-Screen',
      clipzila: 'Automatische Sprechererkennung & Split',
      opus: 'Nur Einzelperson-Crop',
      klap: 'Nur Center-Crop',
      submagic: 'Manuelle Bearbeitung nötig',
    },
    rowWhop: {
      feature: 'Whop & Kampagnen-Hub',
      clipzila: 'Direkte Kampagnenlink-Verarbeitung',
      opus: 'Nicht vorhanden (nur YouTube)',
      klap: 'Nicht vorhanden',
      submagic: 'Nicht vorhanden',
    },
    bestForHeading: 'Clipzila ist ideal für:',
    bestForText:
      'Creator, die regelmäßig Kurzvideos für TikTok, Reels und Shorts produzieren; Podcaster, die automatische Splitscreen-Ausschnitte benötigen; internationale und arabischsprachige Kanäle; sowie Clipper in Whop- und TikTok-Creator-Reward-Programmen.',
    notBestForHeading: 'Clipzila ist nicht gedacht für:',
    notBestForText:
      'Komplexen Langform-Videoschnitt mit manuellen Mehrspur-Timelines, szenischen Farbkorrekturen oder aufwendigen manuellen Spezialeffekten. Clipzila ist auf maximale Effizienz im Kurzvideo-Bereich spezialisiert.',
  },
  pricingSection: {
    badge: 'Transparenz & Fairness',
    h1: 'Einfache Preise. 1 Credit = 1 fertiges Video.',
    subtitle:
      'Keine versteckten Minutenzähler oder unvorhersehbare Abrechnungen. Jeder Credit liefert ein vollständiges, untertiteltes 1080p-Video bereit zur Veröffentlichung.',
    flatModelNote: 'Alle Pläne beinhalten sämtliche 18 Untertitelstile, KI-Gesichtserkennung und 1080p-Exporte mit hoher Bitrate.',
    freeName: 'Kostenlose Testphase',
    freePrice: '0 $',
    freePeriod: 'dauerhaft',
    freeCredits: '5 Gratis-Credits zum Testen',
    basicName: 'Basic',
    basicPrice: '15 $',
    basicPeriod: '/ Monat',
    basicCredits: '50 Credits / Monat (0,30 $ / Video)',
    starterName: 'Starter',
    starterPrice: '29 $',
    starterPeriod: '/ Monat',
    starterCredits: '120 Credits / Monat (0,24 $ / Video)',
    proName: 'Pro Creator',
    proPrice: '59 $',
    proPeriod: '/ Monat',
    proCredits: '400 Credits / Monat (0,14 $ / Video)',
    packsTitle: 'Einmalige Credit-Pakete (Kein Abonnement erforderlich)',
    pack50: '50 Credits — 18 $ (0,36 $ / Credit)',
    pack150: '150 Credits — 35 $ (0,23 $ / Credit · Beliebteste Wahl)',
    pack500: '500 Credits — 89 $ (0,17 $ / Credit · Bester Wert)',
  },
  faqs: [
    {
      question: 'Wie unterscheidet sich Clipzila von Opus Clip und Klap?',
      answer:
        'Clipzila berechnet feste 1 Credit pro fertigem Video anstatt nach Originalminuten. Wenn du einen 45-minütigen Podcast hochlädst und 3 Clips erstellst, zahlst du 3 Credits (ca. 0,45 $ bis 0,57 $) statt 45 teurer Verarbeitungsminuten. Zudem bietet Clipzila exzellente arabische Schriftarten, Podcast-Splitscreens und Whop-Integration.',
    },
    {
      question: 'Welche Plattformen und Formate werden unterstützt?',
      answer:
        'Clipzila unterstützt YouTube-Links (öffentlich und ungelistet), direkte MP4/MOV-Uploads vom Computer oder Smartphone sowie Links von Whop Content Rewards. Ausgabeformate sind 9:16 (TikTok, Reels, Shorts), 1:1 (Instagram Feed, LinkedIn) und 16:9 (YouTube).',
    },
    {
      question: 'Wie präzise ist die KI-Transkription?',
      answer:
        'Dank Whisper Large v3 Turbo auf schnellen Groq-Servern erzielt Clipzila über 98,4 % Wortgenauigkeit mit millisekundengenauen Zeitstempeln für dynamische Karaoke-Animationen.',
    },
    {
      question: 'Was passiert, wenn ein Verarbeitungsauftrag fehlschlägt?',
      answer:
        'Sollte ein Video aufgrund fehlerhafter Quelldaten nicht verarbeitet werden können, wird der reservierte Credit sofort und automatisch deinem Guthaben gutgeschrieben.',
    },
    {
      question: 'Kann ich mein Abonnement jederzeit kündigen oder ändern?',
      answer:
        'Ja. Du kannst dein Abonnement jederzeit über das Stripe-Kundenportal in deinen Kontoeinstellungen upgraden, downgraden oder kündigen. Nicht genutzte Credits bleiben bis zum Ende der Periode erhalten.',
    },
  ],
  footer: {
    rights: 'Alle Rechte vorbehalten.',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutzerklärung',
    refund: 'Rückerstattungsrichtlinie',
  },
}
