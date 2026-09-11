import { Metadata } from 'next'
import Link from 'next/link'
import { MarketingLayout } from '@/components/marketing-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy and data processing disclosures for Cliptica AI video clipping platform.',
}

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 sm:px-6">
        <p className="eyebrow">Data & Security</p>
        <h1 className="display-md mt-4">Privacy Policy</h1>
        <p className="mt-2 text-sm text-mist-2">Last updated: September 10, 2026</p>

        <div className="mt-10 space-y-10 text-mist leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">1. Information We Collect</h2>
            <p>We collect only the minimum personal and operational data necessary to deliver our services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-pearl">Account Information:</strong> Your email address, full name, and encrypted password hash (via bcrypt).</li>
              <li><strong className="text-pearl">Media Submissions:</strong> Video URLs submitted for processing, video/audio files uploaded directly, and resulting AI-generated transcripts.</li>
              <li><strong className="text-pearl">Device &amp; Telemetry Data:</strong> Browser User-Agent, IP address, device identifier hashes (used strictly for one-account-per-device verification to prevent bot abuse), and session tokens.</li>
              <li><strong className="text-pearl">Payment Information:</strong> Financial transactions are handled entirely by Stripe. We do not store credit card numbers, CVVs, or expiration dates on our infrastructure. We store only Stripe customer tokens, subscription IDs, and purchase history.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">2. How We Use Your Information</h2>
            <p>Your data is processed strictly for the following operational needs:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Authenticating your account and maintaining active browser sessions.</li>
              <li>Processing video jobs, generating subtitle timings, and rendering vertical clips.</li>
              <li>Deducting credit quotas and synchronizing subscription tiers.</li>
              <li>Sending essential account notifications (verification emails, password resets, job completion alerts).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">3. Third-Party Service Providers</h2>
            <p>To provide high-performance transcription and video delivery, data passes through the following secure third-party processors:</p>
            <div className="grid gap-4 sm:grid-cols-3 mt-4">
              <div className="rounded-xl border border-hair bg-white/[0.02] p-4">
                <h3 className="font-semibold text-champagne text-base">Stripe, Inc.</h3>
                <p className="mt-2 text-xs text-mist leading-normal">Processes all subscription billing, credit purchases, and payouts with PCI-DSS Level 1 certification.</p>
              </div>
              <div className="rounded-xl border border-hair bg-white/[0.02] p-4">
                <h3 className="font-semibold text-champagne text-base">Cloudflare R2</h3>
                <p className="mt-2 text-xs text-mist leading-normal">Provides encrypted cloud storage for uploaded source footage, temporary render frames, and generated video clips.</p>
              </div>
              <div className="rounded-xl border border-hair bg-white/[0.02] p-4">
                <h3 className="font-semibold text-champagne text-base">Groq &amp; OpenAI</h3>
                <p className="mt-2 text-xs text-mist leading-normal">Powers speech-to-text transcription (Whisper) and moment virality scoring. Only audio/transcripts are transmitted.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">4. Data Retention Period</h2>
            <p>
              Uploaded video files, temporary audio extractions, and intermediate render files are retained in Cloudflare R2 cloud storage
              for a rolling window of up to 30 days after project completion, after which temporary cache files are automatically purged.
              Completed output clips and project transcripts remain accessible in your account library until you manually delete the project.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">5. Your Rights and Account Deletion</h2>
            <p>
              You maintain full ownership of your data and have the right to request access, correction, or complete erasure of your personal data at any time.
            </p>
            <p>
              To permanently delete your account, project history, and associated video assets, submit an account deletion request via our{' '}
              <a
                href="mailto:support@getnology.com?subject=Account%20Deletion%20Request"
                className="text-gold underline underline-offset-4"
              >
                Account Deletion Form
              </a>{' '}
              or directly inside your Account Settings page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">6. Contact Data Protection</h2>
            <p>
              For any questions regarding our privacy practices or data handling, reach our team at{' '}
              <a href="mailto:support@getnology.com" className="text-gold underline underline-offset-4">
                support@getnology.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-hair pt-8 flex gap-6 text-sm text-mist-2">
          <Link href="/terms" className="hover:text-champagne transition-colors">Terms of Service</Link>
          <Link href="/refund-policy" className="hover:text-champagne transition-colors">Refund Policy</Link>
        </div>
      </div>
    </MarketingLayout>
  )
}
