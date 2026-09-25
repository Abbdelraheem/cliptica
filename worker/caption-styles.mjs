/**
 * Presets and ASS subtitle generation for CLIPZILA.
 * All presets are locked to a fixed lower-third safe zone (posYRatio: 0.82, bottom-center alignment: 2)
 * so captions never cover the speaker's face/character or jump around the frame.
 */

export const FIXED_CAPTION_Y_RATIO = 0.82

export const CAPTION_STYLES = {
  // === KINETIC CATEGORY ===
  hormozi: {
    id: 'hormozi',
    name: 'Hormozi Pop',
    category: 'Kinetic',
    desc: 'Punchy 1-3 word cards locked in the lower-third safe zone.',
    sample: 'STOP SCROLLING',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.058,
    primaryColor: '&H00FFFFFF', // White
    outlineColor: '&H00000000', // Black
    backColor: '&HB4000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.010,
    shadow: 2,
    alignment: 2, // Fixed Bottom-Center
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: false,
    buildAnimation: () =>
      `\\fad(40,40)\\t(0,80,\\fscx106\\fscy106)\\t(80,160,\\fscx100\\fscy100)`,
  },

  bold_impact: {
    id: 'bold_impact',
    name: 'Bold Impact',
    category: 'Kinetic',
    desc: 'Heavy uppercase text, golden yellow fill, thick outline in lower-third safe zone.',
    sample: 'MUST WATCH THIS',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.060,
    primaryColor: '&H0000D7FF', // Golden Yellow (BBGGRR: RR=FF, GG=D7, BB=00)
    outlineColor: '&H00000000', // Deep Black
    backColor: '&H00000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.012,
    shadow: 3,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(30,30)`,
  },

  bounce_side: {
    id: 'bounce_side',
    name: 'Side Bounce',
    category: 'Kinetic',
    desc: 'Crisp flame-orange kinetic captions locked in the lower-third safe zone.',
    sample: 'FAST ACTION',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.058,
    primaryColor: '&H001F5AFF', // Flame Orange (BBGGRR: RR=FF, GG=5A, BB=1F)
    outlineColor: '&H00000000',
    backColor: '&H90000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.011,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () =>
      `\\fad(40,40)\\t(0,90,\\fscx106\\fscy106)\\t(90,170,\\fscx100\\fscy100)`,
  },

  pill_box: {
    id: 'pill_box',
    name: 'Pill Box',
    category: 'Kinetic',
    desc: 'Clean white typography encapsulated in a sleek dark obsidian pill badge.',
    sample: 'KEY TAKEAWAY',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.054,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00302010',
    backColor: '&HD0181410', // Obsidian slate pill backdrop
    bold: -1,
    borderStyle: 3, // Opaque box
    outlineRatio: 0.012,
    shadow: 0,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(40,40)`,
  },

  tiktok_classic: {
    id: 'tiktok_classic',
    name: 'TikTok Big Word',
    category: 'Kinetic',
    desc: 'High-retention punchy words anchored cleanly in the lower-third safe zone.',
    sample: 'VIRAL',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.062,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.012,
    shadow: 3,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 2,
    uppercase: true,
    buildAnimation: () => `\\fad(30,30)\\t(0,60,\\fscx108\\fscy108)\\t(60,130,\\fscx100\\fscy100)`,
  },

  // === EDITORIAL CATEGORY ===
  clean_minimal: {
    id: 'clean_minimal',
    name: 'Clean Minimal',
    category: 'Editorial',
    desc: 'Understated lower-third phrase layout with subtle fade, no bounce.',
    sample: 'The simplest ideas win.',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.050,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00111111',
    backColor: '&H80000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.006,
    shadow: 1,
    alignment: 2, // Bottom Center
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 4,
    uppercase: false,
    buildAnimation: () => `\\fad(60,60)`,
  },

  classic_subtitle: {
    id: 'classic_subtitle',
    name: 'Classic Subtitle',
    category: 'Editorial',
    desc: 'Documentary style, natural sentence lines at bottom safe zone.',
    sample: 'Every detail was planned in advance.',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.048,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H60000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.006,
    shadow: 1,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 5,
    uppercase: false,
    buildAnimation: () => '',
  },

  slow_fade: {
    id: 'slow_fade',
    name: 'Slow Fade',
    category: 'Editorial',
    desc: 'Gentle breathing fade with warm ivory serif typography for calm, thoughtful pacing.',
    sample: 'Reflections on what matters.',
    fontName: 'DejaVu Serif',
    fontSizeRatio: 0.052,
    primaryColor: '&H00E8F0F8', // Warm Ivory
    outlineColor: '&H00181820',
    backColor: '&H70000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.006,
    shadow: 1,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 4,
    uppercase: false,
    buildAnimation: () => `\\fad(140,120)`,
  },

  cinematic_caps: {
    id: 'cinematic_caps',
    name: 'Cinematic Caps',
    category: 'Editorial',
    desc: 'Widescreen letterbox aesthetic with tracked letter-spacing and silver luminescence.',
    sample: 'A NEW HORIZON BECKONS',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.048,
    primaryColor: '&H00E8E8EC', // Silver White
    outlineColor: '&H00101010',
    backColor: '&H90000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.007,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 4,
    uppercase: true,
    buildAnimation: () => `\\fad(90,90)\\fsp3`,
  },

  podcast_soft: {
    id: 'podcast_soft',
    name: 'Podcast Soft',
    category: 'Editorial',
    desc: 'Warm peach-cream tones with friendly rounded geometry and comfortable dialog cadence.',
    sample: 'Here is what they never tell you.',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.054,
    primaryColor: '&H00A0D8FF', // Soft Peach-Cream (BBGGRR: RR=FF, GG=D8, BB=A0)
    outlineColor: '&H00181420',
    backColor: '&H70201828',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.008,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 4,
    uppercase: false,
    buildAnimation: () => `\\fad(70,70)`,
  },

  // === CREATIVE / EXPRESSIVE CATEGORY ===
  neon_highlight: {
    id: 'neon_highlight',
    name: 'Neon Highlight',
    category: 'Creative',
    desc: 'Electric cyan text with magenta shadow glow in the lower-third safe zone.',
    sample: 'PURE ENERGY',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.058,
    primaryColor: '&H00FFFF00', // Electric Cyan (BBGGRR)
    outlineColor: '&H00200030', // Deep Plum
    backColor: '&H00FF0080',    // Neon Pink/Magenta shadow
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.009,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(50,50)`,
  },

  highlighter: {
    id: 'highlighter',
    name: 'Highlighter',
    category: 'Creative',
    desc: 'Marker box backdrop with high contrast black lettering.',
    sample: 'HIGHLIGHTED TRUTH',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.054,
    primaryColor: '&H00000000', // Black text
    outlineColor: '&H00000000',
    backColor: '&H0020E6FF',    // Vibrant Yellow-Orange marker box (BBGGRR)
    bold: -1,
    borderStyle: 3,             // Opaque background box
    outlineRatio: 0.010,
    shadow: 0,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(40,40)`,
  },

  typewriter: {
    id: 'typewriter',
    name: 'Typewriter',
    category: 'Creative',
    desc: 'Retro mechanical monospace with terminal green tint and crisp cadence.',
    sample: 'system.init()',
    fontName: 'DejaVu Sans Mono',
    fontSizeRatio: 0.050,
    primaryColor: '&H0050FF50', // Terminal Matrix Green (BBGGRR: RR=50, GG=FF, BB=50)
    outlineColor: '&H00000000',
    backColor: '&HC0121612',    // Dark terminal container box
    bold: -1,
    borderStyle: 3,
    outlineRatio: 0.009,
    shadow: 0,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: false,
    buildAnimation: () => `\\fad(20,20)`,
  },

  two_tone: {
    id: 'two_tone',
    name: 'Two-Tone Alternate',
    category: 'Creative',
    desc: 'Contrasting dual-color cadence alternating between brilliant gold and crisp pearl.',
    sample: 'BREAK THE PATTERN',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.058,
    primaryColor: '&H00FFFFFF', // White base
    outlineColor: '&H00000000',
    backColor: '&H0000D7FF',    // Gold highlight
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.010,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(40,40)`,
  },

  glitch_flicker: {
    id: 'glitch_flicker',
    name: 'Glitch Accent',
    category: 'Creative',
    desc: 'High-energy cyber-pink and cyan captions anchored in the lower-third safe zone.',
    sample: 'GLITCH IN REALITY',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.058,
    primaryColor: '&H00FF32C8', // Electric Cyber Pink (BBGGRR: RR=C8, GG=32, BB=FF)
    outlineColor: '&H00FFFF00', // Cyan outline (BBGGRR: RR=00, GG=FF, BB=FF)
    backColor: '&H00000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.011,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(30,30)`,
  },

  // === ARABIC & REGIONAL CATEGORY ===
  arabic_luxury: {
    id: 'arabic_luxury',
    name: 'Arabic Luxury',
    category: 'Arabic',
    desc: 'Royal champagne & gold kinetic typography anchored in the lower-third safe zone.',
    sample: 'SECRET OF SUCCESS',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.058,
    primaryColor: '&H00E8F0F8', // Pearl White
    outlineColor: '&H00080810', // Deep obsidian
    backColor: '&H0000D7FF',    // Gold highlight
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.011,
    shadow: 2,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: false,
    buildAnimation: () => `\\fad(40,40)`,
  },

  arabic_viral: {
    id: 'arabic_viral',
    name: 'Arabic Viral Impact',
    category: 'Arabic',
    desc: 'High-contrast yellow on black outline anchored in the lower-third safe zone.',
    sample: 'WAIT FOR THIS!',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.060,
    primaryColor: '&H0000D7FF', // Golden Yellow
    outlineColor: '&H00000000', // Pitch Black
    backColor: '&HB4000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.012,
    shadow: 3,
    alignment: 2,
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 3,
    uppercase: false,
    buildAnimation: () => `\\fad(30,30)`,
  },

  arabic_clean: {
    id: 'arabic_clean',
    name: 'Arabic Clean Minimal',
    category: 'Arabic',
    desc: 'Elegant lower-third phrase layout with subtle fade, ideal for podcasts and interviews.',
    sample: 'WHAT NOBODY TELLS YOU',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.052,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00151515',
    backColor: '&H70000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.007,
    shadow: 2,
    alignment: 2, // Bottom Center
    posYRatio: FIXED_CAPTION_Y_RATIO,
    wordsPerCard: 4,
    uppercase: false,
    buildAnimation: () => `\\fad(60,60)`,
  },
}

