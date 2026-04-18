"use client";

import { useState, useEffect, useCallback } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

function fmtCost(n) {
  if (n >= 100) return "$" + Math.round(n).toLocaleString();
  return "$" + n.toFixed(2);
}

function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  indigoBg:    "#f8f8ff",
  indigoSoft:  "#ebebf8",
  indigoMid:   "#8282b6",
  indigo:      "#565698",
  indigoDeep:  "#3a3a78",
  navy:        "#1e1e4a",
  text:        "#363636",
  textMid:     "#6b6b8a",
  amberMid:    "#c8a460",
  amber:       "#a07c30",
  greenMid:    "#76aa7a",
  green:       "#48854c",
  white:       "#ffffff",
  border:      "#ebebf8",
  rowAlt:      "#f4f4fb",
};

const MONO  = "'JetBrains Mono', 'Courier New', monospace";
const AKTIV = "var(--font-aktiv), 'Helvetica Neue', Arial, sans-serif";

// ── SVG line chart ────────────────────────────────────────────────────────────

function LineChart({ series, labels, height = 160 }) {
  if (!series?.length || !labels?.length) return null;

  const W = 600, H = height;
  const pad = { t: 18, r: 12, b: 30, l: 48 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const allVals = series.flatMap((s) => s.values);
  const maxVal  = Math.max(...allVals, 1);

  function pts(values) {
    return values.map((v, i) => ({
      x: pad.l + (i / Math.max(values.length - 1, 1)) * pw,
      y: pad.t + ph - (v / maxVal) * ph,
    }));
  }

  function bezier(points) {
    if (!points.length) return "";
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1], p1 = points[i];
      const cx1 = (p0.x + (p1.x - p0.x) * 0.4).toFixed(1);
      const cx2 = (p0.x + (p1.x - p0.x) * 0.6).toFixed(1);
      d += ` C ${cx1} ${p0.y.toFixed(1)} ${cx2} ${p1.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  }

  const yTicks   = [0, Math.round(maxVal / 2), maxVal];
  const baseline = pad.t + ph;
  const step     = Math.max(1, Math.ceil(labels.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {/* Horizontal grid */}
      {yTicks.map((tick, i) => {
        const y = pad.t + ph - (tick / maxVal) * ph;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke={C.indigoSoft} strokeWidth="1" />
            <text
              x={pad.l - 6} y={y + 4}
              textAnchor="end" fontSize="11"
              fontFamily={MONO} fill={C.textMid}
            >
              {tick >= 1000 ? fmtNum(tick) : tick}
            </text>
          </g>
        );
      })}

      {/* Series (area + line) */}
      {series.map((s, si) => {
        const points  = pts(s.values);
        const linePath = bezier(points);
        const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;
        return (
          <g key={si}>
            <path d={areaPath} fill={s.color} opacity={si === 0 ? 0.1 : 0.05} />
            <path d={linePath} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinecap="round" />
          </g>
        );
      })}

      {/* X-axis labels */}
      {labels.map((label, i) => {
        if (i % step !== 0 && i !== labels.length - 1) return null;
        const x = pad.l + (i / Math.max(labels.length - 1, 1)) * pw;
        return (
          <text
            key={i}
            x={x.toFixed(1)} y={H - 5}
            textAnchor="middle" fontSize="10"
            fontFamily={MONO} fill={C.textMid}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }) {
  const [pwd, setPwd]     = useState("");
  const [shake, setShake] = useState(false);

  function submit(e) {
    e.preventDefault();
    const correct = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "louisiana";
    if (pwd === correct) {
      sessionStorage.setItem("la-admin-auth", "ok");
      onAuth();
    } else {
      setShake(true);
      setPwd("");
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.navy,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: MONO, fontSize: "11px", letterSpacing: "0.14em",
          color: C.indigoMid, textTransform: "uppercase", marginBottom: "40px",
        }}>
          Louisiana Startup Report · Admin
        </div>

        <form onSubmit={submit}>
          <div style={{ animation: shake ? "shake 0.45s ease" : "none" }}>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Password"
              autoFocus
              style={{
                display: "block", width: "260px", padding: "13px 16px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(130,130,182,0.35)",
                color: "#fff", fontFamily: MONO, fontSize: "14px",
                outline: "none", marginBottom: "10px",
                letterSpacing: "0.06em",
              }}
            />
            <button type="submit" style={{
              width: "100%", padding: "13px",
              background: C.indigo, border: "none",
              color: "#fff", fontFamily: AKTIV,
              fontWeight: 300, fontSize: "13px",
              letterSpacing: "0.1em", cursor: "pointer",
              textTransform: "uppercase",
            }}>
              Enter
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          60%       { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

// ── Tool labels ───────────────────────────────────────────────────────────────

const TOOL_LABELS = {
  count_respondents:    "Count respondents",
  get_distribution:     "Distribution",
  cross_tabulate:       "Cross-tabulation",
  get_numeric_stats:    "Numeric stats",
  analyze_funding_gaps: "Funding gap",
  get_revenue_trajectory: "Revenue trajectory",
  get_dataset_summary:  "Dataset summary",
  list_available_fields:"Field listing",
};

// ── LED regions (dataset coverage) ───────────────────────────────────────────

const LED_REGIONS = [
  { name: "Greater New Orleans",  n: 112, active: true  },
  { name: "Capital Region",       n: 0,   active: false },
  { name: "Acadiana",             n: 0,   active: false },
  { name: "Central Louisiana",    n: 0,   active: false },
  { name: "Northwest Louisiana",  n: 0,   active: false },
  { name: "North Delta",          n: 0,   active: false },
  { name: "Southwest Louisiana",  n: 0,   active: false },
  { name: "Northshore",           n: 0,   active: false },
];

// ── Shared card wrapper ───────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      padding: "28px 30px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardLabel({ children, sub }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{
        fontFamily: AKTIV, fontSize: "11px", fontWeight: 300,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: C.textMid, marginBottom: sub ? "4px" : 0,
      }}>
        {children}
      </div>
      {sub && (
        <div style={{ fontFamily: MONO, fontSize: "11px", color: C.textMid }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed,  setAuthed]  = useState(false);
  const [data,    setData]    = useState(null);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);

  // Check session auth on mount
  useEffect(() => {
    if (typeof window !== "undefined" &&
        sessionStorage.getItem("la-admin-auth") === "ok") {
      setAuthed(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      setData(await res.json());
    } catch (_) {}
    setLoading(false);
  }, [days]);

  // Fetch on auth + day change
  useEffect(() => {
    if (authed) { setLoading(true); fetchData(); }
  }, [authed, fetchData]);

  // Auto-refresh every 30 s
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [authed, fetchData]);

  if (!authed) {
    return (
      <PasswordGate
        onAuth={() => { setAuthed(true); }}
      />
    );
  }

  const { totals, dailyData, toolCounts, recent } = data || {};
  const totalTokens = (totals?.inputTokens || 0) + (totals?.outputTokens || 0);
  const avgQueriesPerChat = totals?.chats
    ? (totals.queries / totals.chats).toFixed(1)
    : "—";

  return (
    <div style={{ minHeight: "100vh", background: C.indigoBg }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: C.navy,
        height: "58px",
        padding: "0 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <span style={{
            fontFamily: MONO, fontSize: "10px",
            letterSpacing: "0.16em", color: C.indigoMid,
            textTransform: "uppercase",
          }}>
            Admin
          </span>
          <span style={{ width: 1, height: 14, background: "rgba(130,130,182,0.3)" }} />
          <span style={{
            fontFamily: AKTIV, fontSize: "13px",
            fontWeight: 300, color: "rgba(255,255,255,0.6)",
          }}>
            Louisiana Startup Report
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Day range selector */}
          <div style={{ display: "flex", border: "1px solid rgba(130,130,182,0.3)", overflow: "hidden" }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  padding: "5px 14px", border: "none", cursor: "pointer",
                  background: days === d ? C.indigo : "transparent",
                  color: days === d ? "#fff" : "rgba(255,255,255,0.45)",
                  fontFamily: MONO, fontSize: "11px",
                  transition: "background 0.15s",
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Live badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontFamily: MONO, fontSize: "11px", color: C.green,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: C.green, display: "inline-block",
            }} />
            live
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1260, margin: "0 auto", padding: "36px 40px 60px" }}>

        {loading && (
          <div style={{
            textAlign: "center", padding: "100px 0",
            fontFamily: MONO, fontSize: "12px", color: C.textMid,
          }}>
            Loading...
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Stat cards ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              {[
                {
                  label: "Conversations",
                  value: fmtNum(totals.chats),
                  sub: `${days}-day window`,
                  color: C.indigo,
                },
                {
                  label: "Total queries",
                  value: fmtNum(totals.queries),
                  sub: `${avgQueriesPerChat} avg per session`,
                  color: C.indigo,
                },
                {
                  label: "Tokens consumed",
                  value: fmtNum(totalTokens),
                  sub: `${fmtNum(totals.inputTokens)} in · ${fmtNum(totals.outputTokens)} out`,
                  color: C.indigoDeep,
                },
                {
                  label: "API cost",
                  value: fmtCost(totals.cost),
                  sub: `${fmtCost(totals.chats ? totals.cost / totals.chats : 0)} per conversation`,
                  color: C.amber,
                },
              ].map(({ label, value, sub, color }) => (
                <Card key={label} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: AKTIV, fontSize: "11px", fontWeight: 300,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: C.textMid, marginBottom: "10px",
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: "28px",
                    color, fontWeight: 400, lineHeight: 1,
                  }}>
                    {value}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: "11px",
                    color: C.textMid, marginTop: "8px",
                  }}>
                    {sub}
                  </div>
                </Card>
              ))}
            </div>

            {/* ── Row 2: conversations + tool usage ─────────────────────── */}
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>

              {/* Conversations over time */}
              <Card style={{ flex: 2 }}>
                <CardLabel sub={`${days}-day trend`}>Conversations</CardLabel>
                <LineChart
                  series={[{ values: dailyData.map((d) => d.chats), color: C.indigo }]}
                  labels={dailyData.map((d) => d.label)}
                  height={170}
                />
              </Card>

              {/* Tool usage */}
              <Card style={{ flex: 1 }}>
                <CardLabel sub="Calls per tool">Tool usage</CardLabel>
                {Object.keys(toolCounts).length === 0 ? (
                  <div style={{ fontFamily: MONO, fontSize: "12px", color: C.textMid }}>
                    No data yet
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                    {Object.entries(toolCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([tool, count]) => {
                        const maxCount = Math.max(...Object.values(toolCounts));
                        return (
                          <div key={tool}>
                            <div style={{
                              display: "flex", justifyContent: "space-between",
                              marginBottom: 5,
                            }}>
                              <span style={{
                                fontFamily: AKTIV, fontSize: "12px",
                                fontWeight: 300, color: C.text,
                              }}>
                                {TOOL_LABELS[tool] || tool}
                              </span>
                              <span style={{
                                fontFamily: MONO, fontSize: "11px", color: C.textMid,
                              }}>
                                {count}
                              </span>
                            </div>
                            <div style={{ height: 4, background: C.indigoSoft, borderRadius: 1 }}>
                              <div style={{
                                height: "100%",
                                width: `${(count / maxCount) * 100}%`,
                                background: C.indigo,
                                borderRadius: 1,
                                transition: "width 0.5s ease",
                              }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Row 3: token consumption + dataset coverage ────────────── */}
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>

              {/* Token consumption (dual line) */}
              <Card style={{ flex: 1 }}>
                <CardLabel>Token consumption</CardLabel>
                <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
                  {[
                    { label: "Input",  color: C.indigo    },
                    { label: "Output", color: C.indigoMid },
                  ].map(({ label, color }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      fontFamily: MONO, fontSize: "11px", color,
                    }}>
                      <span style={{
                        display: "inline-block", width: 16, height: 2,
                        background: color, borderRadius: 1,
                      }} />
                      {label}
                    </div>
                  ))}
                </div>
                <LineChart
                  series={[
                    { values: dailyData.map((d) => d.inputTokens),  color: C.indigo    },
                    { values: dailyData.map((d) => d.outputTokens), color: C.indigoMid },
                  ]}
                  labels={dailyData.map((d) => d.label)}
                  height={140}
                />
              </Card>

              {/* Dataset coverage */}
              <Card style={{ flex: 1 }}>
                <CardLabel sub="LED regions · 2025 baseline">Dataset coverage</CardLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {LED_REGIONS.map((region) => (
                    <div key={region.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        flex: 1, fontFamily: AKTIV, fontSize: "12px", fontWeight: 300,
                        color: region.active ? C.text : "#b0b0c8",
                      }}>
                        {region.name}
                      </div>
                      <div style={{
                        width: 110, height: 4,
                        background: C.indigoSoft, borderRadius: 1, flexShrink: 0,
                      }}>
                        <div style={{
                          height: "100%",
                          width: region.active ? "100%" : "0%",
                          background: region.active ? C.amber : C.indigoSoft,
                          borderRadius: 1,
                        }} />
                      </div>
                      <div style={{
                        fontFamily: MONO, fontSize: "11px",
                        color: region.active ? C.amber : "#b0b0c8",
                        width: 52, textAlign: "right", flexShrink: 0,
                      }}>
                        {region.active ? `n=${region.n}` : "2026"}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 18, paddingTop: 14,
                  borderTop: `1px solid ${C.border}`,
                  fontFamily: AKTIV, fontSize: "11px", fontWeight: 300,
                  color: C.textMid, lineHeight: 1.65,
                }}>
                  Current dataset covers Greater New Orleans only. Statewide
                  expansion planned for the 2026 survey cycle.
                </div>
              </Card>
            </div>

            {/* ── Recent sessions ────────────────────────────────────────── */}
            <Card>
              <CardLabel>Recent sessions</CardLabel>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {[
                      "Session", "Time", "Queries",
                      "Input tokens", "Output tokens", "Cost", "Type",
                    ].map((h) => (
                      <th key={h} style={{
                        padding: "0 18px 11px 0",
                        textAlign: "left",
                        fontFamily: MONO, fontSize: "10px",
                        letterSpacing: "0.07em", color: C.textMid,
                        fontWeight: 400, textTransform: "uppercase",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s, idx) => (
                    <tr
                      key={s.sessionId}
                      style={{ background: idx % 2 === 0 ? C.white : C.rowAlt }}
                    >
                      <td style={{ padding: "11px 18px 11px 0", fontFamily: MONO, fontSize: "11px", color: C.textMid }}>
                        {s.sessionId.slice(0, 14)}
                      </td>
                      <td style={{ padding: "11px 18px 11px 0", fontFamily: MONO, fontSize: "11px", color: C.textMid }}>
                        {relTime(s.timestamp)}
                      </td>
                      <td style={{ padding: "11px 18px 11px 0", fontFamily: MONO, fontSize: "11px", color: C.text }}>
                        {s.queryCount}
                      </td>
                      <td style={{ padding: "11px 18px 11px 0", fontFamily: MONO, fontSize: "11px", color: C.text }}>
                        {fmtNum(s.inputTokens)}
                      </td>
                      <td style={{ padding: "11px 18px 11px 0", fontFamily: MONO, fontSize: "11px", color: C.text }}>
                        {fmtNum(s.outputTokens)}
                      </td>
                      <td style={{ padding: "11px 18px 11px 0", fontFamily: MONO, fontSize: "11px", color: C.amber }}>
                        {fmtCost(s.cost)}
                      </td>
                      <td style={{ padding: "11px 18px 11px 0" }}>
                        <span style={{
                          fontFamily: MONO, fontSize: "10px",
                          letterSpacing: "0.06em",
                          color: s.live ? C.green : C.textMid,
                          textTransform: "uppercase",
                        }}>
                          {s.live ? "live" : "seed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div style={{
              marginTop: 32, paddingTop: 20,
              borderTop: `1px solid ${C.border}`,
              fontFamily: MONO, fontSize: "10px", color: C.textMid,
              display: "flex", justifyContent: "space-between",
            }}>
              <span>Louisiana Startup Report · Admin · {new Date().getFullYear()}</span>
              <span>Refreshes every 30s · Seed data pre-loaded for demo</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
