import { createHash, randomBytes } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export function generateResetToken() {
  const token = randomBytes(32).toString('hex')
  return { token, tokenHash: hashToken(token) }
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
      from: process.env.EMAIL_FROM ?? 'NOLOGY <noreply@getnology.com>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    throw new Error(`Resend delivery failed (${res.status})`)
  }
}

export function passwordResetEmailHtml(link: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#f5f2ea;background:#101010;border-radius:16px">
      <p style="letter-spacing:0.3em;font-size:12px;color:#d4af37">NOLOGY</p>
      <h1 style="font-size:22px;margin:16px 0">Reset your password</h1>
      <p style="color:#b8b4a8;line-height:1.6">We received a request to reset the password for your account. This link expires in one hour and can be used once.</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#d4af37;color:#101010;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Choose a new password</a>
      </p>
      <p style="color:#6b675c;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `.trim()
}
