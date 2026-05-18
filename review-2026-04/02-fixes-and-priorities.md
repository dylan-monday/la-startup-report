# Fixes, Recommendations & Priority Plan

Answers to the owner's questions, model selection rationale, and the prioritized fix list with time estimates and code-level guidance. Paired with `01-audit-findings.md` (technical detail) and `03-proposal-inputs.md` (dollar figures).

---

## Status confirmations (as of 2026-04-20)

| Item | Status |
|---|---|
| `ANTHROPIC_API_KEY` rotated | Done. Rotate again before public launch; quarterly cadence after. |
| Anthropic monthly spend cap | Set at $100. Correct temporary ceiling. Raise to $1,500 after Phase 1-3 ships. |
| Admin password in code | To be removed as part of Phase 1. Already changed in env vars, but no longer used. |

---

## Q&A — owner's eight questions, with concrete fixes

### Q1. Is the $100 spend limit set correctly?

Yes. Also set email alerts at 25% / 50% / 75% in Anthropic Console → Settings → Usage notifications. This gives you the "wake me up" signal before the hard cap trips.

After Phases 1-3 ship (rate limiting + caching + auth), raise the limit to $1,500/month to match the projected launch-scale spend (~$750-$1,000) with headroom. Keep Anthropic-side cap as the final safety net; rely on application-level circuit breakers for normal throttling.

---

### Q2. Remove the admin password from code

Delete these sections from `app/admin/page.js`:

- `PasswordGate` component (around lines 261-298)
- The `authed` state and conditional render in the main export (around lines 489-494)
- Any `sessionStorage.setItem("la-admin-auth", ...)` / `removeItem` calls

Real auth comes in Phase 4 (Supabase Auth). In the interim, if you want *any* gate, use Vercel's built-in Deployment Protection (Pro feature) which password-protects the deployment at the platform level. Zero code change.

**Time:** 15 min. **Cost:** $0.

---

### Q3. How to fix / strengthen k-anonymity

This is the highest-impact engineering work in the plan. Current state: `MIN_CELL_SIZE=10` is enforced in 1 of 8 tools. Fix makes it universal.

**Step A — central helpers in `lib/data-tools.js`:**

```js
const MIN_CELL_SIZE = 10;
const SENSITIVE_FIELDS = ["zip_code"];
const MAX_FILTER_DEPTH = 2;

function suppressed(reason) {
  return { suppressed: true, reason, min_cell_size: MIN_CELL_SIZE };
}

function gateFilters(filters) {
  if (!filters) return null;
  if (Object.keys(filters).length > MAX_FILTER_DEPTH) {
    return suppressed(`Too many filters — max ${MAX_FILTER_DEPTH} on sensitive queries`);
  }
  for (const key of Object.keys(filters)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      return suppressed(`${key} is not queryable — too identifying`);
    }
  }
  return null;
}

function gateResult(filtered, filters) {
  const gate = gateFilters(filters);
  if (gate) return gate;
  if (filtered.length < MIN_CELL_SIZE && Object.keys(filters || {}).length > 0) {
    return suppressed(`Fewer than ${MIN_CELL_SIZE} respondents match`);
  }
  return null;
}
```

**Step B — apply at top of every case in `executeTool`:**

```js
case "count_respondents": {
  const filtered = applyFilters(respondents, input.filters);
  const gate = gateResult(filtered, input.filters);
  if (gate) return gate;
  return { count: filtered.length, total: respondents.length };
}
```

Apply to: `count_respondents`, `get_distribution`, `get_numeric_stats`, `get_revenue_trajectory`, `analyze_funding_gaps`. (`cross_tabulate` already has cell-level suppression but add top-level gate too.)

**Step C — bucket-level floor in distributions:**

```js
// get_distribution
const sortedSafe = sorted.filter(([, c]) => c >= MIN_CELL_SIZE);
const suppressedBuckets = sorted.length - sortedSafe.length;
return {
  field: input.field,
  distribution: sortedSafe,
  suppressed_bucket_count: suppressedBuckets,
  total_responding: sortedSafe.reduce((s, [, c]) => s + c, 0),
};
```

Same pattern in `get_revenue_trajectory` and `analyze_funding_gaps` per-year / per-source buckets.

**Step D — remove leakiest fields:**

- From `FIELD_INFO`: delete `zip_code` entry. It stays in the underlying JSON for internal use but is invisible to the model.
- From dataset + `FIELD_INFO`: delete `industry_other_text`. Free-text niche descriptors are a direct re-ID vector.
- In `get_numeric_stats`: when `vals.length < MIN_CELL_SIZE`, return only `{count, message: "suppressed"}`. Never return raw `min`/`max` at any sample size below the floor.

