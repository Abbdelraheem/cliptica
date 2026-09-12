import { createHash, randomBytes } from 'crypto'

export function generateVerificationToken() {
  const token = randomBytes(32).toString('hex')
  return { token, tokenHash: hashToken(token) }
}

export function generateResetToken() {
  return generateVerificationToken()
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Sends an email through Resend. Falls back to console logging when
 * RESEND_API_KEY is not configured so local/dev flows keep working.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[email:fallback] to=${opts.to} subject="${opts.subject}"\n${opts.html}`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Cliptica <noreply@cliptica.com>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    throw new Error(`Resend delivery failed (${res.status})`)
  }
}

/* ============================================================
   CLIPTICA EMAIL DESIGN SYSTEM
   Onyx + charcoal surfaces, forge-orange accent (#FF5A1F),
   pearl text, Manrope/Inter stack. Inline styles only so the
   template renders reliably across email clients.
   ============================================================ */

const EMAIL = {
  bg: '#08080a',
  card: '#101013',
  cardBorder: '#1c1c22',
  ink: '#ffffff',
  mist: '#b8b4a8',
  muted: '#6f6a5e',
  accent: '#ff5a1f',
  accentHover: '#e8430a',
  font: "'Inter','Segoe UI',Arial,sans-serif",
  fontDisplay: "'Manrope','Inter','Segoe UI',Arial,sans-serif",
}

interface EmailLayoutOptions {
  preheader?: string
  title: string
  headline: string
  body: string
  bodyLines?: string[]
  rows?: { label: string; value: string }[]
  cta?: { label: string; href: string }
  meta?: string
  note?: string
}

export function emailLayout(opts: EmailLayoutOptions): string {
  const { preheader = '', title, headline, body, bodyLines, rows, cta, meta, note } = opts
  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL.bg};color:${EMAIL.ink};font-family:${EMAIL.font};-webkit-font-smoothing:antialiased">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${preheader}</div>` : ''}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${EMAIL.bg};padding:32px 0">
  <tr><td align="center" style="padding:0 16px">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:${EMAIL.card};border:1px solid ${EMAIL.cardBorder};border-radius:20px;overflow:hidden">
      <tr>
        <td style="padding:28px 36px 8px 36px" bgcolor="${EMAIL.bg}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="left">
                <span style="font-family:${EMAIL.fontDisplay};font-weight:800;font-size:17px;letter-spacing:.32em;color:${EMAIL.ink}">CLIPTICA</span>
              </td>
              <td align="right">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${EMAIL.accent};box-shadow:0 0 0 4px rgba(255,90,31,.18)"></span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:36px 36px 12px 36px">
          <h1 style="margin:0 0 12px 0;font-family:${EMAIL.fontDisplay};font-size:26px;line-height:1.25;font-weight:700;color:${EMAIL.ink}">${headline}</h1>
          <p style="margin:0;font-size:15px;line-height:1.7;color:${EMAIL.mist}">${body}</p>
          ${bodyLines ? bodyLines.map((line) => `<p style="margin:12px 0 0 0;font-size:15px;line-height:1.7;color:${EMAIL.mist}">${line}</p>`).join('') : ''}
        </td>
      </tr>

      ${rows?.length ? `
      <tr>
        <td style="padding:0 36px 8px 36px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${EMAIL.cardBorder};border-radius:12px;overflow:hidden">
            ${rows.map((row, i) => {
              const border = i < rows.length - 1 ? `border-bottom:1px solid ${EMAIL.cardBorder};` : ''
              return `
            <tr>
              <td style="padding:11px 18px;font-size:13px;line-height:1.4;color:${EMAIL.mist};background:${EMAIL.bg};${border}">${row.label}</td>
              <td style="padding:11px 18px;font-size:13px;line-height:1.4;font-weight:700;color:${EMAIL.ink};text-align:right;background:${EMAIL.bg};${border}">${row.value}</td>
            </tr>`
            }).join('')}
          </table>
        </td>
      </tr>` : ''}

      ${cta ? `
      <tr>
        <td style="padding:28px 36px">
          <a href="${cta.href}" target="_blank" rel="noopener" style="display:inline-block;background:${EMAIL.accent};color:${EMAIL.ink};font-family:${EMAIL.fontDisplay};font-weight:700;font-size:14px;line-height:1;letter-spacing:.02em;text-decoration:none;padding:14px 26px;border-radius:999px;box-shadow:0 10px 24px rgba(255,90,31,.28)">${cta.label}</a>
        </td>
      </tr>` : ''}

      ${meta || note ? `
      <tr>
        <td style="padding:0 36px 8px 36px">
          ${meta ? `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:${EMAIL.mist}">${meta}</p>` : ''}
          ${note ? `<p style="margin:0;font-size:12px;line-height:1.5;color:${EMAIL.muted}">${note}</p>` : ''}
        </td>
      </tr>` : ''}

      <tr>
        <td bgcolor="${EMAIL.bg}" style="padding:20px 36px 24px 36px">
          <p style="margin:0;font-size:11px;line-height:1.6;color:${EMAIL.muted}">
            &copy; ${new Date().getFullYear()} Cliptica &middot; AI Video Clipping Platform<br>
            If you didn't request this email, you can safely ignore it.
          </p>
        </td>
      </tr>
    </table>

  </td></tr>
</table>
</body>
</html>
  `.trim()
}

