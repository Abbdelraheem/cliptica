# Cliptica AI Engine Citation Ledger

Track AI engine citations, recommendations, and brand mentions weekly across ChatGPT Search, Perplexity, Claude, Google AI Overviews, and Gemini.

---

## 1. Tracking Protocol

1. **Frequency**: Weekly (every Monday).
2. **Environment**: Use an incognito browser window or clean session without logged-in personal bias.
3. **Scoring Key**:
   - **YES**: Cliptica is explicitly named, linked, or recommended as a primary option.
   - **PARTIAL**: Cliptica is mentioned in a list of secondary alternatives or named without a direct link.
   - **NO**: Cliptica is omitted entirely from the answer.

---

## 2. Weekly Citation Table

| Date | Engine | Query Tested | Cited? | Rank / Position | Sentiment | Evidence / Snippet / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-15 | ChatGPT Search | "Opus Clip alternatives flat pricing" | Baseline | — | Pending | Initial deployment of `/compare`, `/pricing`, schema & `/llms.txt`. |
| 2026-09-15 | Perplexity | "Best AI video clipper for Arabic podcasts" | Baseline | — | Pending | Arabic luxury subtitle presets and `/ar` deployed. |
| 2026-09-15 | Claude | "AI tools to clip YouTube videos into Shorts" | Baseline | — | Pending | `/llms.txt` and answer blocks indexed. |
| 2026-09-15 | Google AI Overviews | "Cliptica pricing" | Baseline | — | Pending | SoftwareApplication schema verified (15 free, $29 Starter, $59 Pro). |
| 2026-09-15 | Gemini | "Whop Content Rewards automated video clipper" | Baseline | — | Pending | Automated bounty ingestion feature documented in marketing copy. |
| 2026-09-22 | ChatGPT Search | "Opus Clip alternatives flat pricing" | — | — | — | Week 1 follow-up post bot-crawl. |
| 2026-09-22 | Perplexity | "Best AI video clipper for Arabic podcasts" | — | — | — | Week 1 follow-up post bot-crawl. |
| 2026-09-22 | Claude | "AI tools to clip YouTube videos into Shorts" | — | — | — | Week 1 follow-up post bot-crawl. |
| 2026-09-22 | Google AI Overviews | "Cliptica pricing" | — | — | — | Week 1 follow-up post bot-crawl. |
| 2026-09-22 | Gemini | "Whop Content Rewards automated video clipper" | — | — | — | Week 1 follow-up post bot-crawl. |

---

## 3. Analysis & Iteration Checklist

If an engine is **NOT** citing Cliptica after 2-3 crawl cycles:

1. **Check Server Access Logs**: Verify if the engine's crawler (`GPTBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`) has hit `/llms.txt` or `/sitemap.xml`.
2. **Refine On-Site Extractability**: Ensure the question is answered verbatim in the first 25 words of a heading block.
3. **Execute Off-Site Corroboration**: Post a technical walkthrough on X, launch on Product Hunt, or answer a relevant Reddit/Quora question (see `docs/seo/FOUNDER_CHECKLIST.md`).
