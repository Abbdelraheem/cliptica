# Cliptica — Detective Findings & Security/System Audit Report
**Date**: 2026-09-11  
**Auditor**: Role 1 — The Detective  
**Target**: Cliptica Web Application, Background Worker, Database Layer, and EC2 Production Infrastructure  

---

## Executive Summary
A comprehensive audit was performed across all 39 API routes, the Node.js media worker pipeline (`worker/worker.mjs`), Prisma schema & database configurations, Next.js middleware, frontend security postures, and EC2 production services.

The system is structurally sound with strong atomic transactions on credit deductions, idempotency on Stripe webhooks, robust SSRF controls on URL ingestion, and face-tracking FFmpeg filters. However, several critical resilience, consistency, and operational gaps were identified and are catalogued below by severity.

---

## Findings by Severity

### 1. HIGH SEVERITY
| ID | Finding | Location | Impact |
|---|---|---|---|
| **SEC-01** | Missing Network Timeouts & AbortSignals on Worker External Fetches | `worker/worker.mjs` (lines 274, 347, 447) | If Groq or OpenAI hangs, TCP drops, or rate-limits without closing the connection, worker execution stalls indefinitely until the 30-minute stale job reaper triggers. |
| **SEC-02** | Device Check Endpoint Probing Without Direct Rate Limiter | `src/app/api/device/check/route.ts` | An unauthenticated attacker can probe valid email-to-device bindings or flood device conflict lookups without triggering route-specific rate limits. |

### 2. MEDIUM SEVERITY
| ID | Finding | Location | Impact |
|---|---|---|---|
| **FEAT-01** | Virality Sub-scores In Schema But Unpopulated by Worker | `prisma/schema.prisma` (`hookScore`, `retentionScore`, `shareScore`) vs `worker/worker.mjs` | Database schema has dedicated sub-score columns, but the LLM prompt only requests an aggregate `score`. Columns remain null, depriving users of actionable feedback. |
| **FEAT-02** | Aspect Ratio Hardcoded to 9:16 Only | `worker/worker.mjs` (`renderClip`) | Pipeline only generates vertical 9:16 clips (1080x1920). Square (1:1) and landscape (16:9) formats are unsupported, limiting cross-platform utility (e.g. LinkedIn, Twitter). |
| **UX-01** | Granular Stage Labels Missing from Worker Progress Reporting | `worker/worker.mjs` (`setP`) & `ProcessingJob` model | Users only see percentage numbers without descriptive stages (e.g., "Downloading media", "Transcribing with Whisper", "Analyzing virality hooks", "Rendering captions"). |
| **BRD-01** | Legacy "Nology" Brand Leakage in User-Facing Views & Emails | Multiple files in `src/app/`, `src/components/`, `src/lib/email.ts` | Brand confusion where users encounter "Nology" and "NOLOGY" instead of "Cliptica" across transactional emails, error messages, and landing copy. |

### 3. LOW SEVERITY & CODE HYGIENE
| ID | Finding | Location | Impact |
|---|---|---|---|
| **DB-01** | `Prisma.raw` Used in Admin Stats Aggregation | `src/app/api/admin/stats/route.ts` (line 9) | Table names interpolated via `Prisma.raw(table)`. While constrained to TypeScript union `'User' \| 'Project' \| 'Clip'`, safe dictionary mapping is standard best practice. |
| **INF-01** | Missing Process Memory & CPU Monitoring Documentation | `INFRASTRUCTURE_NOTES.md` (absent) | No formal benchmark document recording real-world CPU/RAM usage under load on EC2. |
| **LNT-01** | Non-blocking ESLint Warnings in Tests & Styles | `tests/billing-redirects.test.ts`, `tests/settings-features.test.ts`, `worker/caption-styles.mjs` | Unused variables and `any` types in non-production bundles. |

---

## Infrastructure Health Verification (Live EC2)
- **Host**: AWS EC2 `13.62.192.145` (Ubuntu 24.04, 7.6 GB RAM, 38 GB Disk)
- **PM2 State**: Verified via `sudo pm2 list` — all 3 processes (`nology-web`, `nology-worker`, `nology-bot`) are **ONLINE**.
- **Resource Utilization**: Host CPU 0.4%, RAM 12% (~934MB used), Disk 28% (28 GB available).
- **Test Suite**: 12 test suites, 144 unit & integration tests passing (100%).

---

## Next Steps
Proceeding immediately to **ROLE 2 — THE SENIOR ENGINEER** for root-cause analysis, test-driven remediation planning, and population of `NEEDS_HUMAN_DECISION.md`.
