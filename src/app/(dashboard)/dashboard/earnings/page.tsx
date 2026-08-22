'use client'

import { TrendingUp, DollarSign, Clock, Download } from 'lucide-react'

const SUMMARY = [
  { label: 'Total earned', value: '$2,675', icon: DollarSign },
  { label: 'Pending approval', value: '$410', icon: Clock },
  { label: 'Effective $ / 1K', value: '$3.94', icon: TrendingUp },
]

const PAYOUTS = [
  { campaign: 'Whop Content Rewards — Q3', amount: 840, status: 'Paid', date: 'Aug 20' },
  { campaign: 'Brand X ambassador program', amount: 310, status: 'Approved', date: 'Aug 19' },
  { campaign: 'Whop Content Rewards — Q3', amount: 410, status: 'Pending', date: 'Aug 17' },
  { campaign: 'Affiliate — editing tools', amount: 95, status: 'Paid', date: 'Aug 14' },
  { campaign: 'Whop Content Rewards — Q3', amount: 1_000, status: 'Paid', date: 'Aug 8' },
]

const STATUS_STYLE: Record<string, string> = {
  Paid: 'bg-emerald-deep/30 text-emerald-300',
  Approved: 'bg-champagne/15 text-champagne',
  Pending: 'bg-pearl/5 text-mist',
}

export default function EarningsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">The score</p>
          <h1 className="display-md mt-2.5">Earnings</h1>
        </div>
        <button className="btn-lux btn-outline !py-3">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {SUMMARY.map((s) => (
          <div key={s.label} className="glass-card !p-7">
            <s.icon className="h-5 w-5 text-gold" />
            <p className="mt-5 font-display text-4xl font-semibold">{s.value}</p>
            <p className="mt-1 text-sm font-light text-mist">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Ledger */}
      <div className="mt-14">
        <h2 className="mb-5 font-display text-2xl font-semibold">Payout ledger</h2>
        <div className="overflow-hidden rounded-2xl border border-hair/50 bg-onyx-2/50 backdrop-blur-sm">
          <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-6 border-b border-hair/30 px-6 py-3.5 text-xs uppercase tracking-widest text-mist-2 sm:grid">
            <span>Campaign</span>
            <span className="w-24 text-right">Amount</span>
            <span className="w-28 text-center">Status</span>
            <span className="w-16 text-right">Date</span>
          </div>
          {PAYOUTS.map((p, i) => (
            <div
              key={`${p.campaign}-${i}`}
              className={`grid grid-cols-2 gap-4 px-6 py-4 transition-colors hover:bg-surface sm:grid-cols-[1fr_auto_auto_auto] sm:gap-6 ${
                i > 0 ? 'border-t border-hair/30' : ''
              }`}
            >
              <span className="truncate font-light">{p.campaign}</span>
              <span className="text-right font-medium text-gold sm:w-24">${p.amount.toLocaleString()}</span>
              <span className={`justify-self-end rounded-full px-3 py-1 text-[10px] uppercase tracking-widest sm:w-28 sm:text-center ${STATUS_STYLE[p.status]}`}>
                {p.status}
              </span>
              <span className="text-right text-sm font-light text-mist sm:w-16">{p.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
