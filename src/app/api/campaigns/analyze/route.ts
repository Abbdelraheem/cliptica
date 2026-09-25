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
        if (i > 0 && !companySlug && parts[i - 1] !== 'c' && parts[i - 1] !== 'joined') {
          companySlug = parts[i - 1]
        }
      } else if (part === 'campaigns' && i + 1 < parts.length) {
        campaignId = parts[i + 1].replace(/\/+$/, '')
      }
    }

    const qCampaignId = u.searchParams.get('campaignId') || u.searchParams.get('campaign')
    if (!campaignId && qCampaignId) {
      campaignId = qCampaignId.trim()
    }

    if (
      !companySlug &&
      parts.length > 0 &&
      parts[0] !== 'c' &&
      parts[0] !== 'joined' &&
      parts[0] !== 'discover' &&
      !parts[0].startsWith('exp_')
    ) {
      companySlug = parts[0]
    }

    return { companySlug, experienceId, campaignId }
  } catch {
    return null
  }
}

const META_TAG_NAMES = new Set([
  'description',
  'viewport',
  'application-name',
  'robots',
  'format-detection',
  'theme-color',
  'next-size-adjust',
  'generator',
  'keywords',
  'author',
  'referrer',
])

/**
 * Checks whether a URL is a pre-edited user submission from the ContentRewards/Whop
 * leaderboard (`topClips`) rather than raw campaign source footage.
 */
function isLeaderboardSubmissionUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (lower.includes('cdn.contentrewards.com/downloaded-videos/')) return true
  if (lower.includes('/downloaded-videos/')) return true
  if (/_(?:thumb|avatar)\.(?:webp|jpg|jpeg|png)$/i.test(lower)) return true
  return false
}

/**
 * Strips `topClips` and `topEarners` JSON arrays from unescaped HTML/RSC payloads
 * so competitor submissions (Instagram Reels, TikToks, YouTube Shorts, downloaded-videos)
 * are never mistaken for raw campaign source assets.
 */
