/**
 * Presets and ASS subtitle generation for Cliptica.
 * Supports 6 distinct visual presets with real font, positioning,
 * color, animation, and layout differences.
 */

export const CAPTION_STYLES = {
  hormozi: {
    id: 'hormozi',
    name: 'Hormozi Pop',
    desc: 'Punchy 1-3 word cards with aggressive spring scale pop.',
    sample: 'STOP SCROLLING',
    fontName: 'Liberation Sans, Arial Black, DejaVu Sans',
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
    buildAnimation: (w, h) =>
      `\\fad(50,50)\\t(0,90,\\fscx118\\fscy118)\\t(90,180,\\fscx100\\fscy100)`,
  },

  clean_minimal: {
    id: 'clean_minimal',
    name: 'Clean Minimal',
    desc: 'Understated lower-third phrase layout with subtle fade, no bounce.',
    sample: 'The simplest ideas win.',
    fontName: 'Liberation Sans, Arial, DejaVu Sans',
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

  neon_highlight: {
    id: 'neon_highlight',
    name: 'Neon Highlight',
    desc: 'Electric cyan text with magenta shadow glow and expansion pulse.',
    sample: 'PURE ENERGY',
    fontName: 'Liberation Sans, Arial Black, DejaVu Sans',
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

  bold_impact: {
    id: 'bold_impact',
    name: 'Bold Impact',
    desc: 'Heavy uppercase text, golden yellow fill, thick outline, center-mid screen.',
    sample: 'MUST WATCH THIS',
    fontName: 'Liberation Sans, Impact, DejaVu Sans',
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

  classic_subtitle: {
    id: 'classic_subtitle',
    name: 'Classic Subtitle',
    desc: 'Documentary style, natural sentence lines at bottom safe zone.',
    sample: 'Every detail was planned in advance.',
    fontName: 'Liberation Sans, Arial, DejaVu Sans',
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

  highlighter: {
    id: 'highlighter',
    name: 'Highlighter',
    desc: 'Marker box backdrop with high contrast black lettering.',
    sample: 'HIGHLIGHTED TRUTH',
    fontName: 'Liberation Sans, Arial Black, DejaVu Sans',
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
}

export function getCaptionStyle(styleId) {
  return CAPTION_STYLES[styleId] ?? CAPTION_STYLES.hormozi
}

export function tsAss(s) {
  const h = Math.floor(s / 3600)
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(Math.floor(s % 60)).padStart(2, '0')
  const cs = String(Math.floor((s % 1) * 100)).padStart(2, '0')
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
Format: Layer, Start, End, Style, Text
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
    events += `Dialogue: 1,${tsAss(start)},${tsAss(start + 0.8)},MainStyle,,0,0,0,,{\\fad(80,120)\\pos(${W / 2},${Math.round(H * 0.34)})}${emoji}\n`
  }

  const posX = Math.round(W / 2)
  const posY = Math.round(H * style.posYRatio)

  cards.forEach((card, i) => {
    const cs = Math.max(card[0].start, start)
    let ce =
      i === cards.length - 1
        ? Math.min(card[card.length - 1].end, end)
        : Math.min(card[card.length - 1].end, cards[i + 1][0]?.start ?? end)
    if (ce <= cs) ce = cs + 0.35

    let rawText = card.map((w) => w.text.replace(/[{}]/g, '')).join(' ')
    if (style.uppercase) rawText = rawText.toUpperCase()

    const anim = style.buildAnimation(W, H)
    const animPart = anim ? `${anim}` : ''
    const posPart = `\\pos(${posX},${posY})`

    events += `Dialogue: 0,${tsAss(cs)},${tsAss(ce)},MainStyle,,0,0,0,,{${animPart}${posPart}}${rawText}\n`
  })

  return buildAssHeader(W, H, style) + events
}

export function buildPhraseAss(text, start, end, styleId = 'hormozi', W = 1080, H = 1920) {
  const style = getCaptionStyle(styleId)
  const maxLen = style.wordsPerCard > 4 ? 60 : 36
  const regex = new RegExp(`.{1,${maxLen}}(\\s|$)`, 'g')
  const lines = text.match(regex) ?? [text]
  const per = (end - start) / lines.length

  const posX = Math.round(W / 2)
  const posY = Math.round(H * style.posYRatio)

  let events = ''
  lines.forEach((l, i) => {
    let t = l.trim().replace(/[{}]/g, '')
    if (style.uppercase) t = t.toUpperCase()
    events += `Dialogue: 0,${tsAss(start + per * i)},${tsAss(start + per * (i + 1))},MainStyle,,0,0,0,,{\\pos(${posX},${posY})}${t}\n`
  })

  return buildAssHeader(W, H, style) + events
}
