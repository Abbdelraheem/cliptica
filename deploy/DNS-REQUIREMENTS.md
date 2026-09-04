# NOLOGY DNS Configuration Requirements
# ============================================================

## Required DNS Records for getnology.com

### Core Application Records
| Type | Name | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| A | @ | `<VPS_PUBLIC_IP>` | 300 | Root domain |
| A | app | `<VPS_PUBLIC_IP>` | 300 | Main application |
| A | api | `<VPS_PUBLIC_IP>` | 300 | API subdomain (optional) |
| CNAME | www | getnology.com | 300 | WWW redirect |

### Email Records (if using custom email)
| Type | Name | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| MX | @ | mail.getnology.com | 3600 | Mail server (priority 10) |
| TXT | @ | "v=spf1 include:_spf.google.com ~all" | 3600 | SPF record |
| TXT | _dmarc | "v=DMARC1; p=quarantine; rua=mailto:dmarc@getnology.com" | 3600 | DMARC policy |
| TXT | google._domainkey | (from Google Workspace) | 3600 | DKIM |

### Stripe Webhook (if using separate subdomain)
| Type | Name | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| CNAME | stripe | getnology.com | 300 | Stripe webhook endpoint |

### CDN/Static Assets (optional)
| Type | Name | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| CNAME | static | cdn.getnology.com | 3600 | CDN for static assets |

---

## SSL/TLS Certificate Requirements

### Let's Encrypt (Certbot - Free, Auto-renewing)
- **Domains**: `app.getnology.com`, `www.getnology.com` (minimum)
- **Validation**: HTTP-01 (requires port 80) or DNS-01 (if using Cloudflare DNS)
- **Auto-renewal**: Configured via cron (see `deploy/certbot-setup.sh`)

### Production SSL Requirements
- TLS 1.2 minimum, TLS 1.3 preferred
- HSTS header with 1-year max-age
- OCSP Stapling enabled
- Certificate Transparency logging enabled

---

## Cloudflare Configuration (Recommended)

If using Cloudflare as DNS provider:

### DNS Settings
```
Type    Name    Content              Proxy Status
A       @       <VPS_IP>             Proxied (Orange Cloud)
A       app   <VPS_IP>               Proxied (Orange Cloud)
A       api   <VPS_IP>               Proxied (Orange Cloud)
CNAME   www   getnology.com          Proxied (Orange Cloud)
TXT     @       v=spf1 include:_spf.google.com ~all  DNS Only
TXT     _dmarc  v=DMARC1; p=quarantine; rua=mailto:dmarc@getnology.com  DNS Only
```

### Cloudflare Settings
- **SSL/TLS**: Full (Strict) - requires valid origin cert
- **Edge Certificates**: Always Use HTTPS: On
- **HSTS**: Enabled, max-age 31536000, includeSubdomains, preload
- **Minimum TLS Version**: 1.2
- **Automatic HTTPS Rewrites**: On
- **WAF**: Enable managed ruleset for OWASP Top 10

### Cloudflare Page Rules (Free tier: 3 rules)
1. `*getnology.com/api/*` → Cache Level: Bypass, Security Level: High
2. `*getnology.com/_next/static/*` → Cache Level: Cache Everything, Edge Cache TTL: 1 year
3. `*getnology.com/static/*` → Cache Level: Cache Everything, Edge Cache TTL: 1 year

---

## Stripe Production Setup Requirements

### Stripe Dashboard Configuration
1. **Webhook Endpoint**: `https://app.getnology.com/api/billing/webhook`
2. **Events to Listen**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
2. **Signing Secret**: Copy to `STRIPE_WEBHOOK_SECRET` in `.env.production`
3. **Price IDs**: Create monthly prices for Clipper ($19) and Studio ($49), copy to:
   - `STRIPE_PRICE_CLIPPER_MONTHLY`
   - `STRIPE_PRICE_STUDIO_MONTHLY`

### Stripe Test Mode vs Live Mode
- **Test Mode**: Use `sk_test_...` and `pk_test_...` keys
- **Live Mode**: Use `sk_live_...` and `pk_live_...` keys
- **Webhook Secret**: Different for test vs live (`whsec_...` vs `whsec_...`)

---

## Cloudflare R2 Configuration

### Bucket Setup
1. Create bucket: `nology-clips` (or your preferred name)
2. Region: Auto (or nearest to your users)
2. Public access: **OFF** (private bucket only)
3. CORS Policy:
```json
[
  {
    "AllowedOrigins": ["https://app.getnology.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### API Token
1. Create API Token with permissions:
   - Object Read & Write
   - Bucket Read
3. Scopes: Account > R2 > Object Read & Write
4. Copy to:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
   - `R2_BUCKET=nology-clips`

---

## Google OAuth Configuration

### Google Cloud Console
1. Create OAuth 2.0 Client ID
2. Authorized JavaScript Origins: `https://app.getnology.com`
3. Authorized Redirect URIs: `https://app.getnology.com/api/auth/callback/google`
4. Copy to:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

---

## GitHub OAuth Configuration

### GitHub Developer Settings
1. New OAuth App
2. Homepage URL: `https://app.getnology.com`
3. Authorization Callback URL: `https://app.getnology.com/api/auth/callback/github`
4. Copy to:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

---

## Resend (Email) Configuration

### Resend Dashboard
1. Verify domain: `getnology.com`
2. Add DKIM records (provided by Resend)
5. Create API Key
6. Copy to:
   - `RESEND_API_KEY`
   - `EMAIL_FROM="NOLOGY <noreply@getnology.com>"`

---

## Upstash Redis (Rate Limiting)

### Upstash Console
1. Create Redis database
2. Region: Same as VPS region (for low latency)
3. Copy to:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## Sentry (Error Tracking)

### Sentry Dashboard
1. Create Node.js project
2. Copy DSN to:
   - `NEXT_PUBLIC_SENTRY_DSN` (frontend)
   - `SENTRY_DSN` (backend/worker)

---

## Summary: Minimum Required for Launch

| Service | Required Records | Status |
|---------|------------------|--------|
| DNS (A) | @, app, www | ☐ Required |
| DNS (CNAME) | www → @ | ☐ Required |
| SSL | Let's Encrypt / Certbot | ☐ Required |
| Stripe | Webhook, Price IDs | ☐ Required |
| R2 | Bucket, API Token, CORS | ☐ Required |
| Database | Neon PostgreSQL URL | ☐ Required |
| Auth | NEXTAUTH_SECRET, NEXTAUTH_URL | ☐ Required |
| AI | GROQ_API_KEY | ☐ Required |

**Optional but Recommended:**
- Google OAuth, GitHub OAuth
- Resend (email)
- Upstash Redis (rate limiting)
- Sentry (error tracking)
- Cloudflare CDN (performance + security)

---

## Verification Checklist Before Launch

- [ ] All DNS records propagated (`dig app.getnology.com`)
- [ ] HTTPS works (`curl -I https://app.getnology.com`)
- [ ] SSL Labs grade A+ (`ssllabs.com/ssltest/analyze.html?d=app.getnology.com`)
- [ ] Stripe webhook test passes (`stripe listen --forward-to localhost:3000/api/billing/webhook`)
- [ ] R2 upload/download works (test with `aws s3 cp`)
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Health endpoint returns 200 (`curl https://app.getnology.com/api/health`)
- [ ] OAuth login works (Google/GitHub)
- [ ] Credit system works (create project, check deduction)
- [ ] Worker processes jobs (check PM2 logs)
- [ ] Certbot auto-renewal works (`certbot renew --dry-run`)