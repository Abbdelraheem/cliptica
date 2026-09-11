# Cliptica — Decisions Requiring Human Authority
**Date**: 2026-09-11  
**Authority**: Lead Architect / Role 2 (Senior Engineer)  

---

## Overview
This document tracks decisions, external credentials, and business policies that **only the human owner can authorize or provide**. The AI engineering agent will NOT make assumptions or apply destructive operations without explicit approval on these items.

---

## 1. Domain & DNS Configuration
- [ ] **Custom Domain Selection**: The application is currently served directly or via preview on EC2 (`13.62.192.145`).
- [ ] **DNS Records**: Point `A` record (`cliptica.com` or chosen domain) to `13.62.192.145` and configure SSL/TLS via Let's Encrypt / Certbot / Caddy.
- [ ] **`NEXTAUTH_URL` & `NEXT_PUBLIC_APP_URL`**: Update in production `.env` once domain is live.

## 2. Payment Gateway (Stripe Live Mode)
- [ ] **Stripe Account Activation**: Replace test keys with Live API keys:
  - `STRIPE_SECRET_KEY` (`sk_live_...`)
  - `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- [ ] **Stripe Webhook Endpoint Registration**: Register `https://<domain>/api/billing/webhook` in the Stripe Dashboard with events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] **Stripe Pricing Plan IDs**: Confirm that live product/price IDs match `PRICING_MODEL.md` ($19/mo Clipper, $49/mo Studio).

## 3. Email Delivery (SMTP / Resend)
- [ ] **Transactional Email Provider**: Currently configured for Resend or SMTP.
- [ ] **Domain Authentication**: DKIM, SPF, and DMARC records must be verified in DNS to ensure high deliverability of account verification and password reset emails.

## 4. Residential Proxy Subscription (YouTube Download Reliability)
- [ ] **Proxy Upgrade**: When YouTube anti-bot countermeasures increase, authorize residential proxy subscription (Decoded in `PROXY_UPGRADE_GUIDE.md`, estimated $10–$25/mo).

## 5. Storage Cleanup & Retention Policy
- [ ] **R2 Source & Clip Retention**: Decide whether raw uploaded source files should be purged from R2 after 30 days to optimize Cloudflare R2 storage costs.