**Step E — per-conversation narrowing budget (stronger defense):**

Requires Upstash Redis from Phase 5. Skip for MVP; add for launch.

```js
// In /api/chat route, between tool calls:
const signature = JSON.stringify({
  tool: toolUse.name,
  field: toolUse.input.field,
  filters: Object.keys(toolUse.input.filters || {}).sort()
});
const count = await redis.sadd(`narrow:${sessionId}`, signature);
await redis.expire(`narrow:${sessionId}`, 3600);
if (count > 15) {
  result = { error: "Too many distinct narrowing queries in this conversation" };
}
```

Catches differencing-attack probes.

**Time:** 4-6 hr for A-D, +2-3 hr for E. **Cost:** $0 (E requires Redis which is free tier).

**Before statewide data:** raise `MIN_CELL_SIZE` from 10 to 15-20. Rare combinations stay rare even with more rows; recalibrate on real data. Consider Laplace noise (ε≈1) on all returned counts for defense-in-depth.

---

### Q4. Fake data — move to live data when budget is approved

Current behavior: `buildSeed()` in `lib/analytics.js:38-72` injects 30 days of fake sessions on every cold start. Mixed with real data in the store.

**Fix for now (gate seed behind env var):**

```js
// lib/analytics.js
const SEED_ENABLED = process.env.SEED_ANALYTICS === "true";
const store = { events: SEED_ENABLED ? buildSeed() : [] };
```

Set `SEED_ANALYTICS=true` in `.env.local` for local development. Omit from Vercel production environment. Dashboard starts empty in production, fills with real data as users arrive.

Once persistent analytics is wired up (Phase 5, uses Upstash or Supabase), delete `buildSeed()` entirely.

**Time:** 15 min now; 30 min to fully remove after Phase 5. **Cost:** $0.

---

### Q5. Data-request endpoint — fix before Resend budget

Resend has a **free tier**: 3,000 emails/month, 100/day. Works at MVP and small-launch scale for $0. Turn it on now.

**Step A — sign up at resend.com, add domain, get API key, set `RESEND_API_KEY` in Vercel env.**

**Step B — uncomment the Resend block in `app/api/data-request/route.js` and add spam protection:**

```js
export async function POST(req) {
  // Origin check (shared with Q8 fix)
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, company, use_case, website /* honeypot */ } = body;

  // Honeypot — bots fill every field, humans don't see this one
  if (website && website.length > 0) {
    return Response.json({ ok: true }); // silent drop
  }

  // Validation
  if (!name || name.length > 100) return bad("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") || email.length > 200) return bad("email");
  if (!company || company.length > 200) return bad("company");
  if (!use_case || use_case.length > 2000) return bad("use_case");

  // Strip CR/LF before interpolation (header-injection defense)
  const safe = (s) => String(s).replace(/[\r\n]/g, " ").slice(0, 2000);

  // Rate limit (once Phase 5 ships Upstash)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  // const { success } = await ratelimit.limit(`data-req:${ip}`);
  // if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });

  // Send email
  await resend.emails.send({
    from: "LA Report <noreply@yourdomain.com>",
    to: ["lepage@tulane.edu"], // verify recipient with M+P
    replyTo: safe(email),
    subject: `Data request from ${safe(name)} @ ${safe(company)}`,
    text: [
      `Name: ${safe(name)}`,
      `Email: ${safe(email)}`,
      `Company: ${safe(company)}`,
      `Use case: ${safe(use_case)}`
    ].join("\n"),
  });

  // Audit log (once Upstash is available, else skip)
  // await redis.lpush("data-requests", JSON.stringify({ ts: Date.now(), ip, ...body }));

  // REMOVE: console.log("[data-request]", ...) — PII in logs

  return Response.json({ ok: true });
}

function bad(field) {
  return Response.json({ error: `Invalid ${field}` }, { status: 400 });
}
```

**Step C — add honeypot field to `DataRequestModal.js`:**

```jsx
<input
  type="text"
  name="website"
  tabIndex={-1}
  autoComplete="off"
  style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
  aria-hidden="true"
/>
```

**Step D — remove the `console.log` line from the route.**

**Time:** 2-3 hr. **Cost:** $0 (Resend free tier + Upstash free tier).

---

### Q6. Turn on prompt caching — what does it take?

Three-line change, zero cost, ~25% API bill reduction.

