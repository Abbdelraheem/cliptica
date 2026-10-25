# Clipzila — Billing System Architecture & Provider Integration

Clipzila supports three payment gateways / Merchant of Record (MoR) providers: **Paddle Billing**, **Stripe**, and **Whop**. This multi-provider architecture allows flexible monetization across international card payments, local currencies, and digital product marketplaces.

---

## 1. Active Provider Determination in Production

The active checkout provider displayed to end-users is determined dynamically at runtime based on environment variables:

| Active Provider | Required Environment Variables | Behavior |
| :--- | :--- | :--- |
| **Paddle Billing** *(Default / Primary MoR)* | `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`<br>`PADDLE_API_KEY`<br>`PADDLE_NOTIFICATION_WEBHOOK_SECRET` | Primary inline checkout modal on `/dashboard/billing`. Serves 200+ countries with automatic sales tax/VAT compliance. |
| **Stripe** *(Alternative Gateway)* | `STRIPE_SECRET_KEY`<br>`STRIPE_WEBHOOK_SECRET`<br>`STRIPE_PRICE_*` | Hosted Stripe Checkout and Customer Billing Portal via `/api/billing/checkout` and `/api/billing/portal`. |
| **Whop** *(Marketplace & Bounties)* | `WHOP_API_KEY`<br>`WHOP_WEBHOOK_SECRET` | Ingests external creator rewards and licenses via `/api/billing/whop-webhook`. |

### Graceful Fallback When Credentials Are Absent
None of the billing providers will crash the application during server initialization if credentials are unset:
- **Paddle**: Client SDK (`@paddle/paddle-node-sdk`) is lazily instantiated inside `getPaddleInstance()` only upon request; missing secrets return 500/503 HTTP responses without crashing PM2 / Next.js.
- **Stripe**: Initialized with safe fallback string (`sk_test_placeholder`) when `STRIPE_SECRET_KEY` is not set.
- **Whop**: Signature verification and webhook receiver explicitly guard against empty secrets, returning 503 instead of throwing unhandled exceptions.

---

## 2. Plan Keys & Credit Allocations

Clipzila defines four subscription tiers and three one-time credit refill packs:

### Subscription Tiers

| Plan Key | Display Name | Monthly Price (USD) | Monthly Credits | Daily Video Limit | Max Video Length | Watermark | Max Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `free` | Free | \$0 | 5 (one-time) | 3 | 20 min | Yes | 720p |
| `basic` | Basic | \$15 | 50 / month | 25 | 45 min | No | 1080p |
| `clipper` | Starter | \$29 | 120 / month | 50 | 90 min | No | 1080p |
| `studio` | Pro Creator | \$59 | 400 / month | 200 | 120 min | No | 1080p |

*(1 credit = 1 final rendered vertical video export.)*

### One-Time Credit Packs

| Pack Key | Display Name | Price (USD) | Credits Granted | Unit Price |
| :--- | :--- | :--- | :--- | :--- |
| `pack_50` | 50 Credits | \$18.00 | 50 | \$0.36 / credit |
| `pack_150` | 150 Credits | \$35.00 | 150 | \$0.23 / credit *(Popular)* |
| `pack_500` | 500 Credits | \$89.00 | 500 | \$0.17 / credit *(Agency)* |

---

## 3. Webhook Route & Role Mappings

All webhook handlers verify cryptographic HMAC signatures before executing atomic PostgreSQL transactions. Handlers record event identifiers in the `ProcessedWebhookEvent` table to guarantee idempotency.

### A. Paddle Webhook (`/api/billing/paddle-webhook`)
- **Signature Header**: `paddle-signature` (HMAC-SHA256 verified using `paddle.webhooks.unmarshal`).
- **Events Handled**:
  - `subscription.created` & `subscription.updated`: Resolves plan from Paddle Price ID (`pri_...`).
  - `subscription.canceled`: Resets `role` to `FREE` and updates `subscriptionStatus` to `canceled`.
  - `transaction.completed`: Fulfills one-time credit pack purchases atomically with ledger entry.

#### Webhook Role Mapping:
```
Paddle Price ID (`pri_...`)
  ├── basic   ──► UserRole.CLIPPER  (*) See Known Issue below
  ├── starter ──► UserRole.CLIPPER
  ├── clipper ──► UserRole.CLIPPER
  ├── pro     ──► UserRole.STUDIO
  └── studio  ──► UserRole.STUDIO
```

### B. Stripe Webhook (`/api/billing/webhook`)
- **Signature Header**: `stripe-signature` (verified via `stripe.webhooks.constructEvent`).
- **Events Handled**:
  - `checkout.session.completed`: Upgrades user role, seeds initial credits, logs `CreditTransaction`.
  - `customer.subscription.updated`: Syncs active tier or downgrades canceled subscriptions to `FREE`.
  - `invoice.payment_succeeded`: Automatically renews monthly credit allotment at billing cycle rollover.
  - `customer.subscription.deleted`: Immediate fallback to `FREE`.

### C. Whop Webhook (`/api/billing/whop-webhook`)
- **Signature Headers**: `webhook-signature`, `whop-signature`, or `svix-signature` (Standard Webhooks HMAC-SHA256).
- **Events Handled**:
  - `membership.went_valid` / `payment.succeeded`: Maps Whop product/plan ID to Clipzila credit packs or tier upgrades.
  - `membership.went_invalid`: Revokes premium tier and marks user role as `FREE`.

---

## 4. Known Issue: Paddle `basic` Plan Role Mapping

### Root Cause
The current Prisma PostgreSQL schema (`prisma/schema.prisma`) defines the `UserRole` enum with four values:
```prisma
enum UserRole {
  FREE
  CLIPPER
  STUDIO
  ADMIN
}
```
Because `BASIC` is not currently an enum value in the database, `src/app/api/billing/paddle-webhook/route.ts` maps both `'basic'` and `'clipper'` plan keys to `role = 'CLIPPER'`:
```typescript
if (planKey === 'basic' || planKey === 'clipper') role = 'CLIPPER'
```

### Business Impact
Users subscribing to the \$15/mo **Basic** plan currently receive **Starter** (`CLIPPER`) role permissions (45-minute video duration limits are enforced at the plan level, but the role enum in the database reads `CLIPPER`). This is a safe default preventing service disruption, but represents an asymmetry between plan tiers and database roles.

### Proposed Fix (For Technical Buyer)
To separate Basic and Starter roles at the schema level:
1. Run a PostgreSQL migration to add `BASIC` to the `UserRole` enum:
   ```sql
   ALTER TYPE "UserRole" ADD VALUE 'BASIC';
   ```
2. Update `prisma/schema.prisma`:
   ```prisma
   enum UserRole {
     FREE
     BASIC
     CLIPPER
     STUDIO
     ADMIN
   }
   ```
3. Update `src/app/api/billing/paddle-webhook/route.ts`:
   ```typescript
   if (planKey === 'basic') role = 'BASIC'
   if (planKey === 'clipper') role = 'CLIPPER'
   ```
4. Update `planForRole` in `src/lib/stripe.ts` to map `BASIC: 'basic'`.
