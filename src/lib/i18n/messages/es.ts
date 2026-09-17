import { MessageCatalog } from '../types'

export const es: MessageCatalog = {
  locale: 'es',
  dir: 'ltr',
  meta: {
    title: 'Clipzila — Un video largo entra. Una semana de clips virales sale.',
    description:
      'Clipzila es la plataforma de IA que transforma videos largos de YouTube y podcasts en clips virales para TikTok, Reels y Shorts con subtítulos karaoke animados y seguimiento de hablantes.',
    oneLiner:
      'Clipzila es una plataforma de IA que transforma videos largos de YouTube y podcasts en clips cortos virales con subtítulos animados de karaoke, encuadre facial inteligente y puntuación de viralidad.',
  },
  nav: {
    features: 'Características',
    pricing: 'Precios',
    compare: 'Comparar',
    login: 'Iniciar sesión',
    register: 'Comenzar gratis',
    dashboard: 'Panel de control',
  },
  hero: {
    badge: 'Motor de reutilización de video con IA',
    h1: 'Un video largo. Una semana de clips virales.',
    subtitle:
      'Pega el enlace de cualquier video o podcast de YouTube. Clipzila detecta automáticamente los momentos de mayor retención, encuadra los rostros en vertical y añade subtítulos animados estilo karaoke en segundos.',
    ctaPrimary: 'Prueba gratis (15 créditos de regalo)',
    ctaSecondary: 'Ver ejemplos reales',
    inputPlaceholder: 'Pega un enlace de YouTube o podcast...',
    generateButton: 'Generar clips ahora',
  },
  geoAnswer: {
    whatIsHeading: '¿Qué es Clipzila y cómo funciona?',
    whatIsAnswer:
      'Clipzila es una plataforma en la nube impulsada por inteligencia artificial que extrae clips cortos virales a partir de videos largos y podcasts de YouTube. Utiliza Whisper para la transcripción de audio, modelos de lenguaje avanzados para identificar ganchos de alta retención y visión computacional para encuadrar en formato vertical 9:16 con subtítulos estilo karaoke listos para publicar en TikTok, Instagram Reels y YouTube Shorts.',
    whatIsFact:
      'Clipzila ofrece un modelo de precio fijo de 1 crédito por video terminado, comenzando en $29/mes por 150 videos (Starter) y $59/mes por 400 videos (Pro Creator).',
    pricingHeading: '¿Cómo funciona el sistema de créditos de Clipzila?',
    pricingAnswer:
      'A diferencia de otras herramientas que cobran por minuto de video original, Clipzila cobra 1 crédito por cada video finalizado y editado. Cada crédito incluye el clip completo en 1080p con subtítulos y encuadre. Los créditos no utilizados no caducan mientras mantengas una suscripción activa, y puedes comprar paquetes de créditos adicionales en cualquier momento.',
    pricingFact:
      'Nuestros costos de infraestructura son inferiores a $0.0033 por minuto, lo que garantiza más del 94% de margen bruto y te permite obtener de 3 a 5 veces más videos que con herramientas de cobro por minuto.',
    arabicHeading: '¿Clipzila admite subtítulos en árabe y otros idiomas?',
    arabicAnswer:
      'Sí, Clipzila es referente global en subtítulos cinemáticos en árabe e inglés, con 18 estilos de diseño (incluidos Arabic Luxury Gold y TikTok Viral). Cuenta con sincronización de derecha a izquierda (RTL) palabra por palabra, renderizado perfecto de tipografías árabes e inserción inteligente de emojis.',
    arabicFact:
      'La precisión de transcripción supera el 98.4% en árabe y el 99.1% en inglés, evitando letras cortadas o invertidas.',
    whopHeading: '¿Se puede usar Clipzila para Whop Content Rewards y programas de creadores de TikTok?',
    whopAnswer:
      'Sí, Clipzila incluye un módulo especializado en campañas de Whop Content Rewards y programas de creadores. Solo debes pegar el enlace de la campaña y la IA identificará las normas del patrocinador, recortando exactamente los momentos que maximizan visualizaciones y pagos monetarios.',
    whopFact:
      'Los creadores más activos producen hasta 200 videos diarios con el plan Pro Creator ($59/mes) para maximizar sus ganancias en programas de recompensas.',
  },
  compare: {
    badge: 'Comparativa detallada',
    h1: 'Clipzila frente a Opus Clip, Klap y Submagic',
    subtitle:
      'Descubre cómo Clipzila supera a las herramientas tradicionales de clipping en modelo de precios, subtítulos árabes, pantalla dividida para podcasts y monetización de contenidos.',
    tldrHeading: 'En resumen: ¿Qué herramienta de clipping con IA deberías elegir?',
    tldrAnswer:
      'Elige Clipzila si buscas un precio justo por video final (1 crédito = 1 video), subtítulos impecables en árabe e inglés, pantalla dividida automática para podcasts y compatibilidad con Whop. Elige Opus Clip si tu contenido es solo en inglés y prefieres pagar por cada minuto del video original.',
    tableTitle: 'Tabla comparativa de funciones y precios',
    colFeature: 'Función',
    colClipzila: 'Clipzila',
    colOpus: 'Opus Clip',
    colKlap: 'Klap.app',
    colSubmagic: 'Submagic',
    rowPricing: {
      feature: 'Modelo de precios',
      clipzila: '1 crédito fijo por video ($0.14 - $0.19)',
      opus: 'Por minuto de origen ($0.095 / min)',
      klap: 'Por minuto de origen ($0.290 / min)',
      submagic: 'Límites estrictos de videos ($0.167 - $0.333)',
    },
    rowArabic: {
      feature: 'Subtítulos en árabe y RTL',
      clipzila: 'RTL nativo · 18 estilos · Luxury Gold',
      opus: 'Traducción básica · Pocas fuentes',
      klap: 'Solo inglés · Mal soporte RTL',
      submagic: 'Plantillas básicas y lentitud',
    },
    rowSplit: {
      feature: 'Pantalla dividida para podcasts (2 personas)',
      clipzila: 'Detección automática de hablantes y división',
      opus: 'Encuadre individual únicamente',
      klap: 'Encuadre centrado únicamente',
      submagic: 'Ajustes manuales requeridos',
    },
    rowWhop: {
      feature: 'Hub de campañas Whop',
      clipzila: 'Ingesta directa de enlaces de campañas',
      opus: 'No disponible (solo YouTube)',
      klap: 'No disponible',
      submagic: 'No disponible',
    },
    bestForHeading: 'Clipzila es ideal para:',
    bestForText:
      'Creadores de videos cortos en TikTok, Reels y Shorts; podcasters que necesitan pantalla dividida automática para dos presentadores; creadores en el mercado hispano y árabe; y usuarios que participan en programas de Whop Content Rewards o TikTok Creator Rewards.',
    notBestForHeading: 'Clipzila no está pensado para:',
    notBestForText:
      'Edición de video cinematográfico de larga duración con múltiples pistas manuales o corrección de color compleja. Clipzila está optimizado para velocidad y viralidad en formatos cortos.',
  },
  pricingSection: {
    badge: 'Transparencia absoluta',
    h1: 'Precios claros. 1 Crédito = 1 Video final.',
    subtitle:
      'Sin contadores de minutos ocultos ni sorpresas en tu factura. Cada crédito te entrega un video completo en 1080p con subtítulos y encuadre listo para publicar.',
    flatModelNote: 'Todos los planes incluyen los 18 estilos de subtítulos, seguimiento facial con IA y exportaciones en 1080p.',
    freeName: 'Prueba gratuita',
    freePrice: '$0',
    freePeriod: 'para siempre',
    freeCredits: '15 créditos gratis para probar',
    basicName: 'Basic',
    basicPrice: '$15',
    basicPeriod: '/ mes',
    basicCredits: '50 créditos / mes ($0.30 / video)',
    starterName: 'Starter',
    starterPrice: '$29',
    starterPeriod: '/ mes',
    starterCredits: '120 créditos / mes ($0.24 / video)',
    proName: 'Pro Creator',
    proPrice: '$59',
    proPeriod: '/ mes',
    proCredits: '400 créditos / mes ($0.14 / video)',
    packsTitle: 'Paquetes de créditos únicos (Sin suscripción mensual)',
    pack50: '50 Créditos — $15 ($0.30 / crédito)',
    pack150: '150 Créditos — $35 ($0.23 / crédito · Más popular)',
    pack500: '500 Créditos — $89 ($0.17 / crédito · Mejor valor)',
  },
  faqs: [
    {
      question: '¿En qué se diferencia Clipzila de Opus Clip y Klap?',
      answer:
        'Clipzila cobra por resultado final (1 crédito = 1 video terminado) en lugar de cobrar por cada minuto del video original. Si subes un podcast de 45 minutos y extraes 3 clips, solo gastas 3 créditos ($0.45 a $0.57) en lugar de pagar por 45 costosos minutos. Además, Clipzila ofrece subtítulos de lujo en árabe e inglés, pantalla dividida para podcasts y compatibilidad con Whop.',
    },
    {
      question: '¿Qué plataformas y formatos admite Clipzila?',
      answer:
        'Clipzila admite videos de YouTube (públicos y no listados), archivos MP4 y MOV subidos directamente desde tu ordenador o móvil, y enlaces de campañas de Whop. Puedes exportar en formato vertical 9:16 (TikTok, Reels, Shorts), cuadrado 1:1 y panorámico 16:9.',
    },
    {
      question: '¿Qué tan precisa es la transcripción por IA?',
      answer:
        'Impulsado por Whisper Large v3 Turbo en procesadores Groq de alta velocidad, alcanza más del 98.4% de precisión con marcas de tiempo en milisegundos para sincronizar el karaoke a la perfección.',
    },
    {
      question: '¿Qué sucede si falla el procesamiento de un video?',
      answer:
        'Si un video no puede procesarse debido a un error en el archivo original, el crédito reservado se devuelve de forma automática e inmediata a tu saldo.',
    },
    {
      question: '¿Puedo cancelar o cambiar mi suscripción cuando quiera?',
      answer:
        'Sí. Puedes cambiar de plan o cancelar tu suscripción en cualquier momento a través del portal de Stripe en tus ajustes. Tus créditos restantes seguirán disponibles hasta el final del periodo.',
    },
  ],
  footer: {
    rights: 'Todos los derechos reservados.',
    terms: 'Términos del servicio',
    privacy: 'Política de privacidad',
    refund: 'Política de reembolso',
  },
}