const ARABIC_HYPE = new Set([
  'تخيل', 'الصدمة', 'صدمة', 'سر', 'السر', 'أخيرا', 'أخيراً', 'مستحيل', 'كارثة', 'رهيب', 'خطير',
  'فلوس', 'ارباح', 'أرباح', 'ثروة', 'ركز', 'انتبه', 'دقيقة', 'شاهد', 'شوف', 'فضيحة',
  'حقيقة', 'معلومة', 'قنبلة', 'مهم', 'ياجماعة', 'اسمع'
])

const REACTION_STICKERS = [
  { words: ['فلوس', 'ارباح', 'أرباح', 'ثروة', 'دولار', 'money', 'dollar', 'cash', 'rich', 'profit'], emoji: '💰' },
  { words: ['صاروخ', 'انفجار', 'انطلق', 'rocket', 'moon', 'growth', 'fast', 'سرعة'], emoji: '🚀' },
  { words: ['نار', 'حريقة', 'ولعت', 'fire', 'hot', 'viral', 'رهيب', 'أسطوري'], emoji: '🔥' },
  { words: ['انتبه', 'احذر', 'خطر', 'كارثة', 'warning', 'danger', 'stop', 'إياك'], emoji: '⚠️' },
  { words: ['فكرة', 'سر', 'السر', 'حل', 'idea', 'secret', 'smart', 'ذكاء'], emoji: '💡' },
  { words: ['ملايين', 'مليون', 'أرقام', 'نمو', 'chart', 'upgrade', 'مبيعات'], emoji: '📈' },
]

