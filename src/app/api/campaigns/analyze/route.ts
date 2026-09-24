import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertPublicHttpUrl } from '@/lib/ssrf'
import { executeAiChatCompletion } from '@/lib/ai-provider'

const requestSchema = z.object({
  url: z.string().url(),
})

interface WhopUrlParts {
  companySlug: string | null
  experienceId: string | null
  campaignId: string | null
}

function parseWhopUrl(rawUrl: string): WhopUrlParts | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.toLowerCase()
    if (!host.includes('whop.com')) return null

    const parts = u.pathname.split('/').filter(Boolean)
    let companySlug: string | null = null
    let experienceId: string | null = null
    let campaignId: string | null = null

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part.startsWith('exp_')) {
        experienceId = part
        if (i > 0 && !companySlug && parts[i - 1] !== 'c') {
          companySlug = parts[i - 1]
        }
      } else if (part === 'campaigns' && i + 1 < parts.length) {
        campaignId = parts[i + 1].replace(/\/+$/, '')
      }
    }

    if (!companySlug && parts.length > 0 && parts[0] !== 'c' && !parts[0].startsWith('exp_')) {
      companySlug = parts[0]
    }

    return { companySlug, experienceId, campaignId }
  } catch {
    return null
  }
}

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

    const parsedWhop = parseWhopUrl(campaignUrl)
    const isWhop = !!parsedWhop

    // Prepare URLs to fetch:
    // If it's a specific Whop campaign, fetch the Content Rewards micro-app URL directly
    // where the raw video assets, guidelines, and payouts are rendered.
    const urlsToTry: string[] = []
    if (parsedWhop?.campaignId) {
      const exp = parsedWhop.experienceId || 'exp_general'
      urlsToTry.push(`https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/c/${exp}/campaigns/${parsedWhop.campaignId}`)
    } else if (parsedWhop?.experienceId) {
      urlsToTry.push(`https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/c/${parsedWhop.experienceId}/campaigns`)
      urlsToTry.push(`https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/c/${parsedWhop.experienceId}/discover`)
    }
    urlsToTry.push(campaignUrl)

    let html = ''
    const reqHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://whop.com/',
    }

    for (const targetUrl of urlsToTry) {
      try {
        const resp = await fetch(targetUrl, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(15000),
        })
        if (resp.ok) {
          const bodyText = await resp.text()
          if (bodyText && bodyText.trim().length > 20) {
            html += '\n' + bodyText
            // If we found direct campaign media assets, we have enough data
            if (
              bodyText.includes('cdn.contentrewards.com') ||
              bodyText.includes('drive.google.com') ||
              bodyText.includes('.mp4')
            ) {
              break
            }
          }
        }
      } catch (err) {
        console.warn(`[campaign:analyze] Fetch attempt failed for ${targetUrl}:`, err instanceof Error ? err.message : err)
      }
    }

    if (!html.trim()) {
      return NextResponse.json(
        { error: 'Could not retrieve campaign details from this URL. Please verify the link is accessible.' },
        { status: 504 }
      )
    }

    let platform = 'Clipping Campaign'
    if (isWhop) {
      platform = 'Whop Campaign'
    } else if (/contentreward/i.test(campaignUrl)) {
      platform = 'ContentReward'
    }

    const assetMap = new Map<string, { type: 'drive' | 'youtube' | 'dropbox' | 'direct'; url: string; label: string }>()

    // Direct MP4 / Video streams (including cdn.contentrewards.com)
    const directMatches = html.match(/https?:\/\/[^\s"'<>\\]+\.(?:mp4|mov|webm|mkv)(?:\?[^\s"'<>\\]*)?/gi) || []
    for (const mUrl of directMatches) {
      const clean = mUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (!assetMap.has(clean)) {
        const isCR = clean.includes('cdn.contentrewards.com')
        assetMap.set(clean, {
          type: 'direct',
          url: clean,
          label: isCR ? 'ContentRewards Raw Source Video (MP4)' : 'Direct Video Stream / Asset (MP4)',
        })
      }
    }

    // Google Drive
    const driveMatches = html.match(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s"'<>\\]+/gi) || []
    for (const dUrl of driveMatches) {
      const clean = dUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (!assetMap.has(clean)) {
        const isFolder = clean.includes('folders')
        assetMap.set(clean, {
          type: 'drive',
          url: clean,
          label: isFolder ? 'Google Drive Assets Folder' : 'Google Drive Media File',
        })
      }
    }

    // YouTube
    const ytMatches =
      html.match(
        /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/gi
      ) || []
    for (const yUrl of ytMatches) {
      const clean = yUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (!clean.includes('@WhopIO') && !assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'youtube',
          url: clean,
          label: 'YouTube Source Footage',
        })
      }
    }

    // Dropbox
    const dropboxMatches = html.match(/https?:\/\/(?:www\.)?dropbox\.com\/[^\s"'<>\\]+/gi) || []
    for (const dbUrl of dropboxMatches) {
      const clean = dbUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (!assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'dropbox',
          url: clean,
          label: 'Dropbox Assets',
        })
      }
    }

    // Extract Title
    let rawTitle = ''
    const nameMatch = html.match(/"name":"([^"]+)"/)
    if (nameMatch && nameMatch[1].length > 2 && !nameMatch[1].startsWith('/') && !nameMatch[1].includes('{')) {
      rawTitle = nameMatch[1]
    } else {
      const titleMatch =
        html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      if (titleMatch) {
        rawTitle = titleMatch[1].replace(/\s*\|\s*(?:Content Rewards|Whop).*/i, '').trim()
      }
    }
    if (!rawTitle || rawTitle === 'Campaign') {
      rawTitle = parsedWhop?.companySlug
        ? `${parsedWhop.companySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Campaign`
        : 'Campaign'
    }

    // Extract Payout
    let detectedPayout: string | null = null
    const rateMatch =
      html.match(/"rateCents":(\d+)/) || html.match(/"ratePerKCents":(\d+)/) || html.match(/"cpmCents":(\d+)/)
    const maxPayoutMatch = html.match(/"maxPayoutCents":(\d+)/)
    if (rateMatch) {
      const dollars = (parseInt(rateMatch[1], 10) / 100).toFixed(2)
      detectedPayout = `$${dollars} CPM`
      if (maxPayoutMatch) {
        const maxDollars = (parseInt(maxPayoutMatch[1], 10) / 100).toFixed(0)
        detectedPayout += ` (Up to $${maxDollars})`
      }
    } else if (maxPayoutMatch) {
      const maxDollars = (parseInt(maxPayoutMatch[1], 10) / 100).toFixed(0)
      detectedPayout = `Up to $${maxDollars}`
    }

    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4500)

    const rawAssets = Array.from(assetMap.values())
    const isHub = isWhop && !parsedWhop?.campaignId && rawAssets.length === 0

    const hubMessage = isHub
      ? `تم التعرف على مساحة ${rawTitle} بنجاح. لبدء القص التلقائي، افتح الحملة المطلوبة والصق رابطها (مثال: .../app/campaigns/id) أو الصق رابط Google Drive / الفيديو المباشر المرفق بها.`
      : null

    const campaignAnalysis = {
      title: rawTitle,
      payout: detectedPayout,
      guidelines: [
        'Extract high-retention viral moments',
        'Include catchy opening hook in the first 3 seconds',
        'Use punchy kinetic captions',
      ],
      requiredHashtags: [] as string[],
      recommendedInstructions: isHub
        ? `Focus on high-energy viral clips tailored for ${rawTitle}. Keep cadence punchy for TikTok and Reels.`
        : 'Focus on high energy viral moments that match the campaign guidelines.',
      recommendedAssetUrl: rawAssets[0]?.url || '',
      aiRationale: rawAssets.length > 0 ? 'Primary media source detected for this campaign.' : '',
      recommendedCaptionStyle: 'hormozi',
      campaignHook: '',
    }

    try {
      const assetsPrompt = rawAssets
        .map((a, i) => `[Asset ${i + 1}] Type: ${a.type} | URL: ${a.url} | Label: ${a.label}`)
        .join('\n')

      const promptSystem =
        'You are a clipping campaign director and viral media strategist for TikTok, YouTube Shorts, and Instagram Reels. ' +
        'Analyze the provided web page text and detected media assets of a clipping bounty/campaign (from platforms like Whop, ContentReward, etc.). ' +
        'Understand the core objectives, rules, and footage to formulate an integrated viral clip strategy. ' +
        'Output a valid JSON object with: ' +
        'title (string), payout (string or null), guidelines (string array), requiredHashtags (string array), ' +
        'recommendedInstructions (string: instructions for the video cutter/scoring AI ensuring all campaign criteria and hooks are satisfied), ' +
        'campaignHook (string: opening viral title hook text under 6 words), ' +
        'recommendedCaptionStyle (string: one of ["hormozi", "neon", "luxury", "beast", "bold"]), ' +
        'recommendedAssetUrl (string: the exact URL from the detected assets list that is the best primary footage to use for the clip), ' +
        'aiRationale (string: 1 clear sentence explaining why this specific asset was chosen to build the complete campaign video).'

      const aiRes = await executeAiChatCompletion({
        responseFormat: 'json_object',
        temperature: 0.2,
        messages: [
          { role: 'system', content: promptSystem },
          {
            role: 'user',
            content: `Campaign URL: ${campaignUrl}\n\nPage Text:\n${cleanText}\n\nDetected Media Assets:\n${assetsPrompt || 'None detected'}`,
          },
        ],
      })

      const parsedJson = (aiRes.parsedJson || {}) as Record<string, unknown>
      if (typeof parsedJson.title === 'string' && parsedJson.title) campaignAnalysis.title = parsedJson.title
      if (!campaignAnalysis.payout && typeof parsedJson.payout === 'string' && parsedJson.payout) {
        campaignAnalysis.payout = parsedJson.payout
      }
      if (Array.isArray(parsedJson.guidelines) && parsedJson.guidelines.length) {
        campaignAnalysis.guidelines = parsedJson.guidelines.map(String)
      }
      if (Array.isArray(parsedJson.requiredHashtags)) {
        campaignAnalysis.requiredHashtags = parsedJson.requiredHashtags.map(String)
      }
      if (typeof parsedJson.recommendedInstructions === 'string' && parsedJson.recommendedInstructions) {
        campaignAnalysis.recommendedInstructions = parsedJson.recommendedInstructions
      }
      if (typeof parsedJson.campaignHook === 'string' && parsedJson.campaignHook) {
        campaignAnalysis.campaignHook = parsedJson.campaignHook
      }
      if (typeof parsedJson.recommendedCaptionStyle === 'string' && parsedJson.recommendedCaptionStyle) {
        campaignAnalysis.recommendedCaptionStyle = parsedJson.recommendedCaptionStyle
      }
      if (
        typeof parsedJson.recommendedAssetUrl === 'string' &&
        rawAssets.some((a) => a.url === parsedJson.recommendedAssetUrl)
      ) {
        campaignAnalysis.recommendedAssetUrl = parsedJson.recommendedAssetUrl
      }
      if (typeof parsedJson.aiRationale === 'string' && parsedJson.aiRationale) {
        campaignAnalysis.aiRationale = parsedJson.aiRationale
      }
    } catch (aiErr) {
      console.warn('AI campaign analysis fallback:', aiErr)
    }

    // Determine the primary asset
    let primaryAsset = rawAssets.find((a) => a.url === campaignAnalysis.recommendedAssetUrl)
    if (!primaryAsset && rawAssets.length > 0) {
      primaryAsset =
        rawAssets.find((a) => a.type === 'direct') ||
        rawAssets.find((a) => a.type === 'youtube') ||
        rawAssets.find((a) => a.type === 'drive') ||
        rawAssets[0]
      campaignAnalysis.recommendedAssetUrl = primaryAsset.url
      if (!campaignAnalysis.aiRationale) {
        campaignAnalysis.aiRationale = 'Selected as the primary footage matching campaign criteria.'
      }
    }

    const enrichedAssets = rawAssets.map((a) => ({
      ...a,
      isRecommended: primaryAsset ? a.url === primaryAsset.url : false,
    }))

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
        campaignHook: campaignAnalysis.campaignHook,
        recommendedCaptionStyle: campaignAnalysis.recommendedCaptionStyle,
        primaryAsset: primaryAsset || null,
        aiRationale: campaignAnalysis.aiRationale,
        assets: enrichedAssets,
        isHub,
        hubMessage,
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
