"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import "../globals.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

function fmtCost(n) {
  if (n === 0) return "$0.00";
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

// ── SVG line chart ────────────────────────────────────────────────────────────

function LineChart({ series, labels, height = 160 }) {
  if (!series?.length || !labels?.length) return null;

  const W = 600, H = height;
  const pad = { t: 16, r: 10, b: 28, l: 44 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const allVals = series.flatMap((s) => s.values);
  const maxVal  = Math.max(...allVals, 1);
  const baseline = pad.t + ph;

  function toPoints(values) {
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

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const step   = Math.max(1, Math.ceil(labels.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {yTicks.map((tick, i) => {
        const y = pad.t + ph - (tick / maxVal) * ph;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y}
              stroke="var(--border-light)" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 4} textAnchor="end"
              fontSize="11" fontFamily="'JetBrains Mono', monospace"
              fill="var(--text-light)">
              {tick >= 1000 ? fmtNum(tick) : tick}
            </text>
          </g>
        );
      })}

      {series.map((s, si) => {
        const points   = toPoints(s.values);
        const linePath = bezier(points);
        const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;
        return (
          <g key={si}>
            <path d={areaPath} fill={s.color} opacity={si === 0 ? 0.1 : 0.05} />
            <path d={linePath} fill="none" stroke={s.color}
              strokeWidth="1.75" strokeLinecap="round" />
          </g>
        );
      })}

      {labels.map((label, i) => {
        if (i % step !== 0 && i !== labels.length - 1) return null;
        const x = pad.l + (i / Math.max(labels.length - 1, 1)) * pw;
        return (
          <text key={i} x={x.toFixed(1)} y={H - 4}
            textAnchor="middle" fontSize="10"
            fontFamily="'JetBrains Mono', monospace"
            fill="var(--text-light)">
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
  const canvasRef         = useRef(null);

  // Crystal lattice animation — ported from v2-geodesic.html
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    function onResize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W;
      canvas.height = H;
    }
    window.addEventListener("resize", onResize);

    // 3D math helpers
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function mapR(v, a1, a2, b1, b2) { return b1 + (v - a1) / (a2 - a1) * (b2 - b1); }
    function rgba(hex, a) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }
    function rotX(p, a) {
      const c = Math.cos(a), s = Math.sin(a);
      return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    }
    function rotY(p, a) {
      const c = Math.cos(a), s = Math.sin(a);
      return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    }
    function project(pt, persp, cx, cy) {
      const z = pt[2] + persp;
      const f = persp / Math.max(z, 1);
      return [cx + pt[0] * f, cy + pt[1] * f, z];
    }
    function vLen(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }

    // Build lattice geometry once
    const GRID_N  = 5;
    const scale   = Math.min(W, H) * 0.52;
    const spacing = (scale * 2) / GRID_N;
    const nodes   = [];
    const nodeMap = {};

    for (let ix = 0; ix <= GRID_N; ix++) {
      for (let iy = 0; iy <= GRID_N; iy++) {
        for (let iz = 0; iz <= GRID_N; iz++) {
          const x = (ix - GRID_N / 2) * spacing;
          const y = (iy - GRID_N / 2) * spacing;
          const z = (iz - GRID_N / 2) * spacing;
          if (vLen([x, y, z]) <= scale * 1.08) {
            nodeMap[`${ix}_${iy}_${iz}`] = nodes.length;
            nodes.push([x, y, z]);
          }
        }
      }
    }

    const edges = [];
    for (let ix = 0; ix <= GRID_N; ix++) {
      for (let iy = 0; iy <= GRID_N; iy++) {
        for (let iz = 0; iz <= GRID_N; iz++) {
          const idx = nodeMap[`${ix}_${iy}_${iz}`];
          if (idx === undefined) continue;
          for (const [dx, dy, dz] of [[1,0,0],[0,1,0],[0,0,1]]) {
            const nidx = nodeMap[`${ix+dx}_${iy+dy}_${iz+dz}`];
            if (nidx !== undefined) edges.push([idx, nidx]);
          }
        }
      }
    }

    // Mouse tracking — normalized -1..1 offset from center
    let mouseX = 0, mouseY = 0;
    let targetMX = 0, targetMY = 0;
    function onMouseMove(e) {
      targetMX = ((e.clientX / W) - 0.5) * 2;
      targetMY = ((e.clientY / H) - 0.5) * 2;
    }
    window.addEventListener("mousemove", onMouseMove);

    // Animation loop
    let ax = 0.42, ay = 0.28;
    let raf;

    function draw() {
      // Smooth-follow mouse with lag
      mouseX += (targetMX - mouseX) * 0.04;
      mouseY += (targetMY - mouseY) * 0.04;

      // Mouse adds a subtle tilt offset on top of auto-rotation
      const rxTotal = ax + mouseY * 0.22;
      const ryTotal = ay + mouseX * 0.28;

      const persp = 1200;
      const cx = W / 2, cy = H / 2;

      ctx.fillStyle = "#03243c";
      ctx.fillRect(0, 0, W, H);

      // Edges — sort back-to-front for correct layering
      const edgeDrawList = edges.map(([ai, bi]) => {
        const a  = rotY(rotX(nodes[ai], rxTotal), ryTotal);
        const b  = rotY(rotX(nodes[bi], rxTotal), ryTotal);
        const pa = project(a, persp, cx, cy);
        const pb = project(b, persp, cx, cy);
        return { pa, pb, avgZ: (pa[2] + pb[2]) / 2 };
      });
      edgeDrawList.sort((a, b) => b.avgZ - a.avgZ);

      for (const { pa, pb, avgZ } of edgeDrawList) {
        const alpha = clamp(mapR(avgZ, persp * 0.3, persp * 2.2, 0.38, 0.03), 0, 1);
        ctx.lineWidth = clamp(mapR(avgZ, persp * 0.3, persp * 2.2, 1.1, 0.4), 0.3, 1.2);
        ctx.strokeStyle = rgba("#0c7bb3", alpha);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      }

      // Nodes
      for (const node of nodes) {
        const r  = rotY(rotX(node, rxTotal), ryTotal);
        const pr = project(r, persp, cx, cy);
        const alpha = clamp(mapR(pr[2], persp * 0.3, persp * 2.2, 0.70, 0.06), 0, 1);
        const sz = clamp(2.8 * (persp / Math.max(pr[2], 1)), 0.5, 4.5);
        ctx.fillStyle = rgba("#80d0ff", alpha);
        ctx.beginPath();
        ctx.arc(pr[0], pr[1], sz / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ax += 0.00075;
      ay += 0.00110;
      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  function submit(e) {
    e.preventDefault();
    // Live password is set via NEXT_PUBLIC_ADMIN_PASSWORD in Vercel (prototype gate
    // only — see ARCHITECTURE.md §10; this is not real auth). The fallback below is a
    // local-dev placeholder, NOT the live password.
    const correct = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "localdev-only";
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
    <div style={{ position: "relative", minHeight: "100vh", background: "#03243c", overflow: "hidden" }}>

      {/* Animated canvas background */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%", height: "100%",
          display: "block",
        }}
      />

      {/* Centered content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>

        {/* LA.IO logo */}
        <div style={{ marginBottom: 40 }}>
          <img
            src="/images/laio-logo.svg"
            alt="LA.io"
            style={{
              height: 26,
              width: "auto",
              display: "block",
              opacity: 0.55,
              filter: "brightness(10)",
            }}
          />
        </div>

        {/* Label */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          letterSpacing: "2.5px",
          textTransform: "uppercase",
          color: "rgba(122,154,170,0.65)",
          marginBottom: 36,
        }}>
          Louisiana Startup Report · Admin
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ width: 280 }}>
          <div style={{ animation: shake ? "shake 0.45s ease" : "none" }}>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Password"
              autoFocus
              style={{
                display: "block",
                width: "100%",
                padding: "13px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(12,123,179,0.25)",
                color: "#c8dce8",
                fontFamily: "'Aktiv Grotesk', -apple-system, sans-serif",
                fontWeight: 300,
                fontSize: "15px",
                outline: "none",
                marginBottom: 10,
                boxSizing: "border-box",
                borderRadius: 0,
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "13px",
                background: "rgba(12,123,179,0.2)",
                border: "1px solid rgba(12,123,179,0.4)",
                color: "#80d0ff",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                cursor: "pointer",
                borderRadius: 0,
              }}
            >
              Enter
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          position: "absolute",
          bottom: 32,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          letterSpacing: "1.5px",
          color: "rgba(122,154,170,0.3)",
          textTransform: "uppercase",
        }}>
          mondayandpartners.com
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-8px); }
          75%       { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

// ── Tool labels ───────────────────────────────────────────────────────────────

const TOOL_LABELS = {
  count_respondents:      "Count respondents",
  get_distribution:       "Distribution",
  cross_tabulate:         "Cross-tabulation",
  get_numeric_stats:      "Numeric stats",
  analyze_funding_gaps:   "Funding gap",
  get_revenue_trajectory: "Revenue trajectory",
  get_dataset_summary:    "Dataset summary",
  list_available_fields:  "Field listing",
};

// ── LED regions ───────────────────────────────────────────────────────────────

const LED_REGIONS = [
  { name: "Greater New Orleans", n: 112, active: true  },
  { name: "Capital Region",      n: 0,   active: false },
  { name: "Acadiana",            n: 0,   active: false },
  { name: "Central Louisiana",   n: 0,   active: false },
  { name: "Northwest Louisiana", n: 0,   active: false },
  { name: "North Delta",         n: 0,   active: false },
  { name: "Southwest Louisiana", n: 0,   active: false },
  { name: "Northshore",          n: 0,   active: false },
];

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--card-bg-solid)",
      border: "1px solid var(--border-light)",
      borderRadius: 8,
      padding: "28px 28px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeading({ label, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px",
        letterSpacing: "2px",
        textTransform: "uppercase",
        color: "var(--text-light)",
        marginBottom: sub ? 4 : 0,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          color: "var(--text-light)",
        }}>
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

  function logout() {
    sessionStorage.removeItem("la-admin-auth");
    setAuthed(false);
    setData(null);
  }

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

  useEffect(() => {
    if (authed) { setLoading(true); fetchData(); }
  }, [authed, fetchData]);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [authed, fetchData]);

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  const { totals, dailyData, toolCounts, recent } = data || {};
  const totalTokens    = (totals?.inputTokens || 0) + (totals?.outputTokens || 0);
  const avgPerSession  = totals?.chats
    ? (totals.queries / totals.chats).toFixed(1)
    : "0";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'Aktiv Grotesk', -apple-system, sans-serif",
      fontWeight: 300,
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(3, 36, 60, 0.96)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        height: 52,
        display: "flex",
        alignItems: "center",
        padding: "0 60px",
        gap: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            letterSpacing: "2px",
            color: "var(--accent-bright)",
            fontWeight: 400,
          }}>
            ADMIN
          </span>
          <span style={{
            width: 1, height: 14,
            background: "rgba(122,154,170,0.3)",
            display: "inline-block",
          }} />
          <span style={{
            fontFamily: "'Aktiv Grotesk', -apple-system, sans-serif",
            fontSize: "13px",
            fontWeight: 300,
            color: "rgba(200,220,232,0.65)",
          }}>
            Louisiana Startup Report
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Day range */}
        <div style={{
          display: "flex",
          border: "1px solid rgba(122,154,170,0.25)",
          borderRadius: 3,
          overflow: "hidden",
          marginRight: 20,
        }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "5px 14px",
                border: "none",
                borderRight: d !== 90 ? "1px solid rgba(122,154,170,0.25)" : "none",
                cursor: "pointer",
                background: days === d ? "rgba(12,123,179,0.25)" : "transparent",
                color: days === d ? "#0c7bb3" : "rgba(200,220,232,0.4)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.5px",
                transition: "all 0.15s",
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Live badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "#48854c",
          letterSpacing: "1px",
          textTransform: "uppercase",
        }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: "50%",
            background: "#48854c",
            display: "inline-block",
          }} />
          Live
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          style={{
            marginLeft: 20,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "rgba(122,154,170,0.45)",
            padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => e.target.style.color = "rgba(200,220,232,0.75)"}
          onMouseLeave={(e) => e.target.style.color = "rgba(122,154,170,0.45)"}
        >
          Sign out
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 60px 80px" }}>

        {loading && (
          <div style={{
            textAlign: "center",
            padding: "100px 0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            color: "var(--text-light)",
            letterSpacing: "1px",
          }}>
            Loading...
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Stat cards ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>

              {/* Conversations — from live sessions only */}
              <Card style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px", letterSpacing: "2px",
                  textTransform: "uppercase", color: "var(--text-light)",
                  marginBottom: 10,
                }}>
                  Conversations
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "32px", color: "var(--accent-bright)",
                  fontWeight: 400, lineHeight: 1,
                }}>
                  {fmtNum(totals.chats)}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px", color: "var(--text-light)", marginTop: 8,
                }}>
                  {days}d window
                </div>
              </Card>

              <Card style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px", letterSpacing: "2px",
                  textTransform: "uppercase", color: "var(--text-light)",
                  marginBottom: 10,
                }}>
                  Total queries
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "32px", color: "var(--accent-bright)",
                  fontWeight: 400, lineHeight: 1,
                }}>
                  {fmtNum(totals.queries)}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px", color: "var(--text-light)", marginTop: 8,
                }}>
                  {avgPerSession} avg per session
                </div>
              </Card>

              <Card style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px", letterSpacing: "2px",
                  textTransform: "uppercase", color: "var(--text-light)",
                  marginBottom: 10,
                }}>
                  Tokens consumed
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "32px", color: "var(--dark)",
                  fontWeight: 400, lineHeight: 1,
                }}>
                  {fmtNum(totalTokens)}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px", color: "var(--text-light)", marginTop: 8,
                }}>
                  {fmtNum(totals.inputTokens)} in · {fmtNum(totals.outputTokens)} out
                </div>
              </Card>

              {/* Cost */}
              <Card style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px", letterSpacing: "2px",
                  textTransform: "uppercase", color: "var(--text-light)",
                  marginBottom: 10,
                }}>
                  API cost
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "32px", color: "#a07c30",
                  fontWeight: 400, lineHeight: 1,
                }}>
                  {fmtCost(totals.cost)}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px", color: "var(--text-light)", marginTop: 8,
                }}>
                  {fmtCost(totals.chats ? totals.cost / totals.chats : 0)} per session
                </div>
              </Card>
            </div>

            {/* ── Chart note ─────────────────────────────────────────────── */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              color: "var(--text-light)",
              letterSpacing: "0.5px",
              marginBottom: 16,
              paddingLeft: 2,
            }}>
              30-day rolling window · includes all sessions
            </div>

            {/* ── Row 2: conversations + tool usage ─────────────────────── */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>

              <Card style={{ flex: 2 }}>
                <CardHeading label="Conversations" sub={`${days}-day trend · includes demo data`} />
                <LineChart
                  series={[{ values: dailyData.map((d) => d.chats), color: "#0c7bb3" }]}
                  labels={dailyData.map((d) => d.label)}
                  height={170}
                />
              </Card>

              <Card style={{ flex: 1 }}>
                <CardHeading label="Tool usage" sub="Calls per tool · all sessions" />
                {Object.keys(toolCounts).length === 0 ? (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    color: "var(--text-light)",
                    paddingTop: 8,
                  }}>
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
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 5,
                            }}>
                              <span style={{
                                fontFamily: "'Aktiv Grotesk', -apple-system, sans-serif",
                                fontSize: "12px",
                                fontWeight: 300,
                                color: "var(--text)",
                              }}>
                                {TOOL_LABELS[tool] || tool}
                              </span>
                              <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: "11px",
                                color: "var(--text-light)",
                              }}>
                                {count}
                              </span>
                            </div>
                            <div style={{
                              height: 3,
                              background: "var(--border-light)",
                              borderRadius: 1,
                            }}>
                              <div style={{
                                height: "100%",
                                width: `${(count / maxCount) * 100}%`,
                                background: "var(--accent)",
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

            {/* ── Row 3: token chart + dataset coverage ─────────────────── */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>

              <Card style={{ flex: 1 }}>
                <CardHeading label="Token consumption" />
                <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
                  {[
                    { label: "Input",  color: "#0c7bb3" },
                    { label: "Output", color: "#7a9aaa" },
                  ].map(({ label, color }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10px",
                      color,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                    }}>
                      <span style={{
                        display: "inline-block",
                        width: 14, height: 2,
                        background: color,
                        borderRadius: 1,
                      }} />
                      {label}
                    </div>
                  ))}
                </div>
                <LineChart
                  series={[
                    { values: dailyData.map((d) => d.inputTokens),  color: "#0c7bb3" },
                    { values: dailyData.map((d) => d.outputTokens), color: "#7a9aaa" },
                  ]}
                  labels={dailyData.map((d) => d.label)}
                  height={140}
                />
              </Card>

              <Card style={{ flex: 1 }}>
                <CardHeading
                  label="Dataset coverage"
                  sub="LED regions · 2025 baseline"
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {LED_REGIONS.map((region) => (
                    <div key={region.name} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}>
                      <div style={{
                        flex: 1,
                        fontFamily: "'Aktiv Grotesk', -apple-system, sans-serif",
                        fontSize: "12px",
                        fontWeight: 300,
                        color: region.active ? "var(--text)" : "var(--text-light)",
                      }}>
                        {region.name}
                      </div>
                      <div style={{
                        width: 100,
                        height: 3,
                        background: "var(--border-light)",
                        borderRadius: 1,
                        flexShrink: 0,
                      }}>
                        <div style={{
                          height: "100%",
                          width: region.active ? "100%" : "0%",
                          background: region.active ? "#a07c30" : "var(--border-light)",
                          borderRadius: 1,
                        }} />
                      </div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "10px",
                        color: region.active ? "#a07c30" : "var(--text-light)",
                        width: 48,
                        textAlign: "right",
                        flexShrink: 0,
                        letterSpacing: "0.5px",
                      }}>
                        {region.active ? `n=${region.n}` : "2026"}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border-light)",
                  fontFamily: "'Aktiv Grotesk', -apple-system, sans-serif",
                  fontSize: "11px",
                  fontWeight: 300,
                  color: "var(--text-light)",
                  lineHeight: 1.65,
                }}>
                  GNO-only for the 2025 cycle. Statewide expansion
                  planned for 2026.
                </div>
              </Card>
            </div>

            {/* ── Recent sessions ────────────────────────────────────────── */}
            <Card>
              <CardHeading label="Recent sessions" />
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                    {["Session", "Time", "Queries", "Input", "Output", "Cost", ""].map((h) => (
                      <th key={h} style={{
                        padding: "0 16px 11px 0",
                        textAlign: "left",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "9px",
                        letterSpacing: "1.5px",
                        color: "var(--text-light)",
                        fontWeight: 400,
                        textTransform: "uppercase",
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
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        background: idx % 2 !== 0 ? "rgba(3,36,60,0.02)" : "transparent",
                      }}
                    >
                      <td style={{
                        padding: "11px 16px 11px 0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        color: "var(--text-light)",
                      }}>
                        {s.sessionId.slice(0, 14)}
                      </td>
                      <td style={{
                        padding: "11px 16px 11px 0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        color: "var(--text-light)",
                      }}>
                        {relTime(s.timestamp)}
                      </td>
                      <td style={{
                        padding: "11px 16px 11px 0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        color: "var(--text)",
                      }}>
                        {s.queryCount}
                      </td>
                      <td style={{
                        padding: "11px 16px 11px 0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        color: "var(--text)",
                      }}>
                        {fmtNum(s.inputTokens)}
                      </td>
                      <td style={{
                        padding: "11px 16px 11px 0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        color: "var(--text)",
                      }}>
                        {fmtNum(s.outputTokens)}
                      </td>
                      <td style={{
                        padding: "11px 16px 11px 0",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        color: "#a07c30",
                      }}>
                        {fmtCost(s.cost)}
                      </td>
                      <td style={{ padding: "11px 0 11px 0" }}>
                        {s.live && (
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "9px",
                            letterSpacing: "1px",
                            color: "#48854c",
                            textTransform: "uppercase",
                            border: "1px solid rgba(72,133,76,0.3)",
                            borderRadius: 2,
                            padding: "2px 6px",
                          }}>
                            Live
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: "1px solid var(--border-light)",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              color: "var(--text-light)",
              letterSpacing: "0.5px",
            }}>
              <span>Louisiana Startup Report · Admin</span>
              <span>Refreshes every 30s</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
