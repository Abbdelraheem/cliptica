import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'
import type { CampaignSubmission } from '@prisma/client'

const execAsync = promisify(exec)

export interface TrackResult {
  views: number
  likes: number
  comments: number
  platform: 'TIKTOK' | 'INSTAGRAM' | 'YOUTUBE' | 'UNKNOWN'
  title?: string
  description?: string
  uploader?: string
  verified: boolean
  notes: string
  earnings: number
}

/**
 * Detects social platform from URL.
 */
export function detectPlatform(url: string): 'TIKTOK' | 'INSTAGRAM' | 'YOUTUBE' | 'UNKNOWN' {
  if (/tiktok\.com/i.test(url)) return 'TIKTOK'
  if (/instagram\.com/i.test(url)) return 'INSTAGRAM'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YOUTUBE'
  return 'UNKNOWN'
}

/**
 * Extracts live video statistics using yt-dlp metadata inspection.
 */
export async function fetchVideoStatsWithYtDlp(url: string): Promise<{
  views: number
  likes: number
  comments: number
  title: string
  description: string
  uploader: string
}> {
  try {
    // Run yt-dlp in JSON dump mode without downloading the video
    const cmd = `yt-dlp --dump-json --skip-download --no-warnings --no-check-certificates "${url}"`
    const { stdout } = await execAsync(cmd, { timeout: 20000 })
    const data = JSON.parse(stdout)

    const views = Number(data.view_count ?? data.views ?? 0)
    const likes = Number(data.like_count ?? data.likes ?? 0)
    const comments = Number(data.comment_count ?? data.comments ?? 0)
    const title = String(data.title ?? '')
    const description = String(data.description ?? '')
    const uploader = String(data.uploader ?? data.channel ?? '')

    return { views, likes, comments, title, description, uploader }
  } catch (err) {
    console.warn(`[campaign-tracker] yt-dlp metadata failed for ${url}:`, err instanceof Error ? err.message : err)
    // Fallback: Return 0 views gracefully so submission isn't blocked
    return { views: 0, likes: 0, comments: 0, title: '', description: '', uploader: '' }
  }
}

/**
 * Verifies submission against campaign requirements and computes earnings.
 */
export async function verifyAndTrackSubmission(
  submissionId: string
): Promise<CampaignSubmission | null> {
  const submission = await prisma.campaignSubmission.findUnique({
    where: { id: submissionId },
    include: { campaign: true },
  })

  if (!submission || !submission.campaign) return null
  const { campaign, postUrl } = submission

  const platform = detectPlatform(postUrl)
  const stats = await fetchVideoStatsWithYtDlp(postUrl)

  // 1. Check Platform match
  let platformAllowed = true
  if (Array.isArray(campaign.platforms) && campaign.platforms.length > 0) {
    const allowed = (campaign.platforms as string[]).map((p) => p.toUpperCase())
    platformAllowed = allowed.includes(platform)
  }

  // 2. Check Min Views requirement
  const minViews = campaign.minViews ?? 1000
  const viewsMet = stats.views >= minViews

  // 3. Check Required Hashtags / Rules
  let rulesMet = true
  const notesList: string[] = []

  if (!platformAllowed) {
    rulesMet = false
    notesList.push(`Platform (${platform}) is not included in the approved campaign platforms.`)
  }

  if (stats.views < minViews) {
    notesList.push(`Current views (${stats.views.toLocaleString()}) are below the minimum threshold (${minViews.toLocaleString()}).`)
  } else {
    notesList.push(`Minimum views requirement met (${stats.views.toLocaleString()} views).`)
  }

  // Check hashtags if mentioned in rules
  if (campaign.rules) {
    const hashtagMatches = campaign.rules.match(/#[a-zA-Z0-9_\u0600-\u06FF]+/g) || []
    for (const tag of hashtagMatches) {
      const lowerTag = tag.toLowerCase()
      const inDesc = stats.description.toLowerCase().includes(lowerTag)
      const inTitle = stats.title.toLowerCase().includes(lowerTag)
      if (!inDesc && !inTitle) {
        notesList.push(`Required hashtag (${tag}) is missing from the video description.`)
        rulesMet = false
      }
    }
  }

  // 4. Calculate Earnings
  const ratePer1k = Number(campaign.ratePer1k) || 0
  const rawEarnings = (stats.views / 1000) * ratePer1k

  let finalEarnings = rawEarnings
  if (campaign.maxPayout && Number(campaign.maxPayout) > 0) {
    finalEarnings = Math.min(Number(campaign.maxPayout), finalEarnings)
  }

  const isVerified = platformAllowed && viewsMet && rulesMet

  const updated = await prisma.campaignSubmission.update({
    where: { id: submission.id },
    data: {
      platform,
      views: stats.views,
      likes: stats.likes,
      comments: stats.comments,
      earnings: finalEarnings,
      verified: isVerified,
      status: isVerified ? 'APPROVED' : 'PENDING',
      verificationNotes: notesList.join(' | '),
      lastCheckedAt: new Date(),
    },
  })

  return updated
}