function findStickerForText(text) {
  const norm = text.toLowerCase().replace(/^[^\w\u0600-\u06FF]+|[^\w\u0600-\u06FF]+$/g, '')
  for (const s of REACTION_STICKERS) {
    if (s.words.some((w) => norm.includes(w) || w.includes(norm))) {
      return s.emoji
    }
  }
  return null
}

export function getCaptionStyle(styleId) {
  return CAPTION_STYLES[styleId] ?? CAPTION_STYLES.hormozi
}

export function tsAss(s) {
  const safe = Math.max(0, s)
  const h = Math.floor(safe / 3600)
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, '0')
  const sec = String(Math.floor(safe % 60)).padStart(2, '0')
  const cs = String(Math.floor((safe % 1) * 100)).padStart(2, '0')
  return `${h}:${m}:${sec}.${cs}`
}

export function buildAssHeader(W, H, style) {
  const fontSize = Math.round(W * style.fontSizeRatio)
  const outline = Math.round(W * style.outlineRatio)

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MainStyle,${style.fontName},${fontSize},${style.primaryColor},${style.outlineColor},${style.backColor},${style.bold},${style.borderStyle},${outline},${style.shadow},2,70,70,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
}

export function buildKaraokeAss(words, start, end, emoji = null, styleId = 'hormozi', W = 1080, H = 1920, hookHeadline = null) {
  const style = getCaptionStyle(styleId)
  const inWin = (words ?? []).filter((w) => w.end > start && w.start < end && w.text)
  if (!inWin.length) return null

  const cards = []
  let cur = []
  for (const w of inWin) {
    if (cur.length && w.start - cur[cur.length - 1].end > 0.6) {
      cards.push(cur)
      cur = []
    }
    cur.push(w)
    if (cur.length >= style.wordsPerCard) {
      cards.push(cur)
      cur = []
    }
  }
  if (cur.length) cards.push(cur)

  let events = ''
  const posX = Math.round(W / 2)
  const posY = Math.round(H * FIXED_CAPTION_Y_RATIO)

  cards.forEach((card, i) => {
    // Relative to clip start since FFmpeg cut input resets PTS to 00:00:00
    const cs = Math.max(0, card[0].start - start)
    const rawCe =
      i === cards.length - 1
        ? Math.min(card[card.length - 1].end, end)
        : Math.min(card[card.length - 1].end, cards[i + 1][0]?.start ?? end)
    const ce = Math.max(cs + 0.35, rawCe - start)

    let rawText
    if (style.id === 'two_tone') {
      rawText = card
        .map((w, idx) => {
          const clr = idx % 2 === 0 ? '\\c&H00FFFFFF&' : '\\c&H0000D7FF&'
          const wordText = w.text.replace(/[{}]/g, '')
          return `{${clr}}${style.uppercase ? wordText.toUpperCase() : wordText}`
        })
        .join(' ')
    } else {
      rawText = card
        .map((w) => {
          const cleanWord = w.text.replace(/[{}]/g, '')
          const norm = cleanWord.replace(/^[^\w\u0600-\u06FF]+|[^\w\u0600-\u06FF]+$/g, '')
          // Highlight viral Arabic hype words in brilliant gold
          if (ARABIC_HYPE.has(norm)) {
            return `{\\c&H0000D7FF&}${cleanWord}{\\c${style.primaryColor}}`
          }
          return cleanWord
        })
        .join(' ')
      if (style.uppercase) rawText = rawText.toUpperCase()
    }

    const anim = style.buildAnimation ? style.buildAnimation(W, H) : ''
    const animPart = anim ? `${anim}` : ''

    events += `Dialogue: 0,${tsAss(cs)},${tsAss(ce)},MainStyle,,0,0,0,,{\\an2${animPart}\\pos(${posX},${posY})}${rawText}\n`
  })

  return buildAssHeader(W, H, style) + events
}

