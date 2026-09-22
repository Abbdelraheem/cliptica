'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Megaphone,
  Plus,
  Eye,
  DollarSign,
  Loader2,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  RefreshCw,
  Share2,
  Lock,
  Coins,
  Film,
  Award,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

type Campaign = {
  id: string
  name: string
  type: 'WHOP_CONTENT_REWARDS' | 'BRAND_DEAL' | 'OWN_CHANNEL'
  imageUrl?: string | null
  description?: string | null
  rules?: string | null
  sourceUrls: string[]
  platforms: string[]
  ratePer1k: string | number
  flatFee?: string | number | null
  minPayout?: string | number | null
  maxPayout?: string | number | null
  minViews?: number | null
  budget?: string | number | null
  deadline?: string | null
  isActive: boolean
  _count: { clips: number; submissions: number }
  user?: { id: string; name: string | null; email: string }
  submissions?: {
    id: string
    postUrl: string
    platform: string
    views: number
    earnings: string | number
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
    verified: boolean
  }[]
}

type UserSubmission = {
  id: string
  campaignId: string
  postUrl: string
  platform: string
  views: number
  likes: number
  comments: number
  earnings: string | number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
  verified: boolean
  verificationNotes?: string | null
  lastCheckedAt?: string | null
  campaign?: {
    id: string
    name: string
    ratePer1k: string | number
    imageUrl?: string | null
    platforms: string[]
  }
}

const TYPE_LABEL: Record<Campaign['type'], string> = {
  WHOP_CONTENT_REWARDS: 'مكافآت محتوى (Whop / Rewards)',
  BRAND_DEAL: 'صفقة إعلانية تجارية (Brand Deal)',
  OWN_CHANNEL: 'قناة وفريق عمل خاص (Own Channel)',
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  return Number(v) || 0
}

