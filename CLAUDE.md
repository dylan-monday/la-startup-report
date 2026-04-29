# Louisiana Startup Report 2026 — AI Chatbot
## Project documentation for Claude and future developers

This document is the single source of truth for the AI chatbot layer of the Louisiana Startup Report. Read this before touching any file. It captures architecture decisions, data handling rules, known gotchas, and the reasoning behind each constraint.

---

## What this is

An interactive data assistant built on top of the 2025 Greater New Orleans Startup Report survey dataset (112 respondents). Users ask questions in plain language; the assistant queries the actual dataset via tool calls and responds with sourced, caveated analysis. It is embedded in the public-facing web report at the bottom of the page as a slide-up drawer.

**Partners:** Tulane Freeman School of Business (Albert Lepage Center for Entrepreneurship & Innovation) + LA.io + Monday + Partners (design and development).

**Live URL:** Deployed on Vercel. Check Vercel dashboard for current URL.

**Git remote:** `https://github.com/dylan-monday/la-startup-report` (or check `git remote -v`)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | JavaScript (no TypeScript) |
| Hosting | Vercel Pro |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Streaming | Server-Sent Events via ReadableStream |
| Charts | Custom Canvas API renderer (no chart library) |
| Styling | Global CSS (app/globals.css) — no Tailwind, no CSS modules |
| Data | Static JSON file at data/gno-2025.json |
| Design system | lib/design-system.js (palettes, fonts, canvas layout constants) |

---

## File structure

```
chatbot/
├── app/
│   ├── page.js                    — Main report page. Sticky nav, hero, sections, modals.
│   ├── globals.css                — All CSS. Single file, no modules.
│   ├── layout.js                  — Root layout. Font loading (Aktiv Grotesk, JetBrains Mono).
│   ├── api/
│   │   ├── chat/route.js          — Core API route. Claude tool loop + SSE streaming.
│   │   └── data-request/route.js  — Email handler for data access requests.
│   └── components/
│       ├── ChatDrawer.js          — Slide-up chat UI. Terms gate, query limit, starters.
│       ├── ChartModal.js          — Fullscreen modal wrapper for charts.
│       ├── ChartBuilder.js        — Canvas chart renderer. bar, hbar, donut, stacked types.
│       ├── AnimatedBackground.js  — Generative animated background (3 modes, mouse tracking).
│       ├── DesignPanel.js         — Dev tool: live palette/font switcher (hidden in production).
│       ├── DataRequestModal.js    — Form for requesting raw dataset access from Tulane.
│       └── AboutModal.js          — About this report modal (methodology, partners).
├── data/
│   └── gno-2025.json              — The dataset. 112 respondents. DO NOT COMMIT raw PII.
├── lib/
│   ├── system-prompt.js           — Claude's instructions: voice, data rules, chart schema.
│   ├── data-tools.js              — Tool definitions + execution. All data queries live here.
│   └── design-system.js           — Color palettes, typography, canvas layout constants.
├── public/
│   └── images/favicon.png
├── CLAUDE.md                      — This file.
├── .env.local                     — ANTHROPIC_API_KEY (never commit)
├── .env.local.example             — Template for new environments
└── package.json
```

---

## How the AI loop works

The route at `app/api/chat/route.js` runs a tool-use loop:

1. User message arrives via POST with the conversation history.
2. Conversation is trimmed to first message + last 16 messages (8 turns) before sending to Claude. This caps token cost on long sessions.
3. Claude receives the system prompt, tool definitions, and conversation history.
4. If Claude calls a tool, `executeTool()` in `lib/data-tools.js` runs the query against the JSON dataset and returns results. Status messages stream to the client via SSE during tool calls.
5. Claude can chain up to 10 tool calls (MAX_ITERATIONS) before being forced to respond. Most queries resolve in 1-3 calls.
6. Final text response is streamed word-by-word with `setTimeout(r, 0)` yields so SSE actually flushes.
7. The client (`ChatDrawer.js`) parses `data: {...}` SSE events: `status`, `delta`, `done`, `done_text`.

The non-streaming Anthropic SDK call is intentional. Streaming is handled manually at the word level for better UX than raw streaming provides.

---

## Data handling — read this carefully

### The dataset

`data/gno-2025.json` contains 112 self-reported survey responses. Each respondent is an object. Fields are a mix of single-select categories, multi-select arrays, and numeric values. See `FIELD_INFO` in `lib/data-tools.js` for the full field list with types and response counts.

**The dataset has 8 tools:**
- `count_respondents` — count with optional filters
- `get_distribution` — value counts + percentages for any field
- `cross_tabulate` — two-field crosstab (cells below n=10 are suppressed)
- `get_numeric_stats` — mean, median, min, max for numeric fields
- `analyze_funding_gaps` — attempted vs. utilized funding comparison
- `get_revenue_trajectory` — year-over-year revenue (and optional margin) distribution
- `get_dataset_summary` — high-level overview, used for orientation questions
- `list_available_fields` — full FIELD_INFO for field discovery

### Privacy and accuracy rules (non-negotiable)

**`MIN_CELL_SIZE = 10`** is enforced in `lib/data-tools.js`, not just the system prompt. Any query producing fewer than 10 respondents in a cell is suppressed at the tool level. This protects respondent anonymity and prevents statistically meaningless results from being presented as findings.

- `get_distribution` returns `reliability_note` when responding_count < 20 (caution) or < 10 (warning).
- `cross_tabulate` suppresses individual cells below n=10 and returns a `suppressed_cells` list.
- `get_numeric_stats` returns `reliability_note` when n < 10.

**The system prompt instructs Claude** to state the base whenever citing a percentage ("69% of the 93 respondents who answered this question"). Never drop a raw percentage without the denominator.

**Geography:** No parish-level or zip-level comparisons. The chatbot operates at the regional GNO level. This is both a privacy decision and a data quality decision (some parishes have too few respondents for meaningful comparison).

**No re-identification:** The system prompt explicitly prohibits identifying individual companies. `cross_tabulate` with two highly specific filters can approach re-identification territory — the MIN_CELL_SIZE rule is the technical guard.

**Multi-select fields** (industry, funding, ai_impact, customer_types, etc.) return percentages that do not add to 100%. The tool returns `note_multi_select` to remind Claude of this, and the system prompt instructs Claude to note it to users.

### Fields that were missing from v1 (added in the data audit)

The original implementation exposed ~40 fields. The audit added 31 more, including:
- `special_designations` (Women-Owned, Minority-Owned, etc.) — 112/112 responses
- `has_exit_strategy` — 109/112 responses
- `plan_sales_outside_gno` — 112/112 responses
- `pct_public_sector_revenue` — 93 responses
- `marketing_channels` — 93 responses
- `critical_tech_infrastructure` — 93 responses
- `founder2_*` fields (co-founder demographics) — ~28-33 responses
- `total_age_18_35`, `total_age_36_50`, `total_age_51plus` — workforce age breakdowns
- `total_veteran` — 60 responses
- `margin_2020` through `margin_2025_est` — gross margin trajectory
- `planned_hires_ft`, `planned_hires_pt` — 32-41 responses
- `time_at_location` — 112/112 responses
- `external_service_providers` — 74 responses

**TODO for next session:** Update `lib/system-prompt.js` to reference these fields explicitly so Claude knows to use them when relevant.

---

## API cost strategy

### The billing setup

The chatbot calls the Anthropic API (console.anthropic.com) directly. This is billed separately from any Claude.ai subscription. The API key lives in `.env.local` as `ANTHROPIC_API_KEY`. On Vercel, it is set in project environment variables.

**When the account runs out of credits, the chatbot stops working.** Enable auto-reload on the Anthropic Console billing page so this does not happen during a demo or public launch.

### What drives costs

- **Input tokens dominate.** The system prompt is ~1,400 tokens. Tool definitions add ~500 tokens. Each conversation turn sends the full (trimmed) history. At MAX_HISTORY_TURNS=8, a long session sends up to 16 messages plus the system prompt and tools on every call.
- **Tool calls multiply cost.** Each tool call is a round-trip to the API. A complex query might make 2-3 tool calls before responding. Each call sends the full context.
- **Model:** `claude-sonnet-4-20250514`. Sonnet is the right cost/quality balance for this use case. Do not upgrade to Opus without a cost analysis.
- **max_tokens: 2048** per response. This is appropriate and should not be raised without reason.

### Cost controls already in place

| Control | Where | Effect |
|---|---|---|
| `MAX_HISTORY_TURNS = 8` | route.js | Caps context sent to API per request |
| `MAX_ITERATIONS = 10` | route.js | Hard limit on tool calls per query |
| `QUERY_HARD_LIMIT = 25` | ChatDrawer.js | Locks input after 25 queries per session |
| `DATA_REQUEST_NUDGE_AFTER = 15` | ChatDrawer.js | Surfaces data request CTA before hard limit |
| Terms gate | ChatDrawer.js | Adds friction before first query |
| Session-only state | ChatDrawer.js | No persistence = no background calls |

### Cost estimates (rough)

At current usage, a single query costs approximately $0.005-$0.02 depending on complexity and tool calls. A session hitting the 25-query limit costs roughly $0.25-$0.50. At 100 sessions/month, that is $25-$50/month in API costs. At 1,000 sessions/month (post-launch scale), budget $250-$500/month.

### When scaling to statewide (2026 report)

The 2026 report covers 8 regions with potentially 800+ respondents. The dataset will be 7x larger. Key changes needed:
- The system prompt will need regional awareness and the ability to filter by region.
- Tool descriptions in `FIELD_INFO` will need updating.
- The `get_dataset_summary` tool returns hardcoded counts that will need to dynamically reflect the new dataset.
- Consider caching tool results for common queries (Redis or Vercel KV) to avoid redundant API calls.
- The QUERY_HARD_LIMIT may need to increase. Recalibrate based on actual usage data from the GNO launch.
- Rate limiting per IP address should be implemented before statewide launch.

---

## UI behavior

### Chat drawer

- Slides up from bottom. 60% width, offset from left edge.
- On first open: terms gate requires acknowledgment before chat starts.
- Starter questions shown before first message. Reopenable via "Suggest" button inside the input after conversation starts.
- After 15 queries: nudge banner appears with link to data request form.
- After 25 queries: input locked. Data request CTA shown.
- Copy button on every assistant message. Uses `ClipboardItem` API to write both `text/plain` and `text/html` simultaneously. Rich-text targets (Word, Gmail, Google Slides) receive formatted output with bold, bullets, and paragraph breaks intact. Plain text targets receive clean text with markdown syntax stripped and `•` bullets substituted. Attribution footer travels with both formats. Falls back to `navigator.clipboard.writeText` if `ClipboardItem` is unavailable.
- Escape key closes the drawer.

### Chart output

When Claude's response includes a fenced `chart-config` block, the UI strips it from the displayed text and shows a "Visualize" button. Clicking opens ChartModal with ChartBuilder rendering the chart on a 1600x900 canvas.

Supported chart types: `bar` (vertical), `hbar` (horizontal), `donut`, `stacked` (stacked bar).

Chart rendering uses the design system from `lib/design-system.js`. Palette is passed in the chart-config. Two export options in the chart toolbar:

- **Download PNG** — exports full canvas at 1600x900 with attribution footer baked in.
- **Copy data** — copies chart data as tab-separated values to clipboard, with the source/attribution appended as `#` comment rows. Pastes directly into Excel or Google Sheets. Works for all chart types including stacked (outputs segment columns).

**hbar color behavior:** Even-indexed bars render in `palette.primary`, odd-indexed in `palette.mid`. This creates visual distinction between paired rows (e.g., 2020 vs 2025 brackets) without requiring explicit color overrides in the chart-config. Override per-row by setting `d.color` in the data array.

**Attribution footer:** Rendered in all caps on all exported charts. Format: `TULANE FREEMAN SCHOOL OF BUSINESS · ALBERT LEPAGE CENTER FOR ENTREPRENEURSHIP & INNOVATION · LA.IO` (left) and `LOUISIANA STARTUP REPORT 2026` (right). Monday + Partners is not included in exported chart attribution.

**Known issue resolved:** `renderStacked` would crash if `data` had no `segments` property, leaving the UI stuck on "RENDERING...". Fixed with `validateDataForType()` pre-check and try/catch/finally around the draw callback.

---

## Known gotchas

### Writing JavaScript files via bash heredoc

**DO NOT write JavaScript files using bash `cat > file << 'EOF'` or Python heredoc patterns.** The `!` character gets corrupted to `\!` (bytes 0x5c 0x21). Vercel's SWC compiler throws "Expected unicode escape" on `\!`.

**Always use the `Write` tool directly** when creating or rewriting JS files. This is what fixed `lib/data-tools.js` (which had 6 instances of `\!` corruption) and `app/components/ChatDrawer.js`.

### Git index lock on macOS network mount

The chatbot repo lives on a macOS network-mounted volume. Git operations from within the Linux shell sandbox fail with "Operation not permitted" on `.git/index.lock`.

Workaround used in this project:
```bash
IDX="/tmp/git_idx_$$"
GIT_INDEX_FILE="$IDX" git read-tree HEAD      # start from clean HEAD
GIT_INDEX_FILE="$IDX" git add <files>         # stage only what changed
TREE=$(GIT_INDEX_FILE="$IDX" git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(GIT_INDEX_FILE="$IDX" git commit-tree "$TREE" -p "$PARENT" -m "message")
git update-ref refs/heads/main "$COMMIT"
git push origin main                           # push from terminal (credentials)
```

Push always requires running `git push origin main` from the local terminal, not from the shell sandbox (no credential access).

**With the git MCP connector enabled**, this workaround may not be necessary. Test that first.

### Vercel build: SWC and `!` corruption

If Vercel shows "Expected unicode escape" with a line like `if (\!filters...`, a JS file has the corruption described above. Fix: rewrite the entire file using the `Write` tool (not bash). Then re-commit and push.

### Context across sessions

Claude's memory files (in the Cowork session memory directory) capture project state. Key memory files to check at session start:
- `project_chatbot_architecture.md` — stack and repo details
- `project_chatbot_next_session.md` — outstanding items from previous sessions

---

## Design system

`lib/design-system.js` is the single source for all visual constants. It is used by both the canvas chart renderer and (via CSS variables) the UI.

**Palettes:** indigo (default), blue, teal, green, amber, rose. Each has light and dark variants. The system prompt assigns palettes by data type: indigo=general, blue=funding, teal=operations, green=workforce, amber=regional, rose=demographics.

**Canvas:** All charts render at 1600x900 (16:9). Attribution footer is baked into every export. The `ATTRIBUTION` constant in `lib/design-system.js` controls the footer text — both strings are all caps. `ATTRIBUTION.text` is the institution line (left); `ATTRIBUTION.source` is the report name (right). Monday + Partners is intentionally excluded from chart attribution.

**Fonts:** Aktiv Grotesk (display, weight 300) and JetBrains Mono (data labels, axis values). Both loaded via `app/layout.js`.

---

## System prompt design philosophy

The system prompt (`lib/system-prompt.js`) is written for a research analyst voice: precise, bounded, warm without being chatty. Key rules:

- Lead with the answer. Every response opens with the key finding.
- State base counts. Never cite a percentage without the denominator.
- No fabrication. All numbers come from tool results. The prompt is explicit: "Never fabricate numbers."
- Hard language rules. No em dashes (matches client preference), no "It's not X, it's Y" construction, no filler openers ("Great question!", etc.).
- Chart configs. When data benefits from visualization, Claude appends a `chart-config` fenced block. The UI handles the rest.
- Comparison queries. Claude is instructed to run `get_distribution` twice with filters rather than `cross_tabulate` for multi-select fields. Cross-tabulating two multi-select fields produces an unmanageably large result.