export function buildPhraseAss(text, start, end, styleId = 'hormozi', W = 1080, H = 1920) {
  const style = getCaptionStyle(styleId)
  const maxLen = style.wordsPerCard > 4 ? 50 : 32
  const regex = new RegExp(`.{1,${maxLen}}(\\s|$)`, 'g')
  const lines = text.match(regex) ?? [text]
  const dur = Math.max(0.1, end - start)
  const per = dur / lines.length

  const posX = Math.round(W / 2)
  const posY = Math.round(H * FIXED_CAPTION_Y_RATIO)

  let events = ''
  lines.forEach((l, i) => {
    let t = l.trim().replace(/[{}]/g, '')
    if (style.id === 'two_tone') {
      t = t
        .split(/\s+/)
        .map((w, idx) => {
          const clr = idx % 2 === 0 ? '\\c&H00FFFFFF&' : '\\c&H0000D7FF&'
          return `{${clr}}${style.uppercase ? w.toUpperCase() : w}`
        })
        .join(' ')
    } else if (style.uppercase) {
      t = t.toUpperCase()
    }
    // Relative to clip start
    events += `Dialogue: 0,${tsAss(per * i)},${tsAss(per * (i + 1))},MainStyle,,0,0,0,,{\\an2\\pos(${posX},${posY})}${t}\n`
  })

  return buildAssHeader(W, H, style) + events
}

