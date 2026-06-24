# Louisiana Startup Report — AI Chatbot · Technical Architecture Overview

*Prototype handoff. Covers the built prototype and the planned production specs.*

---

## Summary

The Louisiana Startup Report chatbot is an embedded data assistant over a startup-formation survey dataset. Users ask questions in plain language and get back **sourced, caveated statistics pulled from the actual dataset via tool calls** — the model queries structured data and reports findings, it does not generate numbers freehand. It ships as a slide-up drawer at the bottom of the public web report. Built on Next.js 15 (App Router) + the Anthropic Claude API, deployed on Vercel.

The prototype was deliberately built around a set of **guardrails** that should carry into the production build:

- **Accuracy & sourcing** — every statistic comes from a deterministic query tool, never from model invention. The system prompt requires stating the base count with every percentage ("69% of the 93 who answered") and explicitly forbids fabricating numbers.
- **Privacy (enforced in code, not just prompt text)** — a `MIN_CELL_SIZE = 10` floor suppresses any result cell below 10 respondents at the tool layer; reliability warnings auto-attach for small samples; no parish/zip-level geography; no company re-identification.
- **Cost & abuse** — trimmed conversation history, a hard cap on tool calls per query, a per-session query limit, a terms gate, and session-only state (no background calls) keep API spend bounded and predictable.
- **Reliability** — the model ID is single-sourced and uses a rolling alias (not a retirement-prone dated snapshot); a `/api/health` endpoint flags model unavailability; the chat route degrades gracefully on a 404.
- **Security posture (honest caveat)** — the current `/admin` gate is cosmetic, not real auth. Production must replace it with server-side authentication. See §10.

Sections 1–12 below give the specifics.

---

## 1. What it is
An embedded data assistant over the 2025 Greater New Orleans Startup Report survey (112 respondents). Users ask questions in plain language; the assistant answers with **sourced, caveated statistics pulled from the actual dataset via tool calls** — not free-text generation. It lives as a slide-up drawer at the bottom of the public web report.

## 2. Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| Language | JavaScript (no TypeScript) |
| Hosting | Vercel Pro |
| LLM | Anthropic Claude API — `claude-sonnet-4-6`, `max_tokens: 2048` |
| Streaming | Manual SSE over `ReadableStream` (word-by-word) |
| Charts | Custom Canvas renderer (no chart library), 1600×900 |
| Styling | Single global CSS file (no Tailwind, no CSS modules) |
| Data (current) | Static JSON, `data/gno-2025.json` |

## 3. Core design — grounded tool-calling, not RAG
The defining decision: the model **never invents numbers**. Every statistic comes from a deterministic query tool run against the structured dataset. This gives sourced, reproducible, privacy-guarded answers — and is deliberately *not* an embeddings/RAG approach at this stage (RAG is planned for the larger statewide corpus — see §11).

```
User msg ─▶ /api/chat ─▶ Claude (system prompt + 8 tool defs + trimmed history)
                              │
                  stop_reason == tool_use ──▶ executeTool() runs query on JSON
                              │  (status streamed to client via SSE)
                              ▼
                  loops up to MAX_ITERATIONS (10) ──▶ final text
                              │
                  streamed word-by-word as SSE ──▶ ChatDrawer renders
                              │
                  trackSession() logs tokens/tools/cost
```

## 4. Chat request flow (`app/api/chat/route.js`)
1. POST with full conversation history.
2. History trimmed to first message + last 16 (`MAX_HISTORY_TURNS = 8`) to cap token cost.
3. Claude receives system prompt (~1.4K tokens) + 8 tool definitions (~0.5K tokens) + history.
4. On `tool_use`, `executeTool()` queries the JSON and returns results; a status line streams to the client per tool call.
5. Up to `MAX_ITERATIONS = 10` tool calls, then a forced final answer.
6. Final text streamed word-by-word (manual SSE flush) for smooth render.
7. Error handling branches on HTTP status: `401` auth · `402/429` credits/limit · **`404` model retired** · `5xx` upstream.

## 5. Data & privacy layer (`lib/data-tools.js`)
Eight query tools: `count_respondents`, `get_distribution`, `cross_tabulate`, `get_numeric_stats`, `analyze_funding_gaps`, `get_revenue_trajectory`, `get_dataset_summary`, `list_available_fields`. Field metadata (types, response counts) lives in `FIELD_INFO` (~70 fields after a data audit).

