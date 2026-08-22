import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M'
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

export function getViralScoreColor(score: number): string {
  if (score >= 90) return 'text-green-500'
  if (score >= 75) return 'text-yellow-500'
  if (score >= 60) return 'text-orange-500'
  return 'text-red-500'
}

export function getViralScoreBg(score: number): string {
  if (score >= 90) return 'bg-green-500/10 border-green-500/20'
  if (score >= 75) return 'bg-yellow-500/10 border-yellow-500/20'
  if (score >= 60) return 'bg-orange-500/10 border-orange-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

export function calculateEstimatedEarnings(views: number, ratePer1k: number): number {
  return (views / 1000) * ratePer1k
}

export function generateApiKey(): string {
  return `ck_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
}

export function validateVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const validHosts = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'tiktok.com',
      'instagram.com',
      'facebook.com',
      'twitter.com',
      'x.com',
    ]
    return validHosts.some(host => parsed.hostname.includes(host))
  } catch {
    return false
  }
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.slice(1)
      }
      return parsed.searchParams.get('v')
    }
    if (parsed.hostname.includes('vimeo.com')) {
      return parsed.pathname.split('/').pop() || null
    }
    return null
  } catch {
    return null
  }
}