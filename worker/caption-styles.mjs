/**
 * Presets and ASS subtitle generation for Cliptica.
 * Supports 15 distinct visual presets with real font, positioning,
 * color, animation, and layout differences across Kinetic, Editorial,
 * and Creative categories.
 */

export const CAPTION_STYLES = {
  // === KINETIC CATEGORY ===
  hormozi: {
    id: 'hormozi',
    name: 'Hormozi Pop',
    category: 'Kinetic',
    desc: 'Punchy 1-3 word cards with aggressive spring scale pop.',
    sample: 'STOP SCROLLING',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.082,
    primaryColor: '&H00FFFFFF', // White
    outlineColor: '&H00000000', // Black
    backColor: '&HB4000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.012,
    shadow: 2,
    alignment: 5, // Center
    posYRatio: 0.74,
    wordsPerCard: 3,
    uppercase: false,
    buildAnimation: () =>
      `\\fad(50,50)\\t(0,90,\\fscx118\\fscy118)\\t(90,180,\\fscx100\\fscy100)`,
  },

  bold_impact: {
    id: 'bold_impact',
    name: 'Bold Impact',
    category: 'Kinetic',
    desc: 'Heavy uppercase text, golden yellow fill, thick outline, center-mid screen.',
    sample: 'MUST WATCH THIS',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.092,
    primaryColor: '&H0000D7FF', // Golden Yellow (BBGGRR: RR=FF, GG=D7, BB=00)
    outlineColor: '&H00000000', // Deep Black
    backColor: '&H00000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.016,
    shadow: 4,
    alignment: 5,
    posYRatio: 0.68,
    wordsPerCard: 2,
    uppercase: true,
    buildAnimation: () => `\\fad(30,30)`,
  },

  bounce_side: {
    id: 'bounce_side',
    name: 'Side Bounce',
    category: 'Kinetic',
    desc: 'Kinetic entry sliding from the left margin with a satisfying settling bounce.',
    sample: 'FAST ACTION',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.082,
    primaryColor: '&H001F5AFF', // Flame Orange (BBGGRR: RR=FF, GG=5A, BB=1F)
    outlineColor: '&H00000000',
    backColor: '&H90000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.014,
    shadow: 3,
    alignment: 5,
    posYRatio: 0.70,
    wordsPerCard: 2,
    uppercase: true,
    buildAnimation: (W, H) => {
      const y = Math.round(H * 0.70)
      const startX = Math.round(W * 0.35)
      const endX = Math.round(W * 0.50)
      return `\\move(${startX},${y},${endX},${y},0,140)\\t(0,140,\\fscx116\\fscy116)\\t(140,220,\\fscx100\\fscy100)`
    },
  },

  pill_box: {
    id: 'pill_box',
    name: 'Pill Box',
    category: 'Kinetic',
    desc: 'Clean white typography encapsulated in a sleek dark obsidian pill badge.',
    sample: 'KEY TAKEAWAY',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.070,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00302010',
    backColor: '&HD0181410', // Obsidian slate pill backdrop
    bold: -1,
    borderStyle: 3, // Opaque box
    outlineRatio: 0.016,
    shadow: 0,
    alignment: 5,
    posYRatio: 0.75,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () => `\\fad(50,50)\\t(0,90,\\fscx112\\fscy112)\\t(90,170,\\fscx100\\fscy100)`,
  },

  tiktok_classic: {
    id: 'tiktok_classic',
    name: 'TikTok Big Word',
    category: 'Kinetic',
    desc: 'Single-word center punch at massive scale — maximum retention and visual grip.',
    sample: 'VIRAL',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.115,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.018,
    shadow: 4,
    alignment: 5, // Center-Center
    posYRatio: 0.54,
    wordsPerCard: 1,
    uppercase: true,
    buildAnimation: () => `\\t(0,60,\\fscx124\\fscy124)\\t(60,130,\\fscx100\\fscy100)`,
  },

  // === EDITORIAL CATEGORY ===
  clean_minimal: {
    id: 'clean_minimal',
    name: 'Clean Minimal',
    category: 'Editorial',
    desc: 'Understated lower-third phrase layout with subtle fade, no bounce.',
    sample: 'The simplest ideas win.',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.052,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00111111',
    backColor: '&H80000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.005,
    shadow: 1,
    alignment: 2, // Bottom Center
    posYRatio: 0.84,
    wordsPerCard: 5,
    uppercase: false,
    buildAnimation: () => `\\fad(80,80)`,
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
    posYRatio: 0.88,
    wordsPerCard: 6,
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
    fontSizeRatio: 0.056,
    primaryColor: '&H00E8F0F8', // Warm Ivory
    outlineColor: '&H00181820',
    backColor: '&H70000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.006,
    shadow: 1,
    alignment: 2,
    posYRatio: 0.82,
    wordsPerCard: 4,
    uppercase: false,
    buildAnimation: () => `\\fad(220,180)`,
  },

  cinematic_caps: {
    id: 'cinematic_caps',
    name: 'Cinematic Caps',
    category: 'Editorial',
    desc: 'Widescreen letterbox aesthetic with tracked letter-spacing and silver luminescence.',
    sample: 'A NEW HORIZON BECKONS',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.050,
    primaryColor: '&H00E8E8EC', // Silver White
    outlineColor: '&H00101010',
    backColor: '&H90000000',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.007,
    shadow: 2,
    alignment: 2,
    posYRatio: 0.88,
    wordsPerCard: 5,
    uppercase: true,
    buildAnimation: () => `\\fad(120,120)\\fsp4\\t(0,300,\\fscx102\\fscy102)`,
  },

  podcast_soft: {
    id: 'podcast_soft',
    name: 'Podcast Soft',
    category: 'Editorial',
    desc: 'Warm peach-cream tones with friendly rounded geometry and comfortable dialog cadence.',
    sample: 'Here is what they never tell you.',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.064,
    primaryColor: '&H00A0D8FF', // Soft Peach-Cream (BBGGRR: RR=FF, GG=D8, BB=A0)
    outlineColor: '&H00181420',
    backColor: '&H70201828',
    bold: 0,
    borderStyle: 1,
    outlineRatio: 0.008,
    shadow: 2,
    alignment: 5,
    posYRatio: 0.77,
    wordsPerCard: 4,
    uppercase: false,
    buildAnimation: () => `\\fad(90,90)\\t(0,100,\\fscy108)\\t(100,200,\\fscy100)`,
  },

  // === CREATIVE / EXPRESSIVE CATEGORY ===
  neon_highlight: {
    id: 'neon_highlight',
    name: 'Neon Highlight',
    category: 'Creative',
    desc: 'Electric cyan text with magenta shadow glow and expansion pulse.',
    sample: 'PURE ENERGY',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.080,
    primaryColor: '&H00FFFF00', // Electric Cyan (BBGGRR)
    outlineColor: '&H00200030', // Deep Plum
    backColor: '&H00FF0080',    // Neon Pink/Magenta shadow
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.010,
    shadow: 3,
    alignment: 5,
    posYRatio: 0.72,
    wordsPerCard: 3,
    uppercase: true,
    buildAnimation: () =>
      `\\fad(60,60)\\t(0,100,\\blur4\\fscx112\\fscy112)\\t(100,200,\\blur1\\fscx100\\fscy100)`,
  },

  highlighter: {
    id: 'highlighter',
    name: 'Highlighter',
    category: 'Creative',
    desc: 'Marker box backdrop with high contrast black lettering.',
    sample: 'HIGHLIGHTED TRUTH',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.072,
    primaryColor: '&H00000000', // Black text
    outlineColor: '&H00000000',
    backColor: '&H0020E6FF',    // Vibrant Yellow-Orange marker box (BBGGRR)
    bold: -1,
    borderStyle: 3,             // Opaque background box
    outlineRatio: 0.012,
    shadow: 0,
    alignment: 5,
    posYRatio: 0.75,
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
    fontSizeRatio: 0.058,
    primaryColor: '&H0050FF50', // Terminal Matrix Green (BBGGRR: RR=50, GG=FF, BB=50)
    outlineColor: '&H00000000',
    backColor: '&HC0121612',    // Dark terminal container box
    bold: -1,
    borderStyle: 3,
    outlineRatio: 0.010,
    shadow: 0,
    alignment: 5,
    posYRatio: 0.78,
    wordsPerCard: 3,
    uppercase: false,
    buildAnimation: () => `\\fad(20,20)\\t(0,60,\\fscx106\\fscy106)\\t(60,120,\\fscx100\\fscy100)`,
  },

  two_tone: {
    id: 'two_tone',
    name: 'Two-Tone Alternate',
    category: 'Creative',
    desc: 'Contrasting dual-color cadence alternating between brilliant gold and crisp pearl.',
    sample: 'BREAK THE PATTERN',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.078,
    primaryColor: '&H00FFFFFF', // White base
    outlineColor: '&H00000000',
    backColor: '&H0000D7FF',    // Gold highlight
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.012,
    shadow: 3,
    alignment: 5,
    posYRatio: 0.73,
    wordsPerCard: 4,
    uppercase: true,
    buildAnimation: () => `\\fad(40,40)\\t(0,80,\\fscx110\\fscy110)\\t(80,160,\\fscx100\\fscy100)`,
  },

  glitch_flicker: {
    id: 'glitch_flicker',
    name: 'Glitch Accent',
    category: 'Creative',
    desc: 'High-energy chromatic flash with rapid opacity flickering on the accent word.',
    sample: 'GLITCH IN REALITY',
    fontName: 'DejaVu Sans',
    fontSizeRatio: 0.088,
    primaryColor: '&H00FF32C8', // Electric Cyber Pink (BBGGRR: RR=C8, GG=32, BB=FF)
    outlineColor: '&H00FFFF00', // Cyan outline (BBGGRR: RR=00, GG=FF, BB=FF)
    backColor: '&H00000000',
    bold: -1,
    borderStyle: 1,
    outlineRatio: 0.014,
    shadow: 3,
    alignment: 5,
    posYRatio: 0.69,
    wordsPerCard: 2,
    uppercase: true,
    buildAnimation: () =>
      `\\fad(20,20)\\t(0,35,\\alpha&H60&)\\t(35,70,\\alpha&H00&)\\t(70,105,\\alpha&H80&)\\t(105,140,\\alpha&H00&\\fscx112\\fscy112)\\t(140,200,\\fscx100\\fscy100)`,
  },
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

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MainStyle,${style.fontName},${fontSize},${style.primaryColor},${style.outlineColor},${style.backColor},${style.bold},${style.borderStyle},${outline},${style.shadow},${style.alignment},40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
}

