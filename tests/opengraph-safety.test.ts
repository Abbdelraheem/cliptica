import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('OpenGraph Image Generation Safety', () => {
  it('should not contain special unicode glyphs that cause dynamic font download status 400', () => {
    const ogFile = path.resolve(__dirname, '../src/app/opengraph-image.tsx')
    const content = fs.readFileSync(ogFile, 'utf-8')

    // ✦ (U+2726) triggers Google Fonts status 400 during Satori image generation
    expect(content).not.toContain('✦')
    expect(content).toContain('•')
  })
})
