import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertPublicHttpUrl } from '@/lib/ssrf'
import { executeAiChatCompletion } from '@/lib/ai-provider'
import { prisma } from '@/lib/prisma'

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
 * Unwraps Google Docs `/url?q=...` redirect links and decodes URL-encoded characters
 * so embedded YouTube (`watch%3Fv%3D`), Google Drive, and Dropbox URLs are cleanly extracted.
 */
function unwrapGoogleRedirectUrls(text: string): string {
  return text.replace(
    /https?:\/\/(?:www\.)?google\.com\/url\?q=([^"'&\s<>]+)[^"'\s<>]*/gi,
    (_full, encodedTarget) => {
      try {
        return decodeURIComponent(encodedTarget.replace(/&amp;/g, '&'))
      } catch {
        return encodedTarget
      }
    }
  )
}

/**
 * Normalizes a media URL so we can reliably check whether a user already clipped it.
 */
function normalizeMediaUrlKey(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim()
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/)
  if (driveFileMatch) return `drive:${driveFileMatch[1]}`
  const ytMatch =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `yt:${ytMatch[1]}`
  return trimmed.replace(/[?&]sa=D&source=editors.*$/i, '').toLowerCase()
}

/**
 * Parses a YouTube duration string like "12:48" or "1:05:20" into total seconds.
 */
function parseDurationToSeconds(durStr: string): number {
  const parts = durStr.split(':').map((p) => parseInt(p, 10))
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

/**
 * Searches YouTube for long-form raw source videos (2.5m to 19.5m) matching AI-generated
 * campaign queries, automatically excluding Shorts (<150s), multi-hour marathons, and
 * any video the user has already clipped in previous projects.
 */
async function searchYoutubeLongFormVideos(
  queries: string[],
  usedKeys: Set<string>,
  reqHeaders: Record<string, string>,
  minSec = 180,
  maxSec = Infinity
): Promise<Array<{ type: 'youtube'; url: string; label: string }>> {
  const cleanQueries = Array.from(new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 3))).slice(0, 3)
  const discovered: Array<{ type: 'youtube'; url: string; label: string }> = []
  const seenKeys = new Set<string>()

  await Promise.all(
    cleanQueries.map(async (query) => {
      try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        const res = await fetch(searchUrl, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(4500),
        })
        if (!res.ok) return
        const html = await res.text()
        if (!html || !html.includes('videoRenderer')) return

        const chunks = html.split('"videoRenderer":{"videoId":"').slice(1, 14)
        for (const chunk of chunks) {
          const videoId = chunk.slice(0, 11)
          if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) continue
          const url = `https://www.youtube.com/watch?v=${videoId}`
          const key = normalizeMediaUrlKey(url)
          if (usedKeys.has(key) || seenKeys.has(key)) continue

          const titleMatch = chunk.match(/"title":\{"runs":\[\{"text":"([^"]+)"/)
          const lenMatch = chunk.match(/"lengthText":\{[^}]*?"simpleText":"([0-9:]+)"/)
          if (!titleMatch || !lenMatch) continue

          const durStr = lenMatch[1]
          const durSec = parseDurationToSeconds(durStr)
          // Require long-form videos (>= minSec, no upper limit!) — never Shorts or ready-made micro-clips
          if (durSec < minSec || durSec > maxSec) continue

          const vTitle = titleMatch[1].replace(/\\u0026/g, '&').trim()
          if (/#shorts|\bshorts\b|\btiktok\b/i.test(vTitle)) continue

          seenKeys.add(key)
          discovered.push({
            type: 'youtube',
            url,
            label: `🤖 AI Raw Source (${durStr}): ${vTitle.slice(0, 75)}`,
          })
          if (discovered.length >= 6) break
        }
      } catch {
        // Ignore individual search failure
      }
    })
  )

  return discovered.slice(0, 6)
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

    // Look up this user's previously used sourceUrls so we never repeat the same video
    const usedSourceKeys = new Set<string>()
    try {
      const pastProjects = await prisma.project?.findMany?.({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: { sourceUrl: true },
      })
      if (Array.isArray(pastProjects)) {
        for (const p of pastProjects) {
          if (p.sourceUrl) usedSourceKeys.add(normalizeMediaUrlKey(p.sourceUrl))
        }
      }
    } catch {
      // Non-blocking if DB query is unavailable in test mocks
    }

    const parsedWhop = parseWhopUrl(campaignUrl)
    const isWhop = !!parsedWhop

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
    const html = unwrapGoogleRedirectUrls(stripLeaderboardSections(unescapedHtml))

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

    // If any reference link is a public Google Doc, fetch its mobilebasic view and unwrap Google redirects
    let supplementalHtml = ''
    const fetchedDocIds = new Set<string>()
    for (const ref of referenceLinks.slice(0, 4)) {
      const gdocMatch = ref.url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i)
      if (gdocMatch && !fetchedDocIds.has(gdocMatch[1])) {
        fetchedDocIds.add(gdocMatch[1])
        try {
          const docResp = await fetch(`https://docs.google.com/document/d/${gdocMatch[1]}/mobilebasic`, {
            headers: reqHeaders,
            signal: AbortSignal.timeout(8000),
          })
          if (docResp.ok) {
            const docText = unwrapGoogleRedirectUrls(await docResp.text())
            supplementalHtml += '\n' + docText
            // Also fetch up to 2 nested Google Docs linked inside the main campaign brief (e.g. "Content Bank")
            const nestedDocs = docText.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{15,})/gi) || []
            for (const nd of nestedDocs.slice(0, 2)) {
              const nid = nd.split('/d/')[1]
              if (nid && !fetchedDocIds.has(nid)) {
                fetchedDocIds.add(nid)
                try {
                  const ndResp = await fetch(`https://docs.google.com/document/d/${nid}/mobilebasic`, {
                    headers: reqHeaders,
                    signal: AbortSignal.timeout(6000),
                  })
                  if (ndResp.ok) {
                    supplementalHtml += '\n' + unwrapGoogleRedirectUrls(await ndResp.text())
                  }
                } catch {}
              }
            }
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

    // 2. Google Drive (expand folders first, then verify all Drive files to filter out images & <25MB pre-edited example clips)
    const driveMatches =
      combinedSearchHtml.match(/https?:\/\/(?:drive|docs)\.google\.com\/(?:drive\/folders|file\/d)\/[^\s"'<>\\]+/gi) ||
      []
    const driveFoldersToExpand: string[] = []
    const driveCandidates = new Map<string, string>() // fileId -> known title hint
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
        if (!driveFoldersToExpand.includes(clean) && driveFoldersToExpand.length < 4) {
          driveFoldersToExpand.push(clean)
        }
        if (!referenceLinks.some((r) => r.url === clean)) {
          referenceLinks.push({ url: clean, label: 'Google Drive Campaign Folder' })
        }
      } else if (fileIdMatch) {
        const fileId = fileIdMatch[1]
        if (!driveCandidates.has(fileId) && driveCandidates.size < 16) {
          driveCandidates.set(fileId, '')
        }
      }
    }

    for (const folderUrl of driveFoldersToExpand) {
      const expandedFiles = await expandGoogleDriveFolder(folderUrl, reqHeaders)
      for (const fileAsset of expandedFiles) {
        const m = fileAsset.url.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/)
        if (m && !driveCandidates.has(m[1]) && driveCandidates.size < 20) {
          const cleanHint = fileAsset.label.replace(/^Google Drive Video:\s*/i, '').trim()
          driveCandidates.set(m[1], cleanHint)
        }
      }
    }

    const exampleClipTitles: string[] = []
    const verifiedDriveResults = await Promise.all(
      Array.from(driveCandidates.entries()).slice(0, 14).map(async ([fileId, titleHint]) => {
        const canonicalFileUrl = `https://drive.google.com/file/d/${fileId}/view`
        let status: 'raw_video' | 'example_clip' | 'brand_asset' | 'unverified' = 'unverified'
        let fileName = titleHint || ''
        let sizeMb = ''
        try {
          const headRes = await fetch(
            `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
            { method: 'HEAD', headers: reqHeaders, signal: AbortSignal.timeout(4000) }
          )
          if (headRes.ok && headRes.headers) {
            const cType = (headRes.headers.get('content-type') || '').toLowerCase()
            const cDisp = headRes.headers.get('content-disposition') || ''
            const cLen = parseInt(headRes.headers.get('content-length') || '0', 10)
            const fnMatch = cDisp.match(/filename="([^"]+)"/i)
            if (fnMatch?.[1]) fileName = fnMatch[1]
            if (
              cType.startsWith('image/') ||
              cType.startsWith('application/pdf') ||
              /\.(png|jpe?g|gif|webp|svg|pdf|zip|rar|psd|ai)$/i.test(fileName)
            ) {
              status = 'brand_asset'
            } else if (cLen > 0 && cLen < 25 * 1024 * 1024) {
              // Any Drive video under 25MB is a short pre-edited clip (<90s), NOT a full long-form raw stream!
              status = 'example_clip'
              sizeMb = (cLen / (1024 * 1024)).toFixed(1)
            } else if (cLen >= 25 * 1024 * 1024) {
              status = 'raw_video'
              sizeMb = (cLen / (1024 * 1024)).toFixed(0)
            }
          }
        } catch {}

        return { fileId, canonicalFileUrl, status, fileName, sizeMb }
      })
    )

    const hasShortExampleClips = verifiedDriveResults.some((r) => r.status === 'example_clip')
    const hasConfirmedLargeRawDrive = verifiedDriveResults.some((r) => r.status === 'raw_video')

    for (const item of verifiedDriveResults) {
      if (item.status === 'brand_asset') {
        if (!referenceLinks.some((r) => r.url === item.canonicalFileUrl)) {
          referenceLinks.push({
            url: item.canonicalFileUrl,
            label: item.fileName ? `Brand Asset (${item.fileName})` : 'Google Drive Brand Asset',
          })
        }
        continue
      }

      const looksLikeRawLongFormTitle = /\b(raw|podcast|episode|ep\s*\d|full\s*stream|vod|interview|lecture)\b/i.test(
        item.fileName
      )

      // If this file is a <25MB short clip, OR if it's an unverified file inside a folder/doc of short example clips
      if (
        item.status === 'example_clip' ||
        (item.status === 'unverified' && hasShortExampleClips && !hasConfirmedLargeRawDrive && !looksLikeRawLongFormTitle)
      ) {
        if (item.fileName) exampleClipTitles.push(item.fileName.replace(/\.(mp4|mov|webm|mkv)$/i, ''))
        if (!referenceLinks.some((r) => r.url === item.canonicalFileUrl)) {
          referenceLinks.push({
            url: item.canonicalFileUrl,
            label: item.fileName
              ? `Pre-Edited Example Clip (${item.fileName}${item.sizeMb ? ` · ${item.sizeMb}MB` : ''})`
              : 'Pre-Edited Example Clip',
          })
        }
        continue
      }

      if (!assetMap.has(item.canonicalFileUrl)) {
        assetMap.set(item.canonicalFileUrl, {
          type: 'drive',
          url: item.canonicalFileUrl,
          label: item.fileName ? `Google Drive Video: ${item.fileName}` : 'Google Drive Raw Video File',
        })
      }
    }

    // 3. YouTube (only long-form watch?v= or youtu.be links, excluding shorts/competitor reels)
    const ytMatches =
      combinedSearchHtml.match(
        /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}|youtu\.be\/[a-zA-Z0-9_-]{11})/gi
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

    // Include both Whop page text and Google Doc brief text so the AI sees all creators, rules, and context
    const cleanMainText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3500)
    const cleanDocText = supplementalHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3500)
    const cleanText = cleanDocText
      ? `${cleanMainText}\n\n[Campaign Google Doc / Brief Content]:\n${cleanDocText}`
      : cleanMainText

    let rawAssets = Array.from(assetMap.values())

    const campaignAnalysis = {
      title: rawTitle,
      payout: detectedPayout,
      guidelines:
        extractedGuidelines.length > 0
          ? extractedGuidelines.slice(0, 6)
          : [
              'Extract high-retention viral moments (30s-60s complete narrative arcs)',
              'Include catchy opening hook in the first 3 seconds',
              'Use punchy kinetic captions',
            ],
      requiredHashtags: [] as string[],
      recommendedInstructions:
        extractedGuidelines.length > 0
          ? extractedGuidelines.join('. ').slice(0, 450)
          : 'Focus on complete, high-energy viral moments (30-60 seconds, maximum 60 seconds) that start on a strong opening hook, build tension, and finish the full payoff matching the campaign guidelines.',
      recommendedAssetUrl: rawAssets[0]?.url || '',
      aiRationale: rawAssets.length > 0 ? 'Verified raw source footage detected for this campaign.' : '',
      recommendedCaptionStyle: 'hormozi',
      campaignHook: '',
      searchQueries: [] as string[],
    }

    try {
      const assetsPrompt = rawAssets
        .map((a, i) => {
          const alreadyUsed = usedSourceKeys.has(normalizeMediaUrlKey(a.url))
          return `[Asset ${i + 1}] Type: ${a.type} | URL: ${a.url} | Label: ${a.label}${alreadyUsed ? ' (ALREADY USED BY USER - DO NOT REPEAT IF OTHER ASSETS EXIST)' : ''}`
        })
        .join('\n')

      const examplesHint =
        exampleClipTitles.length > 0
          ? `\nExample Clip Titles Found in Campaign Brief (use these creator/streamer names to generate searchQueries for long-form YouTube videos >= 3 minutes!): ${exampleClipTitles.join(' | ')}`
          : ''

      const promptSystem =
        'You are an autonomous AI clipping campaign director and viral media strategist for TikTok, YouTube Shorts, and Instagram Reels. ' +
        'Analyze the provided web page text, Google Doc campaign brief, example clip titles, and detected raw media assets of a clipping bounty/campaign. ' +
        'Understand the exact creators/streamers, brand, core objectives, and rules to formulate an integrated viral clip strategy AND discover fresh long-form raw videos (>= 3 minutes) on YouTube. ' +
        'Output a valid JSON object with: ' +
        'title (string), payout (string or null), guidelines (string array), requiredHashtags (string array), ' +
        'recommendedInstructions (string: detailed instructions for the AI video cutter/director specifying what moments, creators, hooks, and 30s-60s narrative arcs [max 60s] to extract), ' +
        'campaignHook (string: opening viral title hook text under 6 words), ' +
        'recommendedCaptionStyle (string: one of ["hormozi", "neon", "luxury", "beast", "bold"]), ' +
        'recommendedAssetUrl (string: the exact URL from the detected assets list that is the best UNUSED long-form raw footage), ' +
        'aiRationale (string: 1 clear sentence explaining why this raw asset and cutting strategy were chosen), ' +
        'searchQueries (array of 3 specific YouTube search queries to find raw long-form streams/videos/highlights [at least 3 minutes long] featuring the exact creators, streamers, or brand mentioned in this campaign brief and example titles so we can cut fresh clips from scratch).'

      const aiRes = await executeAiChatCompletion({
        responseFormat: 'json_object',
        temperature: 0.2,
        messages: [
          { role: 'system', content: promptSystem },
          {
            role: 'user',
            content: `Campaign Title: ${rawTitle}\nCampaign URL: ${campaignUrl}\nExtracted Rules: ${extractedGuidelines.join(' | ')}${examplesHint}\n\nPage & Brief Text:\n${cleanText}\n\nDetected Raw Media Assets:\n${assetsPrompt || 'None detected yet — provide strong searchQueries to find raw long-form YouTube footage for this campaign!'}`,
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
      if (Array.isArray(parsedJson.searchQueries)) {
        campaignAnalysis.searchQueries = parsedJson.searchQueries.map(String).filter(Boolean)
      }
    } catch (aiErr) {
      console.warn('AI campaign analysis fallback:', aiErr)
    }

    // Always run AI YouTube Search for long-form raw videos (3m-19.5m) unless the campaign already has >=2 unused YouTube VODs
    const unusedYoutubeAssets = rawAssets.filter(
      (a) => a.type === 'youtube' && !usedSourceKeys.has(normalizeMediaUrlKey(a.url))
    )
    const isHubOnlyUrl =
      isWhop && !parsedWhop?.campaignId && rawAssets.length === 0 && referenceLinks.length === 0

    if (!isHubOnlyUrl && unusedYoutubeAssets.length < 2) {
      const cleanedTitle = campaignAnalysis.title.replace(/campaign|v\d+|by/gi, ' ').replace(/\s+/g, ' ').trim()
      const exampleKeywords = exampleClipTitles
        .slice(0, 2)
        .map((t) => t.replace(/\$?\d+[kKmM]?/g, '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length >= 3)

      const searchQueries = [
        ...campaignAnalysis.searchQueries,
        ...exampleKeywords.map((kw) => `${kw} ${cleanedTitle.split(' ')[0] || ''} highlights`.trim()),
        `${cleanedTitle} gameplay highlights`,
        `${cleanedTitle} full stream`,
      ]
      const aiDiscoveredVideos = await searchYoutubeLongFormVideos(
        searchQueries,
        usedSourceKeys,
        reqHeaders
      )
      // Prepend AI-discovered long-form YouTube videos so they are prioritized first
      const combined = [...aiDiscoveredVideos, ...rawAssets]
      assetMap.clear()
      for (const item of combined) {
        if (!assetMap.has(item.url)) assetMap.set(item.url, item)
      }
      rawAssets = Array.from(assetMap.values())
    }

    // Determine the primary raw asset: strictly prefer UNUSED long-form YouTube videos or verified >25MB raw files
    const isUnusedIndividualVideo = (a: { url: string }) =>
      !a.url.includes('/folders/') && !usedSourceKeys.has(normalizeMediaUrlKey(a.url))

    const primaryAsset =
      rawAssets.find((a) => a.type === 'youtube' && isUnusedIndividualVideo(a) && a.label.startsWith('🤖')) ||
      rawAssets.find(
        (a) => a.url === campaignAnalysis.recommendedAssetUrl && isUnusedIndividualVideo(a)
      ) ||
      rawAssets.find((a) => a.type === 'youtube' && isUnusedIndividualVideo(a)) ||
      rawAssets.find((a) => a.type === 'drive' && isUnusedIndividualVideo(a)) ||
      rawAssets.find((a) => a.type === 'direct' && isUnusedIndividualVideo(a)) ||
      rawAssets.find((a) => a.type === 'youtube') ||
      rawAssets.find((a) => a.type === 'drive' && !a.url.includes('/folders/')) ||
      rawAssets.find((a) => a.type === 'direct') ||
      rawAssets[0]

    if (primaryAsset) {
      campaignAnalysis.recommendedAssetUrl = primaryAsset.url
      if (!campaignAnalysis.aiRationale || primaryAsset.label.startsWith('🤖')) {
        campaignAnalysis.aiRationale = primaryAsset.label.startsWith('🤖')
          ? `AI discovered fresh, unused long-form source footage (${primaryAsset.label.replace(/^🤖\s*/, '')}) matching the campaign brief so clips are cut from scratch without duplicates.`
          : 'Selected as the best unused raw source footage matching campaign criteria.'
      }
    }

    const isHub = isWhop && !parsedWhop?.campaignId && rawAssets.length === 0
    const requiresExternalSource = !isHub && rawAssets.length === 0

    const hubMessage = isHub
      ? `تم التعرف على مساحة ${rawTitle} بنجاح. لبدء القص التلقائي، افتح الحملة المطلوبة والصق رابطها (مثال: .../app/campaigns/id) أو الصق رابط الفيديو الخام (YouTube / Google Drive) المرفق بها.`
      : requiresExternalSource
        ? `تم استخراج شروط حملة "${rawTitle}" بنجاح (وتم استبعاد مقاطع المتسابقين الجاهزة من جدول المتصدرين). الفيديوهات الخام لهذه الحملة موجودة في روابط دليل الحملة أدناه — افتح رابط المادة الخام والصق رابط الفيديو الطويل (YouTube أو Google Drive) أو ارفع الفيديو مباشرة.`
        : null

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
