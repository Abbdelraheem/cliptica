# Clipzila — Known Issues & Troubleshooting Guide

This document catalogs active, reported, or deferred issues across the Clipzila codebase, along with root causes, defensive mitigations applied, and triage steps for the technical operator.

---

## 1. Unconfirmed Mobile Crash Report

### Issue Description
A customer reported: *"the site crashed on mobile"*, without providing device model, OS version, browser engine, or steps to reproduce.

### Defensive Hardening Applied
1. **Root Global Error Boundary (`src/app/global-error.tsx`)**:
   - Added a dedicated Next.js App Router root layout error boundary catching any uncaught fatal render exceptions.
   - Dispatches error payloads and stack traces directly to Sentry if `NEXT_PUBLIC_SENTRY_DSN` is configured.
   - Provides users with an interactive "Try again" retry trigger and fallback navigation link.
2. **Mobile Viewport & Touch Target Hardening**:
   - Explicit `Viewport` metadata configured in `src/app/layout.tsx` (`width: device-width`, `initialScale: 1`, `maximumScale: 5`).
   - Root `overflow-x: hidden` applied to both `<html>` and `<body>` in `src/app/globals.css` to prevent horizontal micro-scroll gestures from triggering mobile browser rendering thread crashes or DOM overflow thrashing.
   - Ensured all primary interactive controls (`.btn-lux`) meet or exceed WCAG 2.1 AAA touch target standards (`min-height: 44px; min-width: 44px`).
3. **Hardware Fingerprint Graceful Fallbacks**:
   - Canvas/WebGL hardware fingerprint generator (`src/lib/device.ts`) wrapped in defensive try/catch blocks with fallback random tokens if mobile browsers (e.g., Safari iOS in Lockdown Mode or Brave Mobile) restrict canvas pixel inspection.

### Information Needed to Triage if Recurred
If a user reports a mobile issue, request the following diagnostic telemetry:
- **Device & OS**: e.g., iPhone 15 Pro (iOS 18.2) or Samsung Galaxy S24 (Android 15).
- **Browser & Version**: e.g., Mobile Safari 18, Chrome Mobile 131, or in-app WebViews (Instagram/TikTok in-app browser).
- **Exact URL & State**: URL where the crash occurred (e.g., `/dashboard/projects/detail` vs `/register`).
- **Network / Console Logs**: Remote Safari Web Inspector or Chrome DevTools remote debugging console errors; Sentry event digest ID.

---

## 2. Paddle Basic Plan Schema Mapping

### Issue Description
Subscriptions to the \$15/mo **Basic** plan map to `UserRole.CLIPPER` in `src/app/api/billing/paddle-webhook/route.ts` because the Prisma enum `UserRole` only contains `FREE`, `CLIPPER`, `STUDIO`, and `ADMIN`.

### Resolution & Next Step
Documented in detail in `docs/BILLING.md`. Requires a single migration (`ALTER TYPE "UserRole" ADD VALUE 'BASIC';`) and updating `prisma/schema.prisma` before mapping `if (planKey === 'basic') role = 'BASIC'`.

---

## 3. Self-Hosted Next.js Security Advisories (`npm audit`)

### Issue Description
`npm audit --omit=dev` notes upstream advisories for Next.js 15.5.25 regarding SVG image optimization and SSG/ISR cache poisoning in self-hosted Node setups.

### Mitigation
- In production, Clipzila runs behind an Nginx reverse proxy / Cloudflare CDN that drops malformed cache control headers.
- SVG image optimization is restricted to trusted internal assets. Upgrading to Next.js 16 should be scheduled when the major React 19 compiler toolchain stabilizes.