export default function CampaignsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'explore' | 'my-submissions'>('explore')
  const [creating, setCreating] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [participatingCampaign, setParticipatingCampaign] = useState<Campaign | null>(null)
  const [submitUrl, setSubmitUrl] = useState('')
  const [refreshingSubId, setRefreshingSubId] = useState<string | null>(null)

  // Fetch campaigns and submissions
  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/campaigns')
      if (!res.ok) throw new Error('Failed to load campaigns')
      return res.json() as Promise<{
        campaigns: Campaign[]
        mySubmissions: UserSubmission[]
        canCreate: boolean
      }>
    },
  })

  const campaigns = campaignsQuery.data?.campaigns ?? []
  const mySubmissions = campaignsQuery.data?.mySubmissions ?? []
  const canCreate = Boolean(campaignsQuery.data?.canCreate)

  // Submit Video Mutation
  const submitVideoMutation = useMutation({
    mutationFn: async ({ campaignId, postUrl }: { campaignId: string; postUrl: string }) => {
      const res = await fetch(`/api/campaigns/${campaignId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'فشل تقديم الفيديو')
      }
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'تم تقديم الفيديو بنجاح!')
      setParticipatingCampaign(null)
      setSubmitUrl('')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setActiveTab('my-submissions')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Refresh Views Mutation
  const refreshViewsMutation = useMutation({
    mutationFn: async ({ campaignId, submissionId }: { campaignId: string; submissionId: string }) => {
      setRefreshingSubId(submissionId)
      const res = await fetch(`/api/campaigns/${campaignId}/submissions/${submissionId}/refresh`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'فشل تحديث المشاهدات')
      }
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'تم تحديث المشاهدات بنجاح!')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
    onSettled: () => {
      setRefreshingSubId(null)
    },
  })

  // Create Campaign Mutation
  const createCampaign = useMutation({
    mutationFn: async (input: {
      name: string
      type: Campaign['type']
      ratePer1k: number
      imageUrl?: string
      description?: string
      rules?: string
      sourceUrls: string[]
      platforms: string[]
      budget?: number
      minPayout?: number
      maxPayout?: number
      minViews?: number
    }) => {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'فشل إنشاء الحملة')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setCreating(false)
      toast.success('تم إنشاء الحملة بنجاح')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Calculate user submission stats
  const totalUserEarnings = mySubmissions.reduce((acc, sub) => acc + num(sub.earnings), 0)
  const totalUserViews = mySubmissions.reduce((acc, sub) => acc + (sub.views || 0), 0)
  const verifiedSubmissionsCount = mySubmissions.filter((s) => s.status === 'APPROVED' || s.verified).length

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="icon-gem !mb-0 !h-8 !w-8 !rounded-lg text-champagne">
              <Award className="h-4 w-4" />
            </span>
            <p className="text-xs uppercase tracking-[0.3em] text-champagne font-semibold">Bounties & Creator Rewards</p>
          </div>
          <h1 className="display-md mt-2 text-3xl font-extrabold text-pearl">حملات مكافآت وصناع المحتوى</h1>
          <p className="mt-1 text-sm font-light text-mist">
            شارك في حملات مكافآت المشاهدات، استغل الفيديوهات الخام لإنتاج مقاطع فايرال، واكسب مقابل كل 1,000 مشاهدة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!canCreate) {
                setShowPermissionModal(true)
              } else {
                setCreating(true)
              }
            }}
            className="btn-lux btn-gold !py-2.5 !px-5 text-sm font-bold flex items-center gap-2 shadow-lg shadow-gold/10"
          >
            <Plus className="h-4 w-4" />
            إنشاء حملة جديدة
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-hair/60 pb-1">
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'explore'
              ? 'border-gold text-gold font-bold'
              : 'border-transparent text-mist hover:text-pearl'
          }`}
        >
          <Film className="h-4 w-4" />
          تصفح الحملات المتاحة للمشاركة ({campaigns.length})
        </button>

        <button
          onClick={() => setActiveTab('my-submissions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'my-submissions'
              ? 'border-gold text-gold font-bold'
              : 'border-transparent text-mist hover:text-pearl'
          }`}
        >
          <Coins className="h-4 w-4" />
          مشاركاتي وتتبع الأرباح ({mySubmissions.length})
        </button>
      </div>

      {/* TAB 1: Explore Campaigns */}
      {activeTab === 'explore' && (
        <div className="space-y-6">
          {/* Quick Explainer Hero */}
          <div className="rounded-2xl border border-hair/80 bg-gradient-to-r from-onyx-2 via-onyx-3 to-onyx-2 p-6 shadow-inner">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-champagne">
                  <Sparkles className="h-3.5 w-3.5" />
                  كيف تكسب من الحملات؟
                </div>
                <h3 className="text-lg font-bold text-pearl">1. حمّل المواد المصدرية → 2. فصّل مقاطعك بـ Cliptica AI → 3. انشر وقدّم رابطك</h3>
                <p className="text-xs text-mist leading-relaxed max-w-3xl">
                  تصفح الحملات أدناه، افتح روابط الفيديوهات الخام لقص أقوى اللحظات، انشر الفيديو على تيك توك، ريلز، أو شورتس مع الشروط المطلوبة، ثم ضع رابط الفيديو لتحتسب مشاهداتك وأرباحك تلقائياً!
                </p>
              </div>
            </div>
          </div>

          {campaignsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-mist">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
              <span className="text-sm font-light">جاري جلب الحملات المتاحة...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hair/50 p-12 text-center">
              <Megaphone className="mx-auto h-12 w-12 text-mist/40" />
              <p className="mt-3 text-base font-medium text-pearl">لا توجد حملات نشطة حالياً</p>
              <p className="mt-1 text-sm text-mist">تواصل مع الإدارة أو راجع الصفحة لاحقاً للمشاركة في أحدث الحملات ومكافآت المحتوى.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => {
                const platforms = c.platforms && c.platforms.length > 0 ? c.platforms : ['TIKTOK', 'INSTAGRAM', 'YOUTUBE']
                const rate = num(c.ratePer1k)
                const budget = num(c.budget)

                return (
                  <article
                    key={c.id}
                    className="glass-card flex flex-col justify-between overflow-hidden rounded-2xl border border-hair/80 bg-onyx-2/90 transition-all duration-300 hover:border-gold/50 hover:shadow-[0_4px_25px_rgba(212,175,55,0.1)]"
                  >
                    <div>
                      {/* Card Cover Image or Gradient */}
                      <div className="relative h-44 w-full overflow-hidden border-b border-hair/60 bg-onyx-3">
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-onyx-3 via-onyx-2 to-hair/20">
                            <Megaphone className="h-10 w-10 text-gold/30" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-onyx/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md border border-hair">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-300">نشطة</span>
                        </div>
                        <div className="absolute top-3 right-3 rounded-full bg-gold/20 px-2.5 py-1 text-[11px] font-bold text-gold backdrop-blur-md border border-gold/30">
                          ${rate.toFixed(2)} / 1K مشاهدة
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-4">
                        <div>
                          <p className="text-[11px] font-semibold text-champagne uppercase tracking-wider">{TYPE_LABEL[c.type]}</p>
                          <h3 className="mt-1 font-display text-xl font-bold text-pearl leading-snug line-clamp-1">{c.name}</h3>
                          {c.description && (
                            <p className="mt-2 text-xs text-mist leading-relaxed line-clamp-2">{c.description}</p>
                          )}
                        </div>

                        {/* Platforms badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {platforms.map((p) => (
                            <span
                              key={p}
                              className="rounded-lg bg-onyx-3 px-2 py-0.5 text-[10px] font-medium text-pearl/80 border border-hair/50"
                            >
                              {p === 'TIKTOK' ? 'TikTok' : p === 'INSTAGRAM' ? 'Instagram Reels' : p === 'YOUTUBE' ? 'YouTube Shorts' : p}
                            </span>
                          ))}
                        </div>

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-onyx/50 p-3 text-xs border border-hair/40">
                          <div>
                            <span className="text-mist text-[11px]">الميزانية الكلية:</span>
                            <p className="font-semibold text-pearl mt-0.5">{budget > 0 ? `$${budget.toLocaleString()}` : 'مفتوحة'}</p>
                          </div>
                          <div>
                            <span className="text-mist text-[11px]">الحد الأدنى للمشاهدات:</span>
                            <p className="font-semibold text-pearl mt-0.5">{(c.minViews ?? 1000).toLocaleString()} مشاهدة</p>
                          </div>
                          {c.maxPayout ? (
                            <div>
                              <span className="text-mist text-[11px]">الحد الأقصى للمكافأة:</span>
                              <p className="font-semibold text-gold mt-0.5">${num(c.maxPayout).toLocaleString()}</p>
                            </div>
                          ) : null}
                          <div>
                            <span className="text-mist text-[11px]">المشاركات:</span>
                            <p className="font-semibold text-pearl mt-0.5">{c._count.submissions} فيديو</p>
                          </div>
                        </div>

                        {/* Source Footage Links (if any) */}
                        {c.sourceUrls && c.sourceUrls.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-champagne flex items-center gap-1">
                              <Film className="h-3 w-3" />
                              الفيديوهات الخام (المواد المصدرية):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {c.sourceUrls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-hair/20 px-2 py-1 text-[11px] text-pearl hover:bg-gold/20 hover:text-gold transition-colors border border-hair/50"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  رابط الفيديو {idx + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rules snippet */}
                        {c.rules && (
                          <div className="rounded-lg bg-onyx/60 p-2.5 text-[11px] text-mist border border-hair/40">
                            <span className="font-semibold text-pearl block mb-0.5">شروط الحملة:</span>
                            <p className="line-clamp-2 leading-relaxed">{c.rules}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-5 pt-0">
                      <button
                        onClick={() => setParticipatingCampaign(c)}
                        className="btn-lux btn-gold w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-md shadow-gold/10"
                      >
                        <Share2 className="h-4 w-4" />
                        شارك وقدم رابط الفيديو
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: My Submissions */}
      {activeTab === 'my-submissions' && (
        <div className="space-y-6">
          {/* Summary Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass-card rounded-2xl border border-hair bg-onyx-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist font-medium">إجمالي الأرباح المستحقة</span>
                <span className="icon-gem !mb-0 !h-8 !w-8 !rounded-lg text-gold">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-gold">
                ${totalUserEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-[11px] text-mist">تُحسب بناءً على المشاهدات المحققة في المنصات</p>
            </div>

            <div className="glass-card rounded-2xl border border-hair bg-onyx-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist font-medium">إجمالي المشاهدات المسجلة</span>
                <span className="icon-gem !mb-0 !h-8 !w-8 !rounded-lg text-pearl">
                  <Eye className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-pearl">
                {totalUserViews.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-mist">عبر TikTok و Instagram Reels و YouTube</p>
            </div>

            <div className="glass-card rounded-2xl border border-hair bg-onyx-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist font-medium">الفيديوهات المشاركة والمعتمدة</span>
                <span className="icon-gem !mb-0 !h-8 !w-8 !rounded-lg text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-emerald-300">
                {verifiedSubmissionsCount} <span className="text-sm font-normal text-mist">/ {mySubmissions.length}</span>
              </p>
              <p className="mt-1 text-[11px] text-mist">فيديوهات مؤهلة لاستحقاق السحب</p>
            </div>
          </div>

          {/* Submissions List */}
          {mySubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hair/50 p-12 text-center">
              <Coins className="mx-auto h-12 w-12 text-mist/40" />
              <p className="mt-3 text-base font-medium text-pearl">لم تشارك بأي فيديو بعد</p>
              <p className="mt-1 text-sm text-mist">
                انتقل إلى تبويب &quot;تصفح الحملات المتاحة&quot;، اختر حملة وقدم رابط الفيديو الخاص بك لبدء جني الأرباح!
              </p>
              <button
                onClick={() => setActiveTab('explore')}
                className="btn-lux btn-gold mt-5 text-sm font-bold inline-flex items-center gap-2"
              >
                <Film className="h-4 w-4" />
                تصفح الحملات الآن
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-hair bg-onyx-2">
              <div className="border-b border-hair px-6 py-4">
                <h3 className="text-base font-bold text-pearl">قائمة الفيديوهات المقدمة ومتابعة المشاهدات</h3>
              </div>
              <div className="divide-y divide-hair/40">
                {mySubmissions.map((sub) => {
                  const isRefreshing = refreshingSubId === sub.id
                  return (
                    <div key={sub.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-onyx-3/40 transition-colors">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-onyx-3 px-2 py-0.5 text-[10px] font-bold text-champagne border border-hair">
                            {sub.platform}
                          </span>
                          <span className="text-xs font-semibold text-pearl">
                            حملة: {sub.campaign?.name ?? 'حملة غير معروفة'}
                          </span>
                          {sub.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> معتمد ومطابق للشروط
                            </span>
                          ) : sub.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
                              <XCircle className="h-3 w-3" /> غير معتمد
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                              <Clock className="h-3 w-3" /> جاري الرصد
                            </span>
                          )}
                        </div>

                        <a
                          href={sub.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline max-w-full truncate"
                        >
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{sub.postUrl}</span>
                        </a>

                        {sub.verificationNotes && (
                          <p className="text-[11px] text-mist">{sub.verificationNotes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <div className="text-left md:text-right">
                          <span className="text-[11px] text-mist block">المشاهدات</span>
                          <span className="text-base font-bold text-pearl flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 text-gold" />
                            {sub.views.toLocaleString()}
                          </span>
                        </div>

                        <div className="text-left md:text-right">
                          <span className="text-[11px] text-mist block">الأرباح المحققة</span>
                          <span className="text-base font-bold text-gold">
                            ${num(sub.earnings).toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            refreshViewsMutation.mutate({
                              campaignId: sub.campaignId,
                              submissionId: sub.id,
                            })
                          }
                          disabled={isRefreshing}
                          title="تحديث عدد المشاهدات والتحقق فوراً"
                          className="btn-lux btn-ghost !p-2 text-mist hover:text-gold hover:border-gold/40 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Submit Video to Campaign */}
      {participatingCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-onyx/85 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setParticipatingCampaign(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-hair bg-onyx-2 p-7 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-champagne font-semibold">تقديم مشاركة</p>
              <h2 className="display-md mt-1 text-2xl font-bold text-pearl">المشاركة في {participatingCampaign.name}</h2>
              <p className="mt-1 text-xs text-mist">
                أدخل رابط الفيديو الذي قمت بنشره على تيك توك، ريلز، أو يوتيوب شورتس ليتم تتبعه وحساب أرباحك فوراً.
              </p>
            </div>

            {/* Campaign Rules Recap */}
            {participatingCampaign.rules && (
              <div className="rounded-xl bg-onyx-3/80 p-3 text-xs text-mist border border-hair/50 space-y-1">
                <span className="font-semibold text-pearl block">شروط الحملة للموافقة على الأرباح:</span>
                <p className="text-[11px] leading-relaxed">{participatingCampaign.rules}</p>
              </div>
            )}

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!submitUrl.trim()) return
                submitVideoMutation.mutate({
                  campaignId: participatingCampaign.id,
                  postUrl: submitUrl.trim(),
                })
              }}
            >
              <div>
                <label className="text-xs font-semibold text-pearl block mb-1.5">
                  رابط الفيديو المنشور (TikTok / Reels / Shorts):
                </label>
                <input
                  required
                  type="url"
                  placeholder="https://www.tiktok.com/@user/video/... أو Instagram Reel أو Shorts"
                  value={submitUrl}
                  onChange={(e) => setSubmitUrl(e.target.value)}
                  className="input-lux w-full text-sm"
                />
              </div>

              <div className="rounded-lg bg-onyx/60 p-3 text-[11px] text-mist flex items-start gap-2 border border-hair/40">
                <Info className="h-4 w-4 text-champagne flex-shrink-0 mt-0.5" />
                <span>
                  يقوم محرك Cliptica بالتأكد من عدد المشاهدات وتفاعل الفيديو تلقائياً وبشكل دوري، وإضافة الأرباح فور تحقق شروط الحملة.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitVideoMutation.isPending || !submitUrl.trim()}
                  className="btn-lux btn-gold flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitVideoMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> جاري الفحص والتسجيل...
                    </>
                  ) : (
                    'تأكيد والمشاركة في الحملة'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setParticipatingCampaign(null)}
                  className="btn-lux btn-ghost py-3 px-5 text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Permission Info for Non-Admin / Unauthorized Users */}
      {showPermissionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPermissionModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-hair bg-onyx-2 p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 border border-gold/30 text-gold mb-4">
              <Lock className="h-7 w-7" />
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-champagne font-semibold">صلاحية محددة</p>
            <h2 className="display-md mt-2 text-2xl font-bold text-pearl">إنشاء الحملات يتطلب إذن الإدارة</h2>
            <p className="mt-3 text-sm font-light text-mist leading-relaxed">
              إنشاء وإطلاق حملات جديدة ومكافآت المحتوى متاح حصرياً للحسابات التي يمنحها الأدمن الصلاحية من لوحة التحكم.
              <br className="my-2" />
              إذا كنت صانع محتوى أو كليبر، يمكنك فوراً المشاركة في الحملات المتاحة وتقديم فيديوهاتك لتحقيق الأرباح!
            </p>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowPermissionModal(false)
                  setActiveTab('explore')
                }}
                className="btn-lux btn-gold w-full py-3 text-sm font-bold"
              >
                تصفح الحملات والمكافآت
              </button>
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="btn-lux btn-ghost w-full py-2.5 text-xs text-mist"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create New Campaign (Authorized only) */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-onyx/85 px-4 backdrop-blur-md overflow-y-auto py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-hair bg-onyx-2 p-8 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-champagne font-semibold">حملة جديدة</p>
            <h2 className="display-md mt-1 text-2xl font-bold text-pearl">إطلاق حملة مكافآت وصناع محتوى</h2>
            <p className="mt-1 text-xs text-mist">
              حدد الشروط، العائد لكل 1,000 مشاهدة، روابط المواد المصدرية، والمنصات المستهدفة لصناع المحتوى.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                const form = new FormData(e.currentTarget)
                const platformsSelected: string[] = []
                if (form.get('platform_tiktok')) platformsSelected.push('TIKTOK')
                if (form.get('platform_instagram')) platformsSelected.push('INSTAGRAM')
                if (form.get('platform_youtube')) platformsSelected.push('YOUTUBE')

                const sourceUrlsRaw = String(form.get('sourceUrls') ?? '')
                const sourceUrls = sourceUrlsRaw
                  .split('\n')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0 && s.startsWith('http'))

                createCampaign.mutate({
                  name: String(form.get('name') ?? '').trim(),
                  type: String(form.get('type')) as Campaign['type'],
                  imageUrl: String(form.get('imageUrl') ?? '').trim() || undefined,
                  description: String(form.get('description') ?? '').trim() || undefined,
                  rules: String(form.get('rules') ?? '').trim() || undefined,
                  ratePer1k: Number(form.get('ratePer1k')),
                  budget: form.get('budget') ? Number(form.get('budget')) : undefined,
                  minPayout: form.get('minPayout') ? Number(form.get('minPayout')) : 10,
                  maxPayout: form.get('maxPayout') ? Number(form.get('maxPayout')) : undefined,
                  minViews: form.get('minViews') ? Number(form.get('minViews')) : 1000,
                  platforms: platformsSelected.length > 0 ? platformsSelected : ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'],
                  sourceUrls,
                })
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">اسم الحملة *</label>
                  <input required name="name" maxLength={120} placeholder="مثال: تحدي بودكاست الرواد 2026" className="input-lux w-full" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">نوع الحملة</label>
                  <select name="type" className="input-lux w-full" defaultValue="WHOP_CONTENT_REWARDS">
                    <option value="WHOP_CONTENT_REWARDS">مكافآت محتوى (Whop / Rewards)</option>
                    <option value="BRAND_DEAL">صفقة إعلانية تجارية (Brand Deal)</option>
                    <option value="OWN_CHANNEL">قناة خاصة (Own Channel)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-pearl block mb-1">رابط صورة الغلاف (Banner / Cover Image URL)</label>
                <input name="imageUrl" type="url" placeholder="https://..." className="input-lux w-full text-xs" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">العائد لكل 1,000 مشاهدة ($) *</label>
                  <input required name="ratePer1k" type="number" min="0.1" step="0.01" defaultValue="2.5" className="input-lux w-full" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">الميزانية الإجمالية للحملة ($)</label>
                  <input name="budget" type="number" min="10" step="10" placeholder="مثلاً: 2000" className="input-lux w-full" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">الحد الأدنى للمشاهدات</label>
                  <input name="minViews" type="number" min="100" defaultValue="1000" className="input-lux w-full" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">الحد الأدنى للسحب ($)</label>
                  <input name="minPayout" type="number" min="1" defaultValue="10" className="input-lux w-full" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-pearl block mb-1">الحد الأقصى للمكافأة لكل صانع ($)</label>
                  <input name="maxPayout" type="number" min="10" placeholder="مثلاً: 500" className="input-lux w-full" />
                </div>
              </div>

              {/* Target Platforms */}
              <div>
                <label className="text-xs font-semibold text-pearl block mb-1.5">المنصات المستهدفة:</label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-pearl cursor-pointer">
                    <input type="checkbox" name="platform_tiktok" defaultChecked className="rounded border-hair bg-onyx text-gold" />
                    TikTok
                  </label>
                  <label className="flex items-center gap-2 text-xs text-pearl cursor-pointer">
                    <input type="checkbox" name="platform_instagram" defaultChecked className="rounded border-hair bg-onyx text-gold" />
                    Instagram Reels
                  </label>
                  <label className="flex items-center gap-2 text-xs text-pearl cursor-pointer">
                    <input type="checkbox" name="platform_youtube" defaultChecked className="rounded border-hair bg-onyx text-gold" />
                    YouTube Shorts
                  </label>
                </div>
              </div>

              {/* Source URLs */}
              <div>
                <label className="text-xs font-semibold text-pearl block mb-1">
                  روابط الفيديوهات المصدرية الخام (YouTube / Drive / Dropbox)
                </label>
                <textarea
                  name="sourceUrls"
                  rows={2}
                  placeholder="ضع رابط كل فيديو خام في سطر منفصل..."
                  className="input-lux w-full text-xs font-mono"
                />
              </div>

              {/* Rules & Requirements */}
              <div>
                <label className="text-xs font-semibold text-pearl block mb-1">شروط الحملة والهاشتاجات المطلوبة</label>
                <textarea
                  name="rules"
                  rows={2}
                  placeholder="مثال: يجب وضع هاشتاج #Cliptica ومنشن الحساب، وألا يقل طول المقطع عن 30 ثانية..."
                  className="input-lux w-full text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-pearl block mb-1">وصف الحملة وإرشادات المونتاج</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="نبذة عن الحملة، نصائح لاختيار اللقطات القوية والمحتوى المطلوب..."
                  className="input-lux w-full text-xs"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={createCampaign.isPending}
                  className="btn-lux btn-gold flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {createCampaign.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> جاري الإنشاء...
                    </>
                  ) : (
                    'إطلاق الحملة الآن'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="btn-lux btn-ghost py-3 px-5 text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
