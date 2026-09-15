# Cliptica Multilingual Architecture & Locales

This document specifies the multilingual routing, hreflang structure, and internationalization standards for Cliptica.

---

## 1. Supported Locales

| Locale Code | Language | Text Direction | URL Prefix | Hreflang Tag | Target Geographies | Default Currency | Fallback Locale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `en` | English (Default) | LTR | `/` (Unprefixed) | `en` + `x-default` | Global (US, UK, CA, AU, Worldwide) | USD ($) | N/A |
| `ar` | Arabic (العربية) | RTL | `/ar` | `ar` | Saudi Arabia, UAE, Egypt, MENA | USD ($) | `en` |
| `de` | German (Deutsch) | LTR | `/de` | `de` | Germany, Austria, Switzerland (DACH) | USD ($) | `en` |
| `fr` | French (Français) | LTR | `/fr` | `fr` | France, Belgium, Switzerland, Canada | USD ($) | `en` |
| `es` | Spanish (Español) | LTR | `/es` | `es` | Spain, Mexico, Colombia, LATAM | USD ($) | `en` |

---

## 2. URL Strategy & Routing Policy

1. **English at the Root (No `/en` prefix)**:
   - Root URL `https://cliptica.com/` serves the canonical English experience.
   - Preserves all pre-existing backlinks, social shares, external citations, and OAuth callback URLs without redirect loops or broken references.
   - `x-default` and `en` both point to the root URLs (`/`, `/pricing`, `/compare`).

2. **Target Locales Prefixed**:
   - Arabic: `https://cliptica.com/ar`, `/ar/pricing`, `/ar/compare`
   - German: `https://cliptica.com/de`, `/de/pricing`, `/de/compare`
   - French: `https://cliptica.com/fr`, `/fr/pricing`, `/fr/compare`
   - Spanish: `https://cliptica.com/es`, `/es/pricing`, `/es/compare`

3. **Application & Internal Routes Stay English**:
   - `/dashboard/*`, `/admin/*`, `/api/*`, `/login`, `/register`, `/auth/*` are strictly English and bypass country-based routing.

---

## 3. Country Detection & Crawler Safety Rules

### Human Visitors:
- **First Visit (No Cookie)**: When an un-cookied human arrives at the root `/`, the Next.js middleware inspects geolocation headers (`cf-ipcountry`, `x-vercel-ip-country`, `cloudfront-viewer-country`).
  - If country is in `COUNTRY_TO_LOCALE` (e.g. `SA`, `AE`, `EG` -> `ar`), the user is redirected via **307 Temporary Redirect** to `/[locale]` (e.g. `/ar`).
- **Subsequent Visits (Cookie Present)**: If the `NEXT_LOCALE` cookie is present, it takes priority over IP headers. The cookie lasts 1 year and is set whenever the user selects a language in the `LanguageSwitcher` dropdown.

### Search & AI Crawlers (CRITICAL RULE):
- **NEVER REDIRECT CRAWLERS**: Search engines (Googlebot, Bingbot) and AI engines (GPTBot, ClaudeBot, PerplexityBot) **must never be 307-redirected** based on geolocation headers. Doing so poisons Google Search Console indexing and breaks canonical discovery.
- `isCrawler(userAgent)` regex in `src/lib/seo/constants.ts` inspects incoming user-agents. If a crawler is detected at `/`, it receives **200 OK directly** with the canonical English HTML, containing the full reciprocal `hreflang` matrix.

---

## 4. Reciprocal Hreflang Structure

Every public marketing page includes reciprocal `hreflang` link tags in both `<head>` and `sitemap.xml`:

```html
<!-- Example from https://cliptica.com/ -->
<link rel="alternate" hreflang="x-default" href="https://cliptica.com/" />
<link rel="alternate" hreflang="en" href="https://cliptica.com/" />
<link rel="alternate" hreflang="ar" href="https://cliptica.com/ar" />
<link rel="alternate" hreflang="de" href="https://cliptica.com/de" />
<link rel="alternate" hreflang="fr" href="https://cliptica.com/fr" />
<link rel="alternate" hreflang="es" href="https://cliptica.com/es" />
```

---

## 5. How to Add a New Locale

To add a new language (e.g. Japanese `ja` or Portuguese `pt`):

1. **Update Constants** (`src/lib/seo/constants.ts`):
   ```typescript
   export const LOCALES = ['en', 'ar', 'de', 'fr', 'es', 'ja'] as const
   export type Locale = (typeof LOCALES)[number]
   ```
2. **Add Country Mappings** (`src/lib/seo/constants.ts`):
   ```typescript
   COUNTRY_TO_LOCALE: Record<string, Locale> = {
     // ...
     JP: 'ja',
   }
   ```
3. **Create Message Catalog** (`src/lib/i18n/messages/ja.ts`):
   - Implement the `MessageCatalog` interface from `src/lib/i18n/types.ts`.
   - Provide full translations for `meta`, `nav`, `hero`, `geoAnswer`, `compare`, `pricingSection`, `faqs`, and `footer`.
4. **Register in Resolver** (`src/lib/i18n/index.ts`):
   - Import `ja` and add it to `catalogs`.
5. **Update Language Switcher** (`src/components/language-switcher.tsx`):
   - Add label (e.g. `{ code: 'ja', label: '日本語', dir: 'ltr' }`).
6. **Verify 100% Parity**:
   - Run `npx vitest run tests/i18n-parity.test.ts`.
   - Ensure all keys exist and no type errors are emitted.
