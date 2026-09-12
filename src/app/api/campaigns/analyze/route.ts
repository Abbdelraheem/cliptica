import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertPublicHttpUrl } from '@/lib/ssrf'

const requestSchema = z.object({
  url: z.string().url(),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please provide a valid campaign URL' }, { status: 400 })
    }

    const campaignUrl = parsed.data.url
    await assertPublicHttpUrl(campaignUrl)

    let html = ''
    try {
      const resp = await fetch(campaignUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!resp.ok) {
        return NextResponse.json({ error: `Failed to fetch campaign page (HTTP ${resp.status})` }, { status: 422 })
      }
      html = await resp.text()
    } catch (er2) {
      return NextResponse.json(
        { error: `Could not reach the campaign page: ${er2 instanceof Error ? er2.message : 'Timeout'}` },
        { status: 504 }
      )
    }

    let platform = 'Clipping Campaign'
    if (/whop\.com/i.test(campaignUrl)) {
      platform = 'Whop Campaign'
    } else if (/contentreward/i.test(campaignUrl)) {
      platform = 'ContentReward'
    }

    const assetMap = new Map<string, { type: 'drive' | 'youtube' | 'dropbox' | 'direct'; url: string; label: string }>()

    const driveMatches = html.match(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s"'<>]+/gi) || []
    for (const dUrl of driveMatches) {
      const clean = dUrl.replace(/&amp;/g, '&').replace(/[)\\]}>.,;]+$/, '')
      if (!assetMap.has(clean)) {
        const isFolder = clean.includes('folders')
        assetMap.set(clean, {
          type: 'drive',
          url: clean,
          label: isFolder ? 'Google Drive Assets Folder' : 'Google Drive Media File',
        })
      }
    }

    const ytMatches = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/gi) || []
    for (const yUrl of ytMatches) {
      const clean = yUrl.replace(/&amp;/g, '&').replace(/[)\\]}>.,;]+$/, '')
      if (!assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'youtube',
          url: clean,
          label: 'YouTube Source Footage',
        })
      }
    }

    const dropboxMatches = html.match(/https?:\/\/(?:www\.)?dropbox\.com\/[^\s"'<>]+/gi) || []
    for (const dbUrl of dropboxMatches) {
      const clean = dbUrl.replace(/&amp;/g, '&').replace(/[)\\]}>.,;]+$/, '')
      if (!assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'dropbox',
          url: clean,
          label: 'Dropbox Assets',
        })
      }
    }

    const directMatches = html.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|mov|webm|mkv)(?:\?[^\s"'<>]*)?/gi) || []
    for (const mUrl of directMatches) {
      const clean = mUrl.replace(/&amp;/g, '&').replace(/[)\\]}>.,;]+$/, '')
      if (!assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'direct',
          url: clean,
          label: 'Direct Video Stream / Asset',
        })
      }
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    const rawTitle = titleMatch ? titleMatch[1].trim() : 'Campaign'

    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4500)

    const groqKey = process.env.GROQ_API_KEY

    const campaignAnalysis = {
      title: rawTitle,
      payout: null as string | null,
      guidelines: [
        'Extract high-retention viral moments',
        'Include catchy opening hook in the first 3 seconds',
        'Use punchy kinetic captions',
      ],
      requiredHashtags: [] as string[],
      recommendedInstructions: 'Focus on high energy viral moments that match the campaign guidelines.',
    }

    if (groqKey) {
      try {
        const promptSystem =
          'You are a clipping campaign analyst for TikTok, YouTube Shorts, and Instagram Reels. ' +
          'Analyze the provided web page text of a clipping bounty/campaign (from platforms like Whop, ContentReward, etc.). ' +
          'Extract the campaign details into JSON that contains: ' +
          'title (string), payout (string or null), guidelines (string array), requiredHashtags (string array), recommendedInstructions (string). ' +
          '"recommendedInstructions" must be a reliable instruction to the video clipper describing what to look for, what hooks to keep, and banned elements to avoid.'

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            temperature: 0.2,
            messages: [
              { role: 'system', content: promptSystem },
              { role: 'user', content: `Campaign URL: ${campaignUrl}\n\nPage Text:\n${cleanText}` },
            ],
          }),
        })

        if (groqRes.ok) {
          const groqData = await groqRes.json()
          const parsedContent = JSON.parse(groqData.choices?.[0]?.message?.content || '{}')
          if (parsedContent.title) campaignAnalysis.title = parsedContent.title
          if (parsedContent.payout) campaignAnalysis.payout = parsedContent.payout
          if (Array.isArray(parsedContent.guidelines) && parsedContent.guidelines.length) {
            campaignAnalysis.guidelines = parsedContent.guidelines
          }
          if (Array.isArray(parsedContent.requiredHashtags)) {
            campaignAnalysis.requiredHashtags = parsedContent.requiredHashtags
          }
          if (parsedContent.recommendedInstructions) {
            campaignAnalysis.recommendedInstructions = parsedContent.recommendedInstructions
          }
        }
      } catch (groqErr) {
        console.warn('Groq campaign analysis fallback:', groqErr)
      }
    }

    return NextResponse.json({
      success: true,
      campaign: {
        platform,
        url: campaignUrl,
        title: campaignAnalysis.title,
        payout: campaignAnalysis.payout,
        guidelines: campaignAnalysis.guidelines,
        requiredHashtags: campaignAnalysis.requiredHashtags,
        recommendedInstructions: campaignAnalysis.recommendedInstructions,
        assets: Array.from(assetMap.values()),
      },
    })
  } catch (error) {
    console.error('Campaign analyze error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze campaign' },
      { status: 500 }
    )
  }
}
