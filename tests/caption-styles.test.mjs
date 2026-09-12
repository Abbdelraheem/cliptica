import { describe, it, expect } from 'vitest'
import {
  CAPTION_STYLES,
  getCaptionStyle,
  buildKaraokeAss,
  buildPhraseAss,
  tsAss,
} from '../worker/caption-styles.mjs'

describe('caption-styles', () => {
  const styleIds = [
    'hormozi',
    'bold_impact',
    'bounce_side',
    'pill_box',
    'tiktok_classic',
    'clean_minimal',
    'classic_subtitle',
    'slow_fade',
    'cinematic_caps',
    'podcast_soft',
    'neon_highlight',
    'highlighter',
    'typewriter',
    'two_tone',
    'glitch_flicker',
  ]

  it('contains at least 15 distinct visual styles across Kinetic, Editorial, and Creative categories', () => {
    expect(Object.keys(CAPTION_STYLES).length).toBe(15)
    for (const id of styleIds) {
      expect(CAPTION_STYLES[id]).toBeDefined()
      expect(CAPTION_STYLES[id].name).toBeTruthy()
      expect(CAPTION_STYLES[id].desc).toBeTruthy()
      expect(CAPTION_STYLES[id].category).toMatch(/^(Kinetic|Editorial|Creative)$/)
    }
  })

  it('falls back to hormozi for unknown style id', () => {
    expect(getCaptionStyle('nonexistent').id).toBe('hormozi')
    expect(getCaptionStyle(null).id).toBe('hormozi')
  })

  it('formats timestamps in valid ASS format h:mm:ss.cs', () => {
    expect(tsAss(0)).toBe('0:00:00.00')
    expect(tsAss(65.43)).toBe('0:01:05.43')
    expect(tsAss(3661.05)).toBe('1:01:01.05')
  })

  describe('rendering each style preset', () => {
    const mockWords = [
      { text: 'Stop', start: 1.0, end: 1.4 },
      { text: 'scrolling', start: 1.5, end: 2.1 },
      { text: 'and', start: 2.2, end: 2.4 },
      { text: 'listen', start: 2.5, end: 3.0 },
    ]

    for (const styleId of styleIds) {
      describe(`Style: ${styleId}`, () => {
        it('generates well-formed ASS karaoke output', () => {
          const ass = buildKaraokeAss(mockWords, 0, 4.0, '🔥', styleId, 1080, 1920)
          expect(ass).toContain('[Script Info]')
          expect(ass).toContain('PlayResX: 1080')
          expect(ass).toContain('PlayResY: 1920')
          expect(ass).toContain('[V4+ Styles]')
          expect(ass).toContain('Style: MainStyle,')
          expect(ass).toContain('[Events]')
          expect(ass).toContain('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text')
          expect(ass).toContain('Dialogue: ')
          expect(ass).toContain('\\pos(')
        })

        it('generates relative timestamps offset from clip start', () => {
          const offsetWords = [
            { text: 'Start', start: 60.5, end: 61.2 },
            { text: 'later', start: 61.3, end: 62.0 },
          ]
          const ass = buildKaraokeAss(offsetWords, 60.0, 65.0, null, styleId, 1080, 1920)
          expect(ass).toContain('Dialogue: 0,0:00:00.50,')
        })

        it('generates phrase fallback when words are absent', () => {
          const ass = buildPhraseAss('This is a simple fallback subtitle line', 0, 3.0, styleId, 1080, 1920)
          expect(ass).toContain('[Script Info]')
          expect(ass).toContain('Dialogue: ')
        })
      })
    }
  })

  describe('edge cases across all styles', () => {
    const edgeCases = [
      {
        name: 'very short word',
        words: [
          { text: 'I', start: 0.1, end: 0.3 },
          { text: 'a', start: 0.4, end: 0.6 },
        ],
      },
      {
        name: 'very long word',
        words: [
          { text: 'Supercalifragilisticexpialidocious', start: 0.5, end: 2.5 },
          { text: 'Internationalization', start: 2.6, end: 4.0 },
        ],
      },
      {
        name: 'emoji in words and card',
        words: [
          { text: 'Unbelievable! 🚀', start: 0.5, end: 1.5 },
          { text: 'Mind-blowing 🤯', start: 1.6, end: 2.5 },
        ],
      },
      {
        name: 'Arabic RTL text',
        words: [
          { text: 'مرحبا', start: 0.5, end: 1.0 },
          { text: 'بكم', start: 1.1, end: 1.5 },
          { text: 'في', start: 1.6, end: 1.8 },
          { text: 'كليبتيكا', start: 1.9, end: 2.6 },
        ],
      },
      {
        name: 'brackets and ASS injection chars sanitized',
        words: [
          { text: '{b1}test{/b1}', start: 0.5, end: 1.0 },
          { text: 'clean\\pos(0,0)', start: 1.1, end: 1.5 },
        ],
      },
    ]

    for (const styleId of styleIds) {
      for (const ec of edgeCases) {
        it(`${styleId} handles ${ec.name} without crashing or syntax break`, () => {
          const ass = buildKaraokeAss(ec.words, 0, 5.0, '✨', styleId, 1080, 1920)
          expect(ass).toBeTruthy()
          // Must not have nested raw curly braces that break ASS
          const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'))
          expect(dialogueLines.length).toBeGreaterThan(0)
          for (const line of dialogueLines) {
            // Count opening vs closing braces
            const opens = (line.match(/{/g) || []).length
            const closes = (line.match(/}/g) || []).length
            expect(opens).toBe(closes)
          }
        })
      }
    }
  })
})
