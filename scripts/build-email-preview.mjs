import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const jiti = createJiti(import.meta.url)
const email = await jiti.import(path.join(root, 'src/lib/email.ts'))

const APP = 'https://getnology.com'

const templates = [
  {
    name: '1 — Verification email (activate account)',
    html: email.verificationEmailHtml(`${APP}/verify-email?token=DEMO_TOKEN`),
  },
  {
    name: '2 — Password reset email',
    html: email.passwordResetEmailHtml(`${APP}/reset-password?token=DEMO_TOKEN`),
  },
  {
    name: '3 — Password changed confirmation',
    html: email.passwordChangedEmailHtml(),
  },
  {
    name: '4 — Monthly credits renewed',
    html: email.creditsRenewedEmailHtml({
      planName: 'Clipper',
      credits: 300,
      balance: 384,
      dashboardUrl: `${APP}/dashboard`,
    }),
  },
  {
    name: '5 — Welcome email',
    html: email.welcomeEmailHtml({ name: 'Ahmed', credits: 40, dashboardUrl: `${APP}/dashboard` }),
  },
  {
    name: '6 — Credits running low',
    html: email.creditsLowEmailHtml({ credits: 12, billingUrl: `${APP}/dashboard/billing` }),
  },
  {
    name: '7 — Payment failed',
    html: email.paymentFailedEmailHtml({ planName: 'Clipper', billingUrl: `${APP}/dashboard/billing` }),
  },
]

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const boxes = templates
  .map(
    (t) => `  <div class="box">
    <h2>${esc(t.name)}</h2>
    <iframe srcdoc="${esc(t.html)}" title="${esc(t.name)}"></iframe>
  </div>`
  )
  .join('\n')

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NOLOGY email preview</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0c; color: #fff; font-family: Inter, system-ui, sans-serif; padding: 40px 16px 80px; }
  .head { max-width: 560px; margin: 0 auto 40px; text-align: center; }
  .head h1 { font-size: 20px; letter-spacing: .1em; font-weight: 800; }
  .head h1 span { color: #ff5a1f; }
  .head p { color: #8a8a93; margin-top: 8px; font-size: 13px; }
  .box { max-width: 560px; margin: 0 auto 44px; }
  .box h2 { color: #8a8a93; font-size: 12px; letter-spacing: .25em; text-transform: uppercase; margin-bottom: 12px; }
  iframe { width: 100%; height: 560px; border: 1px solid #222; border-radius: 16px; background: #fff; }
</style>
</head>
<body>
  <div class="head">
    <h1>NOLOGY · <span>email preview</span></h1>
    <p>Rendered live from src/lib/email.ts — open this file in your browser to view the exact HTML that ships.</p>
  </div>
${boxes}
</body>
</html>
`

writeFileSync(path.join(root, 'email-preview.html'), page)
console.log(`email-preview.html regenerated with ${templates.length} templates`)