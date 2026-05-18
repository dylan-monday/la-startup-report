/**
 * Analytics store — LA Startup Report chatbot
 *
 * MVP: module-level store, pre-seeded with 30 days of realistic data.
 * Within a warm serverless instance, live events accumulate here.
 *
 * Production upgrade path: swap trackSession() and getAnalytics() for
 * Vercel KV or Supabase calls. The API surface stays identical.
 */

// Claude Sonnet pricing (as of 2025)
const COST_INPUT  = 3.00  / 1_000_000; // $3.00 per million input tokens
const COST_OUTPUT = 15.00 / 1_000_000; // $15.00 per million output tokens

export const calculateCost = (input, output) =>
  input * COST_INPUT + output * COST_OUTPUT;

// ── Seed data ─────────────────────────────────────────────────────────────────

const TOOLS = [
  "count_respondents",
  "get_distribution",
  "cross_tabulate",
  "get_numeric_stats",
  "analyze_funding_gaps",
  "get_revenue_trajectory",
  "get_dataset_summary",
  "list_available_fields",
];

function rnd(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSeed() {
  const events = [];
  const now = Date.now();

  for (let daysAgo = 29; daysAgo >= 1; daysAgo--) {
    // Organic growth curve: sparse early, building toward present
    const base = 2 + Math.round((29 - daysAgo) * 0.85);
    const count = Math.max(0, base + rnd(-2, 2));

    // Drop some days in the first two weeks (before word spread)
    if (daysAgo > 18 && Math.random() < 0.4) continue;

    for (let i = 0; i < count; i++) {
      const ts = new Date(now - daysAgo * 86_400_000);
      ts.setHours(rnd(8, 19), rnd(0, 59), rnd(0, 59));

      const queryCount  = rnd(2, 8);
      const inputTokens  = queryCount * rnd(380, 720);
      const outputTokens = queryCount * rnd(260, 540);

      events.push({
        sessionId:    `seed-${daysAgo}-${i}`,
        timestamp:    ts.toISOString(),
        queryCount,
        inputTokens,
        outputTokens,
        toolsUsed:    Array.from({ length: queryCount }, () => pick(TOOLS)),
        cost:         calculateCost(inputTokens, outputTokens),
        live:         false,
      });
    }
  }

  return events;
}

// Module-level store — persists across requests in a warm serverless instance
const store = { events: buildSeed() };

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Call from /api/chat once a session completes successfully.
 *
 * @param {object} opts
 * @param {string}   opts.sessionId
 * @param {number}   opts.queryCount     — number of user turns in this session
 * @param {number}   opts.inputTokens    — cumulative input tokens across all API calls
 * @param {number}   opts.outputTokens   — cumulative output tokens across all API calls
 * @param {string[]} opts.toolsUsed      — tool names called, in order
 */
export function trackSession({ sessionId, queryCount, inputTokens, outputTokens, toolsUsed = [] }) {
  store.events.push({
    sessionId,
    timestamp:    new Date().toISOString(),
    queryCount,
    inputTokens,
    outputTokens,
    toolsUsed,
    cost:         calculateCost(inputTokens, outputTokens),
    live:         true,
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns aggregated analytics for the admin dashboard.
 *
 * @param {number} days — rolling window (default 30)
 */
export function getAnalytics(days = 30) {
  const cutoff = Date.now() - days * 86_400_000;
  const window = store.events.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoff
  );

  // Daily rollup
  const byDay = {};
  for (const e of window) {
    const key = e.timestamp.slice(0, 10);
    if (!byDay[key]) {
      byDay[key] = { date: key, chats: 0, inputTokens: 0, outputTokens: 0, cost: 0, queries: 0 };
    }
    byDay[key].chats++;
    byDay[key].inputTokens  += e.inputTokens;
    byDay[key].outputTokens += e.outputTokens;
    byDay[key].cost         += e.cost;
    byDay[key].queries      += e.queryCount;
  }

  // Fill every calendar day so the chart has no gaps
  const dailyData = [];
  for (let d = days - 1; d >= 0; d--) {
    const dt  = new Date(Date.now() - d * 86_400_000);
    const key = dt.toISOString().slice(0, 10);
    const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyData.push({
      label,
      ...(byDay[key] || { date: key, chats: 0, inputTokens: 0, outputTokens: 0, cost: 0, queries: 0 }),
    });
  }

  // Tool usage totals
  const toolCounts = {};
  for (const e of window) {
    for (const t of e.toolsUsed) {
      toolCounts[t] = (toolCounts[t] || 0) + 1;
    }
  }

  // Totals — all sessions in window
  const totals = window.reduce(
    (acc, e) => ({
      chats:        acc.chats + 1,
      queries:      acc.queries + e.queryCount,
      inputTokens:  acc.inputTokens + e.inputTokens,
      outputTokens: acc.outputTokens + e.outputTokens,
      cost:         acc.cost + e.cost,
    }),
    { chats: 0, queries: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
  );

  // Recent sessions (newest first)
  const recent = [...store.events]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 15);

  return { dailyData, toolCounts, totals, recent };
}