export function buildKaraokeAss(words, start, end, emoji = null, styleId = 'hormozi', W = 1080, H = 1920) {
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
  if (emoji) {
    events += `Dialogue: 1,0:00:00.00,0:00:00.80,MainStyle,,0,0,0,,{\\fad(80,120)\\pos(${W / 2},${Math.round(H * 0.34)})}${emoji}\n`
  }

  const posX = Math.round(W / 2)
  const posY = Math.round(H * style.posYRatio)

  cards.forEach((card, i) => {
    // Relative to clip start since FFmpeg cut input resets PTS to 00:00:00
    const cs = Math.max(0, card[0].start - start)
    const rawCe =
      i === cards.length - 1
        ? Math.min(card[card.length - 1].end, end)
        : Math.min(card[card.length - 1].end, cards[i + 1][0]?.start ?? end)
    let ce = Math.max(cs + 0.35, rawCe - start)

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
      rawText = card.map((w) => w.text.replace(/[{}]/g, '')).join(' ')
      if (style.uppercase) rawText = rawText.toUpperCase()
    }

    const anim = style.buildAnimation ? style.buildAnimation(W, H) : ''
    const animPart = anim ? `${anim}` : ''
    // When \\move is used, \\pos must not be included (they conflict in libass)
    const posPart = anim.includes('\\move') ? '' : `\\pos(${posX},${posY})`

    events += `Dialogue: 0,${tsAss(cs)},${tsAss(ce)},MainStyle,,0,0,0,,{${animPart}${posPart}}${rawText}\n`
  })

  return buildAssHeader(W, H, style) + events
}

export function buildPhraseAss(text, start, end, styleId = 'hormozi', W = 1080, H = 1920) {
  const style = getCaptionStyle(styleId)
  const maxLen = style.wordsPerCard > 4 ? 60 : 36
  const regex = new RegExp(`.{1,${maxLen}}(\\s|$)`, 'g')
  const lines = text.match(regex) ?? [text]
  const dur = Math.max(0.1, end - start)
  const per = dur / lines.length

  const posX = Math.round(W / 2)
  const posY = Math.round(H * style.posYRatio)

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
    events += `Dialogue: 0,${tsAss(per * i)},${tsAss(per * (i + 1))},MainStyle,,0,0,0,,{\\pos(${posX},${posY})}${t}\n`
  })

  return buildAssHeader(W, H, style) + events
}
