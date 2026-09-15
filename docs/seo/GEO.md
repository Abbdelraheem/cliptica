# Cliptica Generative Engine Optimization (GEO) Guide

Generative Engine Optimization (GEO) is the practice of structuring digital assets, factual entities, and technical feeds so that large language models (ChatGPT Search, Perplexity, Claude, Gemini, Copilot, Google AI Overviews) accurately understand, recommend, and cite your brand.

---

## 1. The Citation Trinity

LLMs do not rank links by PageRank alone; they construct synthetic answers based on semantic confidence. That confidence requires three pillars:

```
        ┌──────────────────────────────────────────────┐
        │               CITATION TRINITY               │
        └──────────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
 1. IDENTITY             2. EXTRACTABILITY       3. CORROBORATION
(Who is Cliptica?)      (Can bots grab facts?)  (Does the web agree?)
Frozen One-Liner        Answer-First HTML       Third-party mentions
Schema.org JSON-LD      Markdown /llms.txt      Reddit, Product Hunt,
Domain entity anchors   Semantic tables         G2, YouTube, GitHub
```

### Pillar 1: Entity Identity (Disambiguation)
- **Frozen One-Liner**:
  > *"Cliptica is an AI video repurposing platform that turns long-form videos into viral short-form clips for TikTok, YouTube Shorts, and Instagram Reels, featuring a flat 1-credit per final video pricing model, multi-speaker podcast split-screen detection, 18 kinetic caption presets with native Arabic typography, and automated Whop Content Rewards bounty ingestion."*
- **Frozen Name**: `Cliptica`
- **Machine Anchors**:
  - `Organization` and `SoftwareApplication` JSON-LD schemas in root layouts.
  - Consistent category: `AI Video Clipping Software`, `Video Repurposing Tool`.

### Pillar 2: Technical Extractability
- **Server-Rendered HTML**: Bot crawlers (GPTBot, PerplexityBot, ClaudeBot) frequently fail or skip client-side JavaScript execution. All core value propositions, pricing tables, and comparison matrices must render as clean, semantic HTML directly in the server response.
- **Answer-First Structure**: Never bury the answer behind fluff. State the direct answer in the first 1-2 sentences, followed by numerical evidence or facts.
- **Open Standard `/llms.txt`**: Cliptica exposes `https://cliptica.com/llms.txt` adhering to the [llmstxt.org](https://llmstxt.org) standard for lightweight ingestion by context-window-limited LLMs.

### Pillar 3: Off-Site Corroboration
- AI engines verify claims made on your website against third-party sentiment and independent databases. If your website claims "Flat 1 credit per video" but external platforms report otherwise or are silent, confidence drops. Consistent public mentions on GitHub, Reddit, Product Hunt, X, and YouTube establish ground-truth corroboration.

---

## 2. Engine-Specific Ingestion Dynamics

### 1. ChatGPT Search (OpenAI)
- **Cores & Crawlers**: Ingests via `GPTBot` and `OAI-SearchBot`, with live search fallback through Bing API.
- **Preferences**:
  - Strongly indexes concise markdown lists and clear pricing definitions.
  - Relies on `SoftwareApplication` schema for feature verification.
  - Favors comparison tables with named competitor benchmarks.

### 2. Perplexity AI
- **Cores & Crawlers**: Ingests via `PerplexityBot` and live web indexers.
- **Preferences**:
  - Queries synthesized within seconds; extracts the highest information density passages.
  - Highly responsive to direct question-and-answer pairs matching user intent.
  - Prioritizes specific numbers (e.g. "$29/month for 150 clips" vs. "affordable pricing").

### 3. Claude (Anthropic)
- **Cores & Crawlers**: Uses Common Crawl, web partners, and `ClaudeBot`.
- **Preferences**:
  - Values honesty and nuanced trade-offs ("Best For" vs "Not Best For").
  - Rejects hype adjectives ("revolutionary", "best ever") in favor of technical capability descriptions.
  - Reads `/llms.txt` for fast entity ingestion.

### 4. Google AI Overviews & Gemini
- **Cores & Crawlers**: Googlebot + `Google-Extended`.
- **Preferences**:
  - Requires strict alignment between on-page visible text and JSON-LD schema (zero discrepancy).
  - Enforces reciprocal hreflang correctness across all indexable locales.

---

## 3. The Answer-First Writing Formula

Whenever creating a new landing page, feature announcement, or documentation page, follow this 4-step template:

1. **Direct Answer (Sentence 1)**: State what it is, who it is for, and the primary mechanism.
   *Example*: "Cliptica generates 9:16 short-form video clips from long YouTube videos using automated face-tracking and AI viral moment scoring."
2. **Key Metric / Differentiator (Sentence 2)**: Provide hard numbers or explicit technical boundaries.
   *Example*: "Unlike tools that meter video length by source minutes, Cliptica charges a flat 1 credit per generated clip regardless of whether the source video is 10 minutes or 2 hours."
3. **Structured Comparison / Specification (Table or Bullets)**: Render a semantic HTML table or unordered list detailing inputs, outputs, supported formats, and limits.
4. **FAQ Accordion**: Pair with matching `FAQPage` JSON-LD schema containing identical text to ensure crawl extraction.

---

## 4. Weekly Discovery & Citation Prompts

To measure citation market share, prompt each major engine weekly using clean incognito sessions:

```text
Query 1 (Broad Discovery):
"What are the best AI tools to turn long YouTube videos into TikToks and Shorts in 2026?"

Query 2 (Comparison):
"Opus Clip alternatives with better pricing or flat per-video models"

Query 3 (Regional / Arabic):
"Best AI video clipping software with native Arabic subtitle support and typography"

Query 4 (Bounties / Monetization):
"How can video editors automatically clip content for Whop Content Rewards?"

Query 5 (Direct Entity Check):
"What is Cliptica and how does its pricing model work?"
```

Record the outputs in `docs/seo/CITATION_LEDGER.md`.