export function verificationEmailHtml(link: string) {
  return emailLayout({
    preheader: 'One click to activate your Cliptica account and start clipping.',
    title: 'Confirm your Cliptica email',
    headline: 'One click to verify',
    body: 'Welcome to Cliptica. Confirm your email address to activate your account and start turning any video into finished clips.',
    cta: { label: 'Verify my email', href: link },
    meta: 'This link expires in 24 hours and can only be used once.',
  })
}

export function passwordResetEmailHtml(link: string) {
  return emailLayout({
    preheader: 'We received a request to reset your Cliptica password.',
    title: 'Reset your Cliptica password',
    headline: 'Reset your password',
    body: 'We received a request to reset the password for your Cliptica account. Use the button below to choose a new one.',
    cta: { label: 'Choose a new password', href: link },
    meta: 'This link expires in one hour and can only be used once.',
    note: "If you didn't request this, you can safely ignore this email — your password won't change.",
  })
}

export function passwordChangedEmailHtml() {
  return emailLayout({
    preheader: 'Your Cliptica password was changed successfully.',
    title: 'Your Cliptica password was changed',
    headline: 'Password changed',
    body: 'Your Cliptica password was updated successfully. If this was you, you\u2019re all set — nothing else to do.',
    note: "If you didn't make this change, reset your password right away and contact support at support@cliptica.com.",
  })
}

export interface CreditsRenewedEmailParams {
  planName: string
  credits: number
  balance: number
  dashboardUrl: string
}

export function creditsRenewedEmailHtml(p: CreditsRenewedEmailParams) {
  return emailLayout({
    preheader: 'Your monthly credits are here — ready to keep clipping.',
    title: 'Cliptica credits renewed',
    headline: 'Your monthly credits have been renewed',
    body: `Thanks for being a ${p.planName} subscriber. Your ${p.credits} monthly credits were just added to your balance.`,
    rows: [
      { label: 'Plan', value: p.planName },
      { label: 'Credits added', value: `${p.credits} credits` },
      { label: 'New balance', value: `${p.balance} credits` },
    ],
    cta: { label: 'Go to dashboard', href: p.dashboardUrl },
    note: 'Credits renew automatically each billing period. You can manage your plan anytime from Billing.',
  })
}

export function welcomeEmailHtml({ name, credits, dashboardUrl }: { name: string; credits: number; dashboardUrl: string }) {
  return emailLayout({
    preheader: 'Your Cliptica account is ready — start clipping.',
    title: 'Welcome to Cliptica',
    headline: 'Welcome to Cliptica',
    body: `Hi ${name}, your account is verified and ready to go. You\u2019ve got ${credits} credits to start turning videos into finished clips.`,
    cta: { label: 'Start clipping', href: dashboardUrl },
    note: 'This email confirms your account is active. Questions? Reply to this email and a human will get back to you.',
  })
}

export function creditsLowEmailHtml({ credits, billingUrl }: { credits: number; billingUrl: string }) {
  return emailLayout({
    preheader: `You have ${credits} credits left in your Cliptica balance.`,
    title: 'Cliptica credits running low',
    headline: 'Credits running low',
    body: `You have ${credits} credits left in your balance. Top up before you run out so your video flow never stalls.`,
    cta: { label: 'Add credits', href: billingUrl },
    note: 'You can manage your plan and credits anytime from Billing.',
  })
}

export function paymentFailedEmailHtml({ planName, billingUrl }: { planName: string; billingUrl: string }) {
  return emailLayout({
    preheader: `Your ${planName} payment didn\u2019t go through.`,
    title: 'Cliptica payment failed',
    headline: 'Payment failed — action needed',
    body: `We couldn\u2019t charge your card for the ${planName} plan. To keep your credits renewing, update your payment details.`,
    cta: { label: 'Update payment details', href: billingUrl },
    note: "If you don\u2019t update your details, your subscription will pause and your credits won\u2019t renew.",
  })
}