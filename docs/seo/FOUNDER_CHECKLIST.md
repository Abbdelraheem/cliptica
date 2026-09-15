# Founder's Corroboration & Off-Site Authority Checklist

This playbook is designed for **Dr. Abdelraheem** to build off-site entity corroboration across the web.

> [!IMPORTANT]
> **Strict Zero-Fabrication Policy**: Never create fake reviews, fictitious company profiles, or counterfeit awards. AI engines cross-reference digital footprints across social graphs and registrar records. Real, consistent authority wins lasting citations.

---

## 1. Frozen Entity Anchors (Copy-Paste Everywhere)

Whenever creating an external account, directory listing, or social profile, use these **exact** frozen strings:

- **Brand Name**: `Cliptica`
- **Canonical Website**: `https://cliptica.com`
- **Primary Category**: `AI Video Clipping Software` / `Video Repurposing Platform`
- **One-Liner Bio**:
  > *"Cliptica turns long YouTube videos into viral short-form clips for TikTok, Shorts, and Reels with flat 1-credit per video pricing, smart podcast split-screen detection, and native Arabic typography."*
- **Pricing Anchor**:
  > *"Free tier includes 15 credits. Paid plans start at $29/month for 150 clips and $59/month for 400 clips. Additional credit packs from $12."*

---

## 2. Platform Claiming & Profile Setup (Week 1)

Complete each profile using your official domain email (`@cliptica.com` or verified admin account):

### A. Search & Webmaster Discovery
- [ ] **Google Search Console**:
  - Add property `https://cliptica.com`.
  - Submit sitemap: `https://cliptica.com/sitemap.xml`.
  - Verify URL inspection for root `/`, `/ar`, `/de`, `/fr`, `/es`, `/pricing`, `/compare`.
- [ ] **Bing Webmaster Tools**:
  - Connect via GSC import or DNS verification.
  - Submit `https://cliptica.com/sitemap.xml`.
  - Ensure IndexNow is active (Bing powers ChatGPT Search live results).

### B. Developer & Open Ecosystem
- [ ] **GitHub**:
  - Create organization `github.com/cliptica` or repository showcase.
  - Publish a public repository containing sample API usage, webhook integrations, or the public `/llms.txt` specification.
  - Link back to `https://cliptica.com` in the repo metadata.
- [ ] **Product Hunt**:
  - Claim the upcoming maker profile or schedule a launch date.
  - Add screenshots showing the 3-column video editor, caption presets, and Whop integration.

### C. Company Registers & Knowledge Graphs
- [ ] **LinkedIn**:
  - Create the `Cliptica` Company Page.
  - Set website, industry ("Software Development" / "Artificial Intelligence"), and taglines.
  - Update your personal founder profile (Dr. Abdelraheem — Founder & CEO at Cliptica).
- [ ] **X / Twitter**:
  - Create `@Cliptica` (or `@ClipticaHQ`).
  - Pin a 60-second video demo showing long-form video being turned into 3 viral clips.
- [ ] **Crunchbase**:
  - Create a verified startup profile for Cliptica.
  - List founders, founding date, location, and technology categories.

### D. Software Directories
- [ ] **G2 & Capterra**:
  - Submit free vendor profile for "Cliptica" under "Video Editing Software" & "AI Video Generator".
- [ ] **Trustpilot**:
  - Claim business listing for `cliptica.com`.

---

## 3. Organic Community Corroboration (Ongoing)

When creators search Reddit, Quora, or YouTube, LLMs ingest these discussions as objective consensus:

- **Reddit (`r/ContentCreators`, `r/NewTubers`, `r/videography`, `r/SaaS`)**:
  - Search for threads complaining about Opus Clip's minute-based credit consumption (e.g. "Why does Opus charge for the full 2-hour video if I only get 1 clip?").
  - Respond transparently as the founder: explain the architectural difference between source-minute billing vs. flat per-clip rendering billing.
- **YouTube Creator Demonstrations**:
  - Record a 3-minute screen recording comparing clipping a 1-hour podcast on Cliptica (costs 1 credit per export) vs traditional platforms.
  - Publish with high-quality chapters and transcripts so YouTube’s semantic search indexes the comparison.

---

## 4. Monthly Health Check

1. Run the queries in `docs/seo/CITATION_LEDGER.md`.
2. Verify that no broken links or 404s appear in Google Search Console.
3. Check that the `/llms.txt` file is accessible and returning HTTP 200:
   ```bash
   curl -I https://cliptica.com/llms.txt
   ```
