import { Metadata } from 'next'
import Link from 'next/link'
import { MarketingLayout } from '@/components/marketing-layout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service and acceptable use rules for Cliptica AI video clipping platform.',
}

export default function TermsPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 sm:px-6">
        <p className="eyebrow">Legal Agreement</p>
        <h1 className="display-md mt-4">Terms of Service</h1>
        <p className="mt-2 text-sm text-mist-2">Last updated: September 10, 2026</p>

        <div className="mt-10 space-y-10 text-mist leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, registering for, or using the Cliptica platform (&quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;),
              you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">2. Nature of the Service</h2>
            <p>
              Cliptica is an AI-powered media processing software tool. We provide automated audio transcription, virality scoring, facial tracking reframing,
              caption animation, and short-form video clip generation. Output results depend on user input and source media characteristics.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">3. Intellectual Property and Content Rights</h2>
            <p>
              You maintain 100% ownership of any media, video files, or audio tracks you upload or submit to our Service, as well as all resulting output clips.
            </p>
            <p className="rounded-xl border border-hair bg-white/[0.02] p-4 text-sm">
              <strong className="text-champagne">User Rights Warranty:</strong> You represent and warrant that you own or possess all necessary rights, licenses,
              consents, and permissions to process any video or audio content you submit (via upload or external URL). You expressly agree that you will not submit
              any material that infringes upon third-party copyrights, trademarks, privacy rights, or publicity rights.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">4. Subscriptions and Recurring Billing</h2>
            <p>
              Paid subscription plans (e.g., Clipper, Studio) are billed in advance on a recurring monthly basis. By subscribing, you authorize our third-party
              payment processor (Stripe) to automatically charge your designated payment method at the beginning of each billing cycle until you cancel.
            </p>
            <p>
              You may cancel your subscription at any time through the Billing dashboard. Upon cancellation, your subscription remains active until the conclusion
              of your current paid billing period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">5. Credit System Rules</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Credits are deducted based on video duration processed (approximately 1 credit per minute of source footage).</li>
              <li>Credits are non-refundable once consumed by a completed or partially processed job.</li>
              <li>Unused monthly subscription credits roll over for 30 days while your subscription remains active and in good standing.</li>
              <li>Initial free trial credits (40 credits) are non-transferable, possess no monetary value, and cannot be redeemed for cash.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">6. Acceptable Use and Account Suspension</h2>
            <p>
              You agree not to use the Service for any unlawful, harassing, defamatory, fraudulent, or harmful purposes. You must not attempt to reverse engineer,
              disrupt our worker infrastructure, bypass rate limiting mechanisms, or introduce malicious payloads.
            </p>
            <p>
              Cliptica reserves the right to immediately suspend or terminate any account, without liability or refund, if we determine in our sole discretion that
              the account has violated these Terms or engaged in abuse of our infrastructure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">7. Limitation of Liability</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied.
              In no event shall Cliptica, its founders, or affiliates be liable for any indirect, incidental, consequential, or punitive damages, including loss of profits,
              views, or data. Our total cumulative liability arising from any claim related to the Service shall not exceed the amount paid by you in the 12 months preceding the claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">8. Contact Us</h2>
            <p>
              If you have any questions regarding these Terms, please contact our support team at{' '}
              <a href="mailto:support@getnology.com" className="text-gold underline underline-offset-4">
                support@getnology.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-hair pt-8 flex gap-6 text-sm text-mist-2">
          <Link href="/privacy" className="hover:text-champagne transition-colors">Privacy Policy</Link>
          <Link href="/refund-policy" className="hover:text-champagne transition-colors">Refund Policy</Link>
        </div>
      </div>
    </MarketingLayout>
  )
}
