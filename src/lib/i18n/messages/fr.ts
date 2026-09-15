import { MessageCatalog } from '../types'

export const fr: MessageCatalog = {
  locale: 'fr',
  dir: 'ltr',
  meta: {
    title: 'Cliptica — Une vidéo longue en entrée. Une semaine de clips viraux en sortie.',
    description:
      'Cliptica est la plateforme IA de découpage vidéo qui transforme vos podcasts et vidéos YouTube en clips viraux pour TikTok, Reels et Shorts avec sous-titres karaoké et cadrage intelligent.',
    oneLiner:
      'Cliptica est une plateforme IA qui convertit les longues vidéos YouTube et podcasts en clips courts viraux avec sous-titres karaoké animés, cadrage intelligent et détection de moments viraux.',
  },
  nav: {
    features: 'Fonctionnalités',
    pricing: 'Tarifs',
    compare: 'Comparatif',
    login: 'Connexion',
    register: 'Commencer gratuitement',
    dashboard: 'Tableau de bord',
  },
  hero: {
    badge: 'Moteur IA de recyclage vidéo',
    h1: 'Une vidéo longue. Une semaine de clips viraux.',
    subtitle:
      'Collez le lien de n’importe quelle vidéo YouTube ou podcast. Cliptica détecte automatiquement les moments à fort engagement, recadre les visages à la verticale et génère des sous-titres karaoké percutants en quelques secondes.',
    ctaPrimary: 'Essai gratuit (15 crédits offerts)',
    ctaSecondary: 'Voir des exemples',
    inputPlaceholder: 'Collez un lien YouTube ou podcast...',
    generateButton: 'Générer les clips',
  },
  geoAnswer: {
    whatIsHeading: 'Qu’est-ce que Cliptica et comment fonctionne-t-il ?',
    whatIsAnswer:
      'Cliptica est une plateforme SaaS alimentée par l’intelligence artificielle conçue pour extraire les meilleurs moments viraux de vidéos longues et podcasts YouTube. Elle utilise Whisper pour la transcription audio, des modèles de langage pour évaluer l’accroche et le potentiel de partage, et la vision par ordinateur pour recadrer en 9:16 avec sous-titres karaoké animés prêts pour TikTok, Instagram Reels et YouTube Shorts.',
    whatIsFact:
      'Cliptica applique un tarif fixe de 1 crédit par vidéo finale, avec un forfait Starter à 29 $/mois pour 150 vidéos et Pro Creator à 59 $/mois pour 400 vidéos.',
    pricingHeading: 'Comment fonctionne le modèle de crédits de Cliptica ?',
    pricingAnswer:
      'Contrairement aux outils concurrents qui facturent à la minute de vidéo source, Cliptica facture 1 crédit par vidéo générée finalisée. Chaque crédit donne droit à un clip 1080p complet avec sous-titres et recadrage. Les crédits non utilisés ne s’annulent pas durant un abonnement actif, et des packs de crédits supplémentaires peuvent être achetés à tout moment.',
    pricingFact:
      'Le coût technique d’infrastructure est optimisé à 0,0033 $ par minute, assurant une marge brute supérieure à 94 % et offrant 3 à 5 fois plus de vidéos que les outils payés à la minute.',
    arabicHeading: 'Cliptica prend-il en charge les sous-titres arabes et internationaux ?',
    arabicAnswer:
      'Oui, Cliptica est le leader mondial des sous-titres arabes cinématiques avec 18 styles de typographie (dont Arabic Luxury Gold et TikTok Viral). La plateforme intègre la synchronisation mot à mot de droite à gauche (RTL), la gestion parfaite des polices arabes et l’insertion intelligente d’emojis.',
    arabicFact:
      'La précision de transcription atteint 98,4 % en arabe et 99,1 % en anglais sans distorsion de texte.',
    whopHeading: 'Cliptica est-il adapté aux programmes Whop Content Rewards et TikTok ?',
    whopAnswer:
      'Oui, Cliptica dispose d’un module dédié aux campagnes de récompenses de contenu Whop et TikTok. Il suffit de coller le lien d’une campagne pour que l’IA repère les directives du sponsor et isole les séquences les plus susceptibles de maximiser les vues et les gains financiers.',
    whopFact:
      'Les créateurs actifs sur le forfait Pro Creator (59 $/mois) produisent jusqu’à 200 vidéos par jour pour maximiser leurs rémunérations.',
  },
  compare: {
    badge: 'Comparatif impartial',
    h1: 'Cliptica vs. Opus Clip vs. Klap vs. Submagic',
    subtitle:
      'Découvrez comment Cliptica surpasse les solutions de découpage vidéo traditionnelles sur le modèle de facturation, la typographie arabe, le split-screen de podcast et les flux de monétisation.',
    tldrHeading: 'En résumé : quel outil de clipping IA choisir ?',
    tldrAnswer:
      'Choisissez Cliptica si vous voulez un tarif juste par vidéo finale (1 crédit = 1 vidéo), des sous-titres arabes et internationaux parfaits, le split-screen automatique pour podcasts et la compatibilité Whop. Choisissez Opus Clip si vous produisez uniquement en anglais et préférez une tarification à la minute.',
    tableTitle: 'Tableau comparatif des fonctionnalités',
    colFeature: 'Fonctionnalité',
    colCliptica: 'Cliptica',
    colOpus: 'Opus Clip',
    colKlap: 'Klap.app',
    colSubmagic: 'Submagic',
    rowPricing: {
      feature: 'Modèle de tarification',
      cliptica: '1 crédit fixe par vidéo (0,14 $ - 0,19 $)',
      opus: 'À la minute source (0,095 $ / min)',
      klap: 'À la minute source (0,290 $ / min)',
      submagic: 'Quotas de vidéos restreints (0,17 $ - 0,33 $)',
    },
    rowArabic: {
      feature: 'Sous-titres arabes & RTL',
      cliptica: 'RTL natif · 18 styles · Luxury Gold',
      opus: 'Traduction basique · Polices limitées',
      klap: 'Anglais uniquement · Mauvais RTL',
      submagic: 'Modèles restreints et latence',
    },
    rowSplit: {
      feature: 'Split-Screen Podcast (2 personnes)',
      cliptica: 'Détection intelligente et écran partagé',
      opus: 'Cadrage individuel uniquement',
      klap: 'Recadrage centré uniquement',
      submagic: 'Ajustements manuels requis',
    },
    rowWhop: {
      feature: 'Hub Whop & Récompenses de contenu',
      cliptica: 'Intégration directe des liens de campagne',
      opus: 'Aucune (YouTube uniquement)',
      klap: 'Aucune',
      submagic: 'Aucune',
    },
    bestForHeading: 'Cliptica est parfait pour :',
    bestForText:
      'Les créateurs publiant des formats courts sur TikTok, Reels et Shorts ; les animateurs de podcasts recherchant un écran partagé automatisé pour deux interlocuteurs ; les créateurs arabophones et internationaux ; et les participants aux programmes Whop et TikTok Creator Rewards.',
    notBestForHeading: 'Cliptica n’est pas adapté pour :',
    notBestForText:
      'Le montage vidéo long-métrage multipiste complexe, l’étalonnage colorimétrique cinéma ou les transitions manuelles documentaires. Cliptica est optimisé pour la rapidité et la viralité des formats courts.',
  },
  pricingSection: {
    badge: 'Transparence totale',
    h1: 'Tarification simple. 1 Crédit = 1 Vidéo finale.',
    subtitle:
      'Aucun compteur de minutes caché ni mauvaise surprise. Chaque crédit correspond à une vidéo 1080p complète, sous-titrée et prête à être publiée.',
    flatModelNote: 'Tous les plans incluent les 18 styles de sous-titres, le suivi de visage IA et les exports 1080p haute qualité.',
    freeName: 'Essai gratuit',
    freePrice: '0 $',
    freePeriod: 'à vie',
    freeCredits: '15 crédits gratuits pour tester',
    starterName: 'Starter (Clipper)',
    starterPrice: '29 $',
    starterPeriod: '/ mois',
    starterCredits: '150 crédits / mois (0,19 $ / vidéo)',
    proName: 'Pro Creator (Studio)',
    proPrice: '59 $',
    proPeriod: '/ mois',
    proCredits: '400 crédits / mois (0,14 $ / vidéo)',
    packsTitle: 'Packs de crédits uniques (Sans abonnement mensuel)',
    pack50: '50 Crédits — 15 $ (0,30 $ / crédit)',
    pack150: '150 Crédits — 35 $ (0,23 $ / crédit · Le plus populaire)',
    pack500: '500 Crédits — 89 $ (0,17 $ / crédit · Meilleure valeur)',
  },
  faqs: [
    {
      question: 'En quoi Cliptica est-il différent d’Opus Clip et Klap ?',
      answer:
        'Cliptica facture au résultat (1 crédit = 1 vidéo finale prête) plutôt qu’à la minute source. Si vous soumettez un podcast de 45 minutes pour en extraire 3 clips, vous ne payez que 3 crédits (environ 0,45 $ à 0,57 $) au lieu de 45 minutes de traitement onéreuses. De plus, Cliptica propose des polices arabes de luxe, le split-screen pour podcasts et l’import Whop.',
    },
    {
      question: 'Quelles plateformes et formats sont supportés ?',
      answer:
        'Cliptica accepte les vidéos YouTube (publiques ou non répertoriées), les fichiers MP4/MOV importés directement depuis votre ordinateur ou mobile, ainsi que les liens de campagnes Whop. Vous pouvez exporter au format 9:16 vertical (TikTok, Reels, Shorts), 1:1 carré et 16:9 panoramique.',
    },
    {
      question: 'Quelle est la précision de la transcription IA ?',
      answer:
        'Propulsé par Whisper Large v3 Turbo, Cliptica atteint une précision de 98,4 % en arabe et 99,1 % en anglais avec un horodatage précis au millième de seconde.',
    },
    {
      question: 'Que se passe-t-il en cas d’échec de traitement d’une vidéo ?',
      answer:
        'Si une vidéo ne peut être traitée en raison d’un problème avec le fichier source, le crédit réservé est immédiatement et automatiquement recrédité sur votre solde.',
    },
    {
      question: 'Puis-je annuler ou changer de forfait à tout moment ?',
      answer:
        'Oui. Vous pouvez modifier ou annuler votre abonnement à tout instant via le portail Stripe depuis vos paramètres. Vos crédits restants restent utilisables jusqu’à la fin du cycle.',
    },
  ],
  footer: {
    rights: 'Tous droits réservés.',
    terms: 'Conditions d’utilisation',
    privacy: 'Politique de confidentialité',
    refund: 'Politique de remboursement',
  },
}