function stripLeaderboardSections(text: string): string {
  return text
    .replace(/"topClips"\s*:\s*\[[\s\S]*?\](?=\s*,\s*"[a-zA-Z]|\s*\})/g, '"topClips":[]')
    .replace(/"topEarners"\s*:\s*\[[\s\S]*?\](?=\s*,\s*"[a-zA-Z]|\s*\})/g, '"topEarners":[]')
}

/**
 * Expands a public Google Drive folder into individual video files via Google's
 * public embeddedfolderview endpoint so users can pick a specific raw video file.
 */
async function expandGoogleDriveFolder(
  folderUrl: string,
  reqHeaders: Record<string, string>
): Promise<Array<{ type: 'drive'; url: string; label: string }>> {
  const m = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (!m) return []
  const folderId = m[1]
  try {
    const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
    const resp = await fetch(embedUrl, {
      headers: reqHeaders,
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return []
    const html = await resp.text()
    const results: Array<{ type: 'drive'; url: string; label: string }> = []
    const entryRegex =
      /<a[^>]+href=["'](https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null
    while ((match = entryRegex.exec(html)) !== null && results.length < 25) {
      const fileId = match[2]
      const rawTitle = match[3]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const cleanFileUrl = `https://drive.google.com/file/d/${fileId}/view`
      // Skip non-video documents/images if extension is visible
      if (/\.(?:pdf|png|jpg|jpeg|webp|txt|doc|docx|zip)$/i.test(rawTitle)) continue
      results.push({
        type: 'drive',
        url: cleanFileUrl,
        label: rawTitle ? `Google Drive Video: ${rawTitle}` : `Google Drive Video (${fileId.slice(0, 8)})`,
      })
    }
    return results
  } catch {
    return []
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
    // IMPORTANT: Only fetch the specific campaign endpoint if a campaignId is present.
    // Never fetch global /campaigns or /discover feeds when no campaignId is provided,
    // as those return unrelated leaderboard videos from other campaigns.
    const urlsToTry: string[] = []
    if (parsedWhop?.campaignId) {
      const exp = parsedWhop.experienceId || 'exp_general'
      urlsToTry.push(`https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/c/${exp}/campaigns/${parsedWhop.campaignId}`)
    }
    urlsToTry.push(campaignUrl)

    let rawHtml = ''
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
            rawHtml += '\n' + bodyText
            if (parsedWhop?.campaignId && targetUrl.includes('apps.whop.com')) {
              break
            }
          }
        }
      } catch (err) {
        console.warn(
          `[campaign:analyze] Fetch attempt failed for ${targetUrl}:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    if (!rawHtml.trim()) {
      return NextResponse.json(
        { error: 'Could not retrieve campaign details from this URL. Please verify the link is accessible.' },
        { status: 504 }
      )
    }

    // Unescape Next.js RSC flight payload strings (\" -> ") so embedded campaign JSON is searchable
    const unescapedHtml = rawHtml.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    // Strip leaderboard sections (`topClips`, `topEarners`) so competitor clips are never ingested
    const html = stripLeaderboardSections(unescapedHtml)

    let platform = 'Clipping Campaign'
    if (isWhop) {
      platform = 'Whop Campaign'
    } else if (/contentreward/i.test(campaignUrl)) {
      platform = 'ContentReward'
    }

    // Extract referenceMaterial links (Notion guides, Google Docs, Drive folders, etc.)
    const referenceLinks: Array<{ url: string; label: string }> = []
    const refRegex = /"url"\s*:\s*"(https?:\/\/[^"]+)"/g
    let refMatch: RegExpExecArray | null
    while ((refMatch = refRegex.exec(html)) !== null) {
      const refUrl = refMatch[1].replace(/&amp;/g, '&').trim()
      if (
        !isLeaderboardSubmissionUrl(refUrl) &&
        !refUrl.includes('contentrewards.com/c/') &&
        !refUrl.includes('amazonaws.com/organizations/') &&
        !refUrl.includes('amazonaws.com/0') &&
        !refUrl.includes('googleusercontent.com/a/') &&
        !referenceLinks.some((r) => r.url === refUrl)
      ) {
        let label = 'Campaign Reference Material'
        if (/notion\.site|notion\.so/i.test(refUrl)) label = 'Campaign Notion Guide & Raw Footage'
        else if (/drive\.google\.com/i.test(refUrl)) label = 'Google Drive Raw Footage'
        else if (/docs\.google\.com/i.test(refUrl)) label = 'Google Doc Campaign Brief'
        else if (/dropbox\.com/i.test(refUrl)) label = 'Dropbox Raw Footage'
        else if (/youtube\.com|youtu\.be/i.test(refUrl)) label = 'YouTube Source Footage'
        else if (/discord\.gg|discord\.com/i.test(refUrl)) label = 'Campaign Discord Community'
        referenceLinks.push({ url: refUrl, label })
      }
    }

    // If any reference link is a public Google Doc, fetch its mobilebasic view to extract raw video links inside it
    let supplementalHtml = ''
    for (const ref of referenceLinks.slice(0, 3)) {
      const gdocMatch = ref.url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i)
      if (gdocMatch) {
        try {
          const docResp = await fetch(`https://docs.google.com/document/d/${gdocMatch[1]}/mobilebasic`, {
            headers: reqHeaders,
            signal: AbortSignal.timeout(8000),
          })
          if (docResp.ok) {
            supplementalHtml += '\n' + (await docResp.text())
          }
        } catch {}
      }
    }

    const combinedSearchHtml = html + '\n' + supplementalHtml

    const assetMap = new Map<
      string,
      { type: 'drive' | 'youtube' | 'dropbox' | 'direct'; url: string; label: string }
    >()

    // 1. Direct MP4 / Video streams — strictly excluding leaderboard `downloaded-videos` submissions!
    const directMatches =
      combinedSearchHtml.match(/https?:\/\/[^\s"'<>\\]+\.(?:mp4|mov|webm|mkv)(?:\?[^\s"'<>\\]*)?/gi) || []
    for (const mUrl of directMatches) {
      const clean = mUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (isLeaderboardSubmissionUrl(clean)) continue
      if (!assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'direct',
          url: clean,
          label: 'Direct Raw Source Video (MP4)',
        })
      }
    }

    // 2. Google Drive (expand folders into individual video files and filter out non-video image/logo files)
    const driveMatches =
      combinedSearchHtml.match(/https?:\/\/(?:drive|docs)\.google\.com\/(?:drive\/folders|file\/d)\/[^\s"'<>\\]+/gi) ||
      []
    const driveFoldersToExpand: string[] = []
    const driveFilesToVerify: string[] = []
    for (const dUrl of driveMatches) {
      let clean = dUrl
        .replace(/\\+$/, '')
        .replace(/["'\\]+$/, '')
        .replace(/&amp;/g, '&')
        .replace(/[?&]sa=D&source=editors.*$/i, '')
      const folderIdMatch = clean.match(/\/folders\/([a-zA-Z0-9_-]{15,})/)
      const fileIdMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/)
      if (folderIdMatch) {
        clean = `https://drive.google.com/drive/folders/${folderIdMatch[1]}`
        if (!assetMap.has(clean)) {
          if (driveFoldersToExpand.length < 2) driveFoldersToExpand.push(clean)
          assetMap.set(clean, {
            type: 'drive',
            url: clean,
            label: 'Google Drive Raw Assets Folder',
          })
        }
      } else if (fileIdMatch) {
        const fileId = fileIdMatch[1]
        clean = `https://drive.google.com/file/d/${fileId}/view`
        if (!driveFilesToVerify.includes(fileId) && driveFilesToVerify.length < 4) {
          driveFilesToVerify.push(fileId)
        }
      }
    }

    for (const fileId of driveFilesToVerify) {
      const canonicalFileUrl = `https://drive.google.com/file/d/${fileId}/view`
      if (assetMap.has(canonicalFileUrl)) continue
      let isNonVideo = false
      let fileLabel = 'Google Drive Raw Video File'
      try {
        const headRes = await fetch(
          `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
          { method: 'HEAD', headers: reqHeaders, signal: AbortSignal.timeout(3500) }
        )
        const cType = (headRes.headers.get('content-type') || '').toLowerCase()
        const cDisp = headRes.headers.get('content-disposition') || ''
        const fnMatch = cDisp.match(/filename="([^"]+)"/i)
        const fileName = fnMatch?.[1] || ''
        if (
          cType.startsWith('image/') ||
          cType.startsWith('application/pdf') ||
          /\.(png|jpe?g|gif|webp|svg|pdf|zip|rar|psd|ai)$/i.test(fileName)
        ) {
          isNonVideo = true
          if (!referenceLinks.some((r) => r.url === canonicalFileUrl)) {
            referenceLinks.push({
              url: canonicalFileUrl,
              label: fileName ? `Brand Asset (${fileName})` : 'Google Drive Brand Asset',
            })
          }
        } else if (fileName) {
          fileLabel = `Google Drive Video: ${fileName}`
        }
      } catch {}

      if (!isNonVideo) {
        assetMap.set(canonicalFileUrl, {
          type: 'drive',
          url: canonicalFileUrl,
          label: fileLabel,
        })
      }
    }

    for (const folderUrl of driveFoldersToExpand) {
      const expandedFiles = await expandGoogleDriveFolder(folderUrl, reqHeaders)
      for (const fileAsset of expandedFiles) {
        if (!assetMap.has(fileAsset.url)) {
          assetMap.set(fileAsset.url, fileAsset)
        }
      }
    }

    // 3. YouTube (only long-form watch?v= or youtu.be links, excluding shorts/competitor reels)
    const ytMatches =
      combinedSearchHtml.match(
        /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/gi
      ) || []
    for (const yUrl of ytMatches) {
      const clean = yUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (!clean.includes('@WhopIO') && !assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'youtube',
          url: clean,
          label: 'YouTube Raw Source Video',
        })
      }
    }

    // 4. Dropbox
    const dropboxMatches = combinedSearchHtml.match(/https?:\/\/(?:www\.)?dropbox\.com\/[^\s"'<>\\]+/gi) || []
    for (const dbUrl of dropboxMatches) {
      const clean = dbUrl.replace(/\\+$/, '').replace(/["'\\]+$/, '').replace(/&amp;/g, '&')
      if (!assetMap.has(clean)) {
        assetMap.set(clean, {
          type: 'dropbox',
          url: clean,
          label: 'Dropbox Raw Assets',
        })
      }
    }

    // Extract accurate Campaign Title (ignoring <meta name="description"> etc.)
    let rawTitle = ''
    const titleTagMatch =
      html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
      html.match(/"children"\s*:\s*"([^"]+?)\s*\|\s*Content Rewards"/i)
    if (titleTagMatch) {
      const candidate = titleTagMatch[1].replace(/\s*\|\s*(?:Content Rewards|Whop).*/i, '').trim()
      if (candidate && candidate.toLowerCase() !== 'content rewards' && candidate.toLowerCase() !== 'whop') {
        rawTitle = candidate
      }
    }

    if (!rawTitle) {
      const nameRegex = /"name"\s*:\s*"([^"]+)"/g
      let nm: RegExpExecArray | null
      while ((nm = nameRegex.exec(html)) !== null) {
        const val = nm[1].trim()
        if (
          val.length > 2 &&
          !val.startsWith('/') &&
          !val.includes('{') &&
          !META_TAG_NAMES.has(val.toLowerCase()) &&
          !val.toLowerCase().startsWith('twitter:') &&
          !val.toLowerCase().startsWith('og:') &&
          val.toLowerCase() !== 'content rewards'
        ) {
          rawTitle = val
          break
        }
      }
    }

    if (!rawTitle) {
      const pubCompanyMatch = html.match(/"publicCompany"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/)
      if (pubCompanyMatch?.[1]) {
        rawTitle = pubCompanyMatch[1].trim()
      }
    }

    if (!rawTitle || rawTitle === 'Campaign' || rawTitle.toLowerCase() === 'content rewards') {
      rawTitle = parsedWhop?.companySlug
        ? `${parsedWhop.companySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Campaign`
        : 'Whop Campaign'
    }

    // Extract Payout
    let detectedPayout: string | null = null
    const rateMatch =
      html.match(/"rateCents"\s*:\s*(\d+)/) ||
      html.match(/"ratePerKCents"\s*:\s*(\d+)/) ||
      html.match(/"cpmCents"\s*:\s*(\d+)/) ||
      html.match(/"primaryPayoutCents"\s*:\s*(\d+)/)
    const maxPayoutMatch = html.match(/"maxPayoutCents"\s*:\s*(\d+)/) || html.match(/"maxPayout"\s*:\s*(\d+)/)
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

    // Extract explicit campaign guidelines / dos / requirements from Whop JSON if present
    const extractedGuidelines: string[] = []
    const descMatch = html.match(/"description"\s*:\s*"([^"]{10,400})"/)
    if (descMatch && !descMatch[1].includes('Find campaigns, submit clips')) {
      extractedGuidelines.push(descMatch[1].replace(/\\n/g, ' ').trim())
    }
    const dosMatch = html.match(/"dos"\s*:\s*"([^"]{5,500})"/)
    if (dosMatch) {
      for (const line of dosMatch[1].split(/\\n|\n/)) {
        const cleanLine = line.trim()
        if (cleanLine.length > 4) extractedGuidelines.push(cleanLine)
      }
    }
    const reqItemsMatch = html.match(/"contentRequirements"\s*:\s*\{\s*"items"\s*:\s*\[([^\]]+)\]/)
    if (reqItemsMatch) {
      const items = reqItemsMatch[1].match(/"([^"]+)"/g) || []
      for (const item of items) {
        const cleanItem = item.replace(/^"|"$/g, '').trim()
        if (cleanItem) extractedGuidelines.push(cleanItem)
      }
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
    const requiresExternalSource = !isHub && rawAssets.length === 0

    const hubMessage = isHub
      ? `تم التعرف على مساحة ${rawTitle} بنجاح. لبدء القص التلقائي، افتح الحملة المطلوبة والصق رابطها (مثال: .../app/campaigns/id) أو الصق رابط الفيديو الخام (YouTube / Google Drive) المرفق بها.`
      : requiresExternalSource
        ? `تم استخراج شروط حملة "${rawTitle}" بنجاح (وتم استبعاد مقاطع المتسابقين الجاهزة من جدول المتصدرين). الفيديوهات الخام لهذه الحملة موجودة في روابط دليل الحملة أدناه — افتح رابط المادة الخام والصق رابط الفيديو الطويل (YouTube أو Google Drive) أو ارفع الفيديو مباشرة.`
        : null

    const campaignAnalysis = {
      title: rawTitle,
      payout: detectedPayout,
      guidelines:
        extractedGuidelines.length > 0
          ? extractedGuidelines.slice(0, 6)
          : [
              'Extract high-retention viral moments',
              'Include catchy opening hook in the first 3 seconds',
              'Use punchy kinetic captions',
            ],
      requiredHashtags: [] as string[],
      recommendedInstructions: isHub
        ? `Focus on high-energy viral clips tailored for ${rawTitle}. Keep cadence punchy for TikTok and Reels.`
        : extractedGuidelines.length > 0
          ? extractedGuidelines.join('. ').slice(0, 450)
          : 'Focus on high energy viral moments that match the campaign guidelines.',
      recommendedAssetUrl: rawAssets[0]?.url || '',
      aiRationale: rawAssets.length > 0 ? 'Verified raw source footage detected for this campaign.' : '',
      recommendedCaptionStyle: 'hormozi',
      campaignHook: '',
    }

    try {
      const assetsPrompt = rawAssets
        .map((a, i) => `[Asset ${i + 1}] Type: ${a.type} | URL: ${a.url} | Label: ${a.label}`)
        .join('\n')

      const promptSystem =
        'You are a clipping campaign director and viral media strategist for TikTok, YouTube Shorts, and Instagram Reels. ' +
        'Analyze the provided web page text and detected raw media assets of a clipping bounty/campaign (from platforms like Whop, ContentReward, etc.). ' +
        'Understand the core objectives, rules, and footage to formulate an integrated viral clip strategy. ' +
        'Output a valid JSON object with: ' +
        'title (string), payout (string or null), guidelines (string array), requiredHashtags (string array), ' +
        'recommendedInstructions (string: instructions for the video cutter/scoring AI ensuring all campaign criteria and hooks are satisfied), ' +
        'campaignHook (string: opening viral title hook text under 6 words), ' +
        'recommendedCaptionStyle (string: one of ["hormozi", "neon", "luxury", "beast", "bold"]), ' +
        'recommendedAssetUrl (string: the exact URL from the detected assets list that is the best primary raw footage to use for the clip), ' +
        'aiRationale (string: 1 clear sentence explaining why this specific raw asset was chosen).'

      const aiRes = await executeAiChatCompletion({
        responseFormat: 'json_object',
        temperature: 0.2,
        messages: [
          { role: 'system', content: promptSystem },
          {
            role: 'user',
            content: `Campaign Title: ${rawTitle}\nCampaign URL: ${campaignUrl}\nExtracted Rules: ${extractedGuidelines.join(' | ')}\n\nPage Text:\n${cleanText}\n\nDetected Raw Media Assets:\n${assetsPrompt || 'None detected'}`,
          },
        ],
      })

      const parsedJson = (aiRes.parsedJson || {}) as Record<string, unknown>
      if (
        typeof parsedJson.title === 'string' &&
        parsedJson.title &&
        parsedJson.title.toLowerCase() !== 'content rewards'
      ) {
        campaignAnalysis.title = parsedJson.title
      }
      if (!campaignAnalysis.payout && typeof parsedJson.payout === 'string' && parsedJson.payout) {
        campaignAnalysis.payout = parsedJson.payout
      }
      if (
        extractedGuidelines.length === 0 &&
        Array.isArray(parsedJson.guidelines) &&
        parsedJson.guidelines.length
      ) {
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

    // Determine the primary raw asset (prefer individual video files over folder containers)
    let primaryAsset = rawAssets.find(
      (a) => a.url === campaignAnalysis.recommendedAssetUrl && !a.url.includes('/folders/')
    )
    if (!primaryAsset && rawAssets.length > 0) {
      primaryAsset =
        rawAssets.find((a) => a.type === 'youtube') ||
        rawAssets.find((a) => a.type === 'drive' && !a.url.includes('/folders/')) ||
        rawAssets.find((a) => a.type === 'direct') ||
        rawAssets.find((a) => a.type === 'drive') ||
        rawAssets[0]
      campaignAnalysis.recommendedAssetUrl = primaryAsset.url
      if (!campaignAnalysis.aiRationale) {
        campaignAnalysis.aiRationale = 'Selected as the primary raw source footage matching campaign criteria.'
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
        referenceLinks,
        isHub: isHub || requiresExternalSource,
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