**The system prompt needs updating** to reference the 31 new fields added in the data audit (special_designations, exit strategy, margin trajectory, co-founder data, etc.). Claude will not proactively use fields it is not told exist.

---

## Environment setup

```bash
# Clone and install
cd chatbot
npm install

# Environment
cp .env.local.example .env.local
# Add ANTHROPIC_API_KEY from console.anthropic.com

# Run locally
npm run dev
```

Vercel environment variables needed:
- `ANTHROPIC_API_KEY` (production key from console.anthropic.com)

---

## Outstanding items (as of 2026-04-18)

1. **Update system-prompt.js** to reference newly exposed fields: special_designations, has_exit_strategy, plan_sales_outside_gno, pct_public_sector_revenue, marketing_channels, critical_tech_infrastructure, founder2_* fields, total_age_* fields, margin_* fields, planned_hires_*, external_service_providers.

2. **Admin / analytics dashboard.** Build `app/admin/page.js` with a simple password gate and a dashboard showing: total queries, sessions, token usage, estimated API cost, 30-day query trend (SVG sparkline), top questions by frequency, and recent query table. Also needs `app/api/admin/stats/route.js`. Currently the dashboard scaffolding is planned but not yet built — the API route will return mock data structured for future replacement with a real persistence layer (Vercel KV or Upstash Redis). Token usage logging hooks need to be added to `app/api/chat/route.js` once the store is wired up.

3. **API cost tracking.** Set up a spending alert on the Anthropic Console (console.anthropic.com → Billing → Notifications). Recommended: alert at $25 and hard limit at $100/month until usage is understood.

4. **Rate limiting.** Before public launch, add per-IP rate limiting on the `/api/chat` route. Next.js middleware or a Vercel Edge Config rule. Without this, a single user or bot can exhaust the monthly API budget.

5. **Statewide expansion.** The 2026 report adds 7 new regions. The data layer in `lib/data-tools.js` is designed to be region-agnostic — filters can be applied to any field including a `region` field once the statewide dataset is ready. The system prompt will need a region-awareness section.

6. **Cross-cut starter questions.** The data is row-level, so any field can be filtered against any other. Several high-value cross-cuts are confirmed to work at sufficient sample size and should be added as featured starter questions or a "deeper analysis" shelf in the UI:
   - Revenue 2024 × founder gender (n=82) — female founders cluster at $0-$50K (56%); the entire upper revenue tail ($7.5M+) is male-founded. Strong finding.
   - FT employees × industry (n=68) — Software and Healthcare show widest distributions; most industries cluster at 1-3 FT.
   - AI impact × industry (n=93) — shows which sectors are actually integrating vs. talking about it.
   - `plan_to_raise` × revenue bracket — are growth-seeking companies larger, or are smaller companies the ones seeking capital?
   - `has_exit_strategy` × funding rounds — are venture-backed companies planning exits, or is that disconnected in this cohort?
   - Revenue trajectory (2020-2024) × workspace type (n=77 with both years) — do leased commercial companies grow differently than home-based?
   - `plan_to_raise` × founder gender — 46% of male founders plan to raise vs. 18% of female founders. Significant disparity.
   All of these are queryable via existing tools right now. The system prompt and starter questions just need to surface them.

7. **"High growth" proxy.** The published report's 40/60 high-growth/small-business split is not derivable from the dataset (it was editorial, not a survey field). For queries that reference "high growth companies," the system prompt should be updated to suggest available proxies: `plan_to_raise = Yes`, `funding_rounds` is populated, `has_exit_strategy = Yes`, or revenue trajectory across 2020-2024. Currently Claude has no instruction on how to handle this.

8. **Auth.** Currently no authentication. The terms gate + query limit is the only friction. For the statewide report or for the data request workflow, consider adding a lightweight email-based auth (magic link) to prevent abuse and enable usage tracking.