**Privacy is enforced in code, not just prompt text** — this is load-bearing and should carry into production:
- `MIN_CELL_SIZE = 10` — any query cell below 10 respondents is suppressed at the tool layer.
- Reliability notes auto-attach when n < 20 (caution) / n < 10 (warning).
- `cross_tabulate` suppresses sub-threshold cells and reports them as suppressed.
- No parish/zip geography (privacy + sample-size). No company re-identification.
- Multi-select fields flag that percentages don't sum to 100.
- System prompt enforces "state the base count with every percentage; never fabricate numbers."

## 6. Output: streaming + charts
- Manual word-level SSE (`status`, `delta`, `done`, `done_text` events) — chosen for smoother UX than raw token streaming.
- When a response benefits from a chart, the model emits a fenced `chart-config` block; the UI strips it from text and shows a "Visualize" button → Canvas renderer (`bar`, `hbar`, `donut`, `stacked`). Attribution footer is baked into every export; "copy data" yields TSV for Excel/Sheets.

## 7. Cost & abuse controls (already in place)
| Control | Value | Purpose |
|---|---|---|
| `MAX_HISTORY_TURNS` | 8 | caps context sent per request |
| `MAX_ITERATIONS` | 10 | caps tool calls per query |
| `QUERY_HARD_LIMIT` | 25 | locks input per session |
| `DATA_REQUEST_NUDGE_AFTER` | 15 | surfaces data-request CTA |
| Terms gate + session-only state | — | friction + no background calls |

Rough cost: ~$0.005–0.02/query; ~$0.25–0.50 for a session that hits the limit.

## 8. Admin analytics (`/admin`, `/api/analytics`, `lib/analytics.js`)
Internal dashboard doing two jobs: **engagement** (conversations, queries, tool usage, recent sessions, daily trend) and **cost** (tokens in/out, estimated $). Reads through a single `getAnalytics(days)` function returning `{ dailyData, toolCounts, totals, recent }`.

> **Status:** the UI + aggregation are done, but the store is in-memory and **pre-seeded with demo data** — current numbers illustrate the design, not real traffic. Production needs a persistence layer behind the same read contract (§11).

## 9. Model config & reliability
- Model ID is single-sourced in `lib/model.js` and consumed by the chat route and the health check — **use a rolling alias, never a dated snapshot** (a retired dated snapshot 404s and takes the bot offline; this happened once).
- `GET /api/health` queries the Models API and returns 200/503 depending on whether the configured model is still served — an early-warning hook for an uptime monitor or Vercel Cron.

## 10. Security posture — read before reusing the admin gate
The current `/admin` gate is **cosmetic, not real auth**: the password is a `NEXT_PUBLIC_` value inlined into the client bundle, and auth state is `sessionStorage` (`sessionStorage.setItem('la-admin-auth','ok')` bypasses it). Fine for a prototype; **must be replaced with server-side auth** and a protected analytics endpoint for production.

## 11. Planned / not-yet-built (production roadmap)
- **Server-side auth** — Supabase Auth, magic-link + username/password, approved-email gating. Replaces the cosmetic admin gate and gates the data-request workflow.
- **Analytics persistence** — swap the in-memory seed for Vercel KV / Upstash Redis (append-only event log) or Supabase Postgres; keep the `getAnalytics()` read contract identical so the dashboard UI is untouched. Remove seed data.
- **RAG pipeline (Phase 3)** — Claude API + Supabase **pgvector** for the larger corpus, with on-the-fly chart generation and attribution baked in. The current tool-calling layer stays for structured/numeric queries; RAG augments for unstructured retrieval.
- **Per-IP rate limiting** — required before public launch (middleware or Edge Config); protects the API budget.
- **Statewide scale** — 8 regions, ~800+ respondents (≈7× data). Needs a region-aware system prompt, region filters in the tools, a dynamic `get_dataset_summary`, and caching of common queries.
- **Model resilience** — scheduled `/api/health` check with alerting; optional fallback model on `404`.
- **Infra target** — Vercel Pro + Supabase Pro + Claude API (Sonnet), est. ~$1,200–2,400/yr.

## 12. Repo & ops notes
- Routes: `app/api/chat` (core loop), `/api/analytics`, `/api/data-request`, `/api/health`. UI: `app/page.js` + `app/components/*` (ChatDrawer, ChartModal, ChartBuilder, AnimatedBackground, DataRequestModal, AboutModal). Logic: `lib/{system-prompt,data-tools,design-system,analytics,model}.js`.
- Env: `ANTHROPIC_API_KEY` (server, required), `NEXT_PUBLIC_ADMIN_PASSWORD` (prototype gate).
- Deploy: push to `main` → Vercel auto-deploys production.
- Gotchas: keep the dataset free of raw PII; don't pin dated model snapshots; the design system (`lib/design-system.js`) is the single source for palettes/typography/canvas constants.