**`app/api/chat/route.js` — modify the `messages.create` call:**

```js
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5", // upgrade from claude-sonnet-4-20250514
  max_tokens: 2048,
  temperature: 0.2,
  system: [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }
  ],
  tools: toolDefinitions.map((t, i, arr) =>
    i === arr.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t
  ),
  messages: currentMessages,
});
```

**Verification:** Log `response.usage` after each call. On the 2nd+ call within a 5-minute window:
- `cache_read_input_tokens` should be ~1,900 (system + tools)
- `cache_creation_input_tokens` should be 0 (cache hit)

Monitor for 10 real conversations. If `cache_read_input_tokens / (cache_read + input_tokens) > 0.8`, caching is working.

**Requirements:**
- Anthropic SDK ≥0.27 — currently on 0.39, fine
- Server/runtime: Node.js (already the default for `/api/chat`)
- No other service required

**Time:** 1 hr including verification. **Cost:** $0. **Savings:** ~$250/month at launch scale.

---

### Q7. Best model at best price — recommendation

**Primary recommendation: Claude Sonnet 4.6** (API ID `claude-sonnet-4-5`). No fallback tier.

Honest breakdown:

| Model | Price (per M tokens) | Fit for this chatbot | Recommendation |
|---|---|---|---|
| **Haiku 4.5** | in $1 / out $5 | Fast, cheap. Tool-use reliability drops ~15-20% on chained calls. More injection-susceptible. Style-constraint adherence (no em dashes, banned phrases in your system prompt) is less consistent. At launch scale would save ~$500/month vs Sonnet. | **Not for launch, but worth a one-hour evaluation** — see below. If it passes your eval, switch and save. |
| **Sonnet 4.6** ⭐ | in $3 / out $15 | Reliably picks right tool, chains 2-5 calls, honors style rules consistently, refuses off-topic well. Same price tier as the dated Sonnet 4 you're on — free upgrade. | **Use this.** |
| **Opus 4.7** | in $15 / out $75 | 5× Sonnet cost. Marginal gains on bounded analytical queries like yours. Wins on open-ended creative reasoning — not your task. | No. |

**Why Sonnet is the defensible pick:**

Your chatbot has four characteristics that favor Sonnet over Haiku:

1. **Tool chaining** — up to 10 iterations in the loop, typically 2-5 tool calls per turn. Haiku degrades measurably on chains; Sonnet is rock-solid.
2. **Style constraints** — system prompt forbids em dashes and specific phrases ("Great question!", "deep dive", "leverage" as verb). Sonnet honors these consistently; Haiku misses ~10% of the time.
3. **Refusal quality** — public-facing chatbot for a university-affiliated publication. One "prompt injection succeeds and bot says something inappropriate" screenshot damages the partnership. Sonnet's refusals are meaningfully better.
4. **Fabrication resistance** — "never cite numbers not from tool results" rule. Sonnet adheres reliably; Haiku occasionally fabricates when it can't figure out which tool to call.

**But — your tasks ARE relatively simple.** Bounded aggregation queries over a small dataset. It's plausible Haiku 4.5 performs acceptably. I recommend you run a 1-hour eval before launch:

**Haiku evaluation protocol:**
1. Collect 20 representative user questions covering: simple lookups, multi-filter queries, revenue comparisons, distribution asks, explicitly off-topic questions, prompt-injection attempts, edge-case phrasings.
2. Run all 20 through both Sonnet 4.6 and Haiku 4.5 with identical system prompt + tools.
3. Score each response on: tool-call correctness (right tool? right filters?), answer accuracy (numbers from tools?), style compliance (no em dashes, no banned phrases?), refusal quality.
4. If Haiku scores ≥95% of Sonnet's total: switch to Haiku. Savings ~$500/month.
5. If <95%: stick with Sonnet.

**Cost to run the eval:** ~$5 in API calls. Time: 2 hours.

Anthropic's `@anthropic-ai/sdk` supports batch requests which makes this easy. I can help set it up when you're ready.

**Production recommendation:** Ship with Sonnet 4.6 + prompt caching. Run Haiku eval in parallel with Phase 2 work. Make the final model call before public launch.

---

### Q8. CSRF / origin / body-size fix

Paste at the top of both `/api/chat` and `/api/data-request` POST handlers:

```js
const ALLOWED_ORIGINS = [
  "https://your-production-domain.com",
  "https://your-preview-subdomain.vercel.app",
  "http://localhost:3000",
];

export async function POST(req) {
  // 1. Origin/Referer check (CSRF + CORS combined)
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (!ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Body size cap (1MB max)
  const contentLength = parseInt(req.headers.get("content-length") || "0");
  if (contentLength > 1_000_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  const body = await req.json();

  // 3. Shape validation — for /api/chat
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 32) {
    return Response.json({ error: "Invalid messages" }, { status: 400 });
  }
  for (const m of body.messages) {
    if (!["user", "assistant"].includes(m.role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }
    if (typeof m.content !== "string" || m.content.length > 8000) {
      return Response.json({ error: "Content too large" }, { status: 400 });
    }
  }

  // ... existing handler logic
}
```

**Time:** 1 hr total (both endpoints). **Cost:** $0.

---

## Priority plan — complete fix list

Ordered highest priority (launch blockers) to lowest. Time estimates assume a developer familiar with the codebase; double if onboarding a new contributor.

### Phase 1 — Emergency launch prep (can ship same day)

**Goal:** Make the project safe to share with a small group (10-50 people) for initial testing. Zero recurring cost.

| # | Task | File(s) | Time | Cost |
|---|---|---|---|---|
| 1 | Remove admin password fallback + client-side gate | `app/admin/page.js` | 15 min | $0 |
| 2 | Enable prompt caching + upgrade model to Sonnet 4.6 | `app/api/chat/route.js` | 1 hr | $0 |
| 3 | Add `temperature: 0.2`, `maxRetries: 3`, try/catch around `executeTool`, handle `req.signal` | `app/api/chat/route.js` | 1 hr | $0 |
| 4 | Origin + body-size + shape validation on POST endpoints | `app/api/chat/route.js`, `app/api/data-request/route.js` | 1 hr | $0 |
| 5 | Reduce `MAX_ITERATIONS` to 5, raise `maxDuration` to 120, align client abort timeout | `app/api/chat/route.js`, `ChatDrawer.js` | 30 min | $0 |

**Phase 1 total: ~4 hours, $0.**

---

### Phase 2 — Privacy + abuse resistance (launch prerequisites)

**Goal:** Safe to share publicly. Free-tier services only.

| # | Task | Dependency | Time | Cost |
|---|---|---|---|---|
| 6 | Upstash Redis signup + `@upstash/ratelimit` on `/api/chat` (10/min, 200/day per IP) | Upstash account | 3-4 hr | $0 (free tier) |
| 7 | Cloudflare Turnstile on first chat message per session | CF account | 1-2 hr | $0 |
| 8 | k-anonymity central wrapper + bucket floor + remove `zip_code` / `industry_other_text` | `lib/data-tools.js`, `data/gno-2025.json` | 4-6 hr | $0 |
| 9 | Data-request: Resend free tier + honeypot + validation + audit log | `app/api/data-request/route.js`, `DataRequestModal.js` | 2-3 hr | $0 (free tier) |
| 10 | Env-gate seed analytics data | `lib/analytics.js` | 15 min | $0 |

**Phase 2 total: ~12 hours, $0 recurring.**

---

### Phase 3 — Real auth + persistent data (requires client budget)

**Goal:** True production. Real admin auth, persistent analytics, observability.

| # | Task | Time | Monthly cost |
|---|---|---|---|
| 11 | Supabase project + Supabase Auth magic link + middleware + `admin_users` table | 6-8 hr | $25 (Supabase Pro) |
| 12 | Persistent analytics: Supabase `chat_sessions` table + Next.js `after()` for post-response writes | 4-6 hr | included |
| 13 | Per-conversation narrowing budget in Redis (k-anonymity hardening, Phase 2 §8 Step E) | 2-3 hr | included |
| 14 | Observability: Axiom structured logs + alerts on daily cost > $50, 5xx > 2%, session > 50 queries | 3-4 hr | $0-$25 |
| 15 | Rotate API key + raise Anthropic monthly cap to $1,500 | 15 min | — |

**Phase 3 total: ~16 hours, +$25-$50/month.**

---

### Phase 4 — Quality polish (launch-month work)

| # | Task | Time | Cost |
|---|---|---|---|
| 16 | Accessibility pass: aria-label, aria-live, focus trap, focus-visible, prefers-reduced-motion, Stop button | 4-6 hr | $0 |
| 17 | Frontend performance: rAF visibility gate, dynamic-import DesignPanel, next/image, font preload, dedupe JetBrains Mono load | 2-3 hr | $0 |
| 18 | Admin page split into `_components/` + `useAnalytics` hook + pagination on sessions table | 6-8 hr | $0 |
| 19 | CSP + security headers in `next.config.js` | 1 hr | $0 |
| 20 | Generic error strings to clients (M5) | 30 min | $0 |

