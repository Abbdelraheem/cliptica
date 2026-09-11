import { Metadata } from 'next'
import Link from 'next/link'
import { MarketingLayout } from '@/components/marketing-layout'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Refund Policy, cancellation terms, and credit rules for Cliptica subscriptions.',
}

export default function RefundPolicyPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 sm:px-6">
        <p className="eyebrow">Customer Protection</p>
        <h1 className="display-md mt-4">Refund Policy</h1>
        <p className="mt-2 text-sm text-mist-2">Last updated: September 10, 2026</p>

        <div className="mt-10 space-y-10 text-mist leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">1. Subscription Refunds (14-Day Window)</h2>
            <p>
              We want you to be completely satisfied with Cliptica. We offer a full refund on your initial subscription purchase within{' '}
              <strong className="text-pearl">14 days</strong> of the billing transaction, provided that you have consumed fewer than{' '}
              <strong className="text-pearl">15 credits</strong> from your plan allowance.
            </p>
            <p>
              If your request meets these criteria, we will process a 100% refund back to your original payment method via Stripe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">2. Non-Refundable Conditions</h2>
            <p>Refunds cannot be issued under the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>More than 14 days have passed since the subscription transaction date.</li>
              <li>You have already processed footage consuming 15 or more credits, as GPU and cloud transcription computational costs are irreversibly incurred upon rendering.</li>
              <li>One-off credit top-ups that have been partially or fully utilized.</li>
              <li>Accounts that have been suspended or terminated due to violations of our Terms of Service (e.g., copyright infringement or scraping abuse).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">3. Cancellations &amp; Unused Credits</h2>
            <p>
              You can cancel your subscription at any time with a single click from the Billing dashboard. When you cancel:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>No further charges will occur on your payment card.</li>
              <li>Your plan features and remaining credit balance will remain fully active until the end of your current monthly billing period.</li>
              <li>Unused credits expire at the end of the billing period following cancellation.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">4. Automated Refunds for System Errors</h2>
            <p>
              If an AI rendering job fails, crashes, or produces a corrupted output due to a server or pipeline error on our infrastructure,
              our worker engine automatically refunds all reserved credits back to your balance immediately. You will never be charged credits for a failed render.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-pearl">5. How to Request a Refund</h2>
            <p>
              To request a refund, please send an email to{' '}
              <a href="mailto:support@getnology.com?subject=Refund%20Request" className="text-gold underline underline-offset-4">
                support@getnology.com
              </a>{' '}
              with the subject line &quot;Refund Request&quot; and include:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Your registered account email address.</li>
              <li>The Stripe invoice or transaction date.</li>
              <li>A brief note explaining the reason for your refund request.</li>
            </ol>
            <p className="mt-2">
              Our billing team reviews all requests within 2 business days and issues approved refunds directly via Stripe.
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-hair pt-8 flex gap-6 text-sm text-mist-2">
          <Link href="/terms" className="hover:text-champagne transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-champagne transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </MarketingLayout>
  )
}