**Phase 4 total: ~14 hours, $0.**

---

### Phase 5 — Statewide data migration

| # | Task | Time | Cost |
|---|---|---|---|
| 21 | Schema design: `respondents(id, region, year, survey_year, responses jsonb)` | 2 hr | included |
| 22 | Port `executeTool` JS filters → SQL queries; add region filter to all tools | 8-12 hr | included |
| 23 | Update system prompt with region-awareness section | 1-2 hr | included |
| 24 | Data ingestion pipeline (CSV/JSON → Postgres, with PII scrub pass) | 4-6 hr | included |
| 25 | Integration testing with statewide dataset | 4-6 hr | — |

**Phase 5 total: ~24 hours, infrastructure already in Phase 3.**

---

### Phase 6 — Optional: PDF report RAG

Only if "ask questions about the full report prose" is funded. Requires pgvector in Supabase.

| # | Task | Time | Cost |
|---|---|---|---|
| 26 | Enable pgvector extension in Supabase | 15 min | included |
| 27 | Chunking pipeline for PDF (~500-token chunks, 100-token overlap) | 4 hr | included |
| 28 | Embedding integration (voyage-3-lite or text-embedding-3-small) | 2 hr | ~$5-$10/mo |
| 29 | Add `search_report` tool to Claude loop with citations | 6-8 hr | included |
| 30 | UI affordance for source-backed answers | 4 hr | — |

**Phase 6 total: ~1-2 weeks, +$5-$20/month.**

---

### Phase 7 — Optional: Haiku evaluation

| # | Task | Time | Cost |
|---|---|---|---|
| 31 | Build 20-question eval set covering tool use, style, refusals, edge cases | 1 hr | $0 |
| 32 | Run both Sonnet and Haiku, score each | 1 hr | ~$5 |
| 33 | Decision: swap model if Haiku scores ≥95% of Sonnet | 15 min | — |

**Phase 7 total: ~2 hours, ~$5. Potential savings: ~$500/month if Haiku passes.**

---

## Aggregate launch-readiness timeline

| Block | Hours | Recurring cost |
|---|---|---|
| Phase 1 — Emergency prep | 4 | $0 |
| Phase 2 — Privacy + abuse resistance | 12 | $0 |
| Phase 3 — Auth + persistent data | 16 | $25-$50/mo |
| Phase 4 — Quality polish | 14 | $0 |
| Phase 5 — Statewide migration | 24 | included |
| Phase 7 — Haiku eval (optional) | 2 | $5 one-time |
| **Launch-ready total** | **~72 hrs** | **$25-$50/mo** |
| Phase 6 — PDF RAG (optional) | +40-80 hrs | +$5-$20/mo |

Excludes ongoing ops (monitoring, content updates, prompt tuning) — see `03-proposal-inputs.md`.

---

## Recommended sequencing for LA.io conversation

1. **Before the proposal meeting:** Ship Phase 1 (4 hrs, $0). Demonstrable improvement with no new cost.
2. **Once budget is approved:** Phases 2-3 in sequence. 28 hours + $25-$50/mo. Site goes from "demo" to "launch-safe."
3. **Launch month:** Phase 4 polish + Haiku eval. 16 hours + $0 recurring.
4. **Before statewide rollout:** Phase 5 migration. 24 hours.
5. **Phase 6 (PDF RAG):** Separate line-item in proposal — scope depending on how interactive the web report becomes.

---

## Risks to flag in the proposal

These are the five things that could hurt the launch. Surface them transparently to LA.io rather than letting them discover later.

1. **Prompt-injection "gotcha" screenshot.** Mitigation: Phase 2 work + user-facing feedback button. Residual risk: non-zero; public LLM chatbots occasionally produce embarrassing output. Recommend a published moderation/feedback policy.
2. **Runaway API spend.** Mitigated by layered caps (Anthropic workspace $1,500/mo + application circuit breaker $1,200/mo + per-IP rate limit). Residual risk: minimal.
3. **Re-identification via filter composition.** Mitigated by Phase 2 §8. Before statewide rollout, Tulane IRB/legal review of the privacy safeguards is recommended.
4. **Press-moment traffic spike.** Mitigated by Vercel Pro + Supabase connection pooling + Runtime Cache on deterministic tools. Residual risk: low.
5. **Anthropic model/pricing change.** Model ID in env var allows quick swap. Quarterly regression test on then-current Sonnet snapshot. Residual risk: low-medium.
