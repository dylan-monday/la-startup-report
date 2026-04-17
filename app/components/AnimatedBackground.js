"use client";

import { useRef, useEffect } from "react";

// ============================================================
// ANIMATED BACKGROUND — Orbital Rings + Tensegrity
// - Core centered in right 40% of viewport
// - Thin, sharp lines
// - Mouse pointer influences spin speed/direction
// - Auto-cycles between modes every 15 seconds with fade transition
// ============================================================

const COL = {
  bg: "#f3f5f6",
  dark: "#03243c",
  mid: "#1a4a66",
  light: "#3d7a9a",
  accent: "#0c7bb3",
};

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
}

// Seeded PRNG — Mulberry32
let _seed = 77;
function seedRandom(s) { _seed = s >>> 0; }
function sRandom(a, b) {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  if (a === undefined) return r;
  if (b === undefined) return r * a;
  return a + r * (b - a);
}

function mapRange(v, a1, a2, b1, b2) {
  return b1 + ((v - a1) / (a2 - a1)) * (b2 - b1);
}

// 3D math
function rotateX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}
function rotateY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotateZ(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}
function vecLen(v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]); }
function vecNorm(v) { const l = vecLen(v); return l > 0 ? [v[0]/l, v[1]/l, v[2]/l] : [0,0,0]; }
function vecScale(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }
function project(pt, persp, cx, cy) {
  const z = pt[2] + persp;
  const f = persp / Math.max(z, 1);
  return [cx + pt[0] * f, cy + pt[1] * f, z];
}

// Icosahedron + geodesic subdivision
function icosahedron(radius) {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
  const verts = raw.map(v => vecScale(vecNorm(v), radius));
  const faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  return { verts, faces };
}

function geodesicSphere(radius, subdivisions) {
  const geo = icosahedron(radius);
  let verts = geo.verts;
  let faces = geo.faces;
  for (let s = 0; s < subdivisions; s++) {
    const newFaces = [];
    const edgeCache = {};
    const getMid = (i1, i2) => {
      const key = Math.min(i1, i2) + "_" + Math.max(i1, i2);
      if (edgeCache[key] !== undefined) return edgeCache[key];
      const mid = vecNorm([(verts[i1][0]+verts[i2][0])/2, (verts[i1][1]+verts[i2][1])/2, (verts[i1][2]+verts[i2][2])/2]);
      verts.push(vecScale(mid, radius));
      edgeCache[key] = verts.length - 1;
      return edgeCache[key];
    };
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      const a = getMid(f[0], f[1]), b = getMid(f[1], f[2]), c = getMid(f[2], f[0]);
      newFaces.push([f[0],a,c],[f[1],b,a],[f[2],c,b],[a,b,c]);
    }
    faces = newFaces;
  }
  const edgeSet = {}, edges = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    for (let i = 0; i < 3; i++) {
      const a = f[i], b = f[(i+1)%3];
      const key = Math.min(a,b) + "_" + Math.max(a,b);
      if (!edgeSet[key]) { edgeSet[key] = true; edges.push([a, b]); }
    }
  }
  return { verts, edges };
}

function buildGeometry(W, H) {
  const diag = Math.sqrt(W*W + H*H);

  // Orbital rings
  seedRandom(42);
  const rings = [];
  const numRings = 9;
  for (let r = 0; r < numRings; r++) {
    const t = r / numRings;
    const radius = diag * (0.12 + t * 0.48);
    const tiltX = r * 0.38 + sRandom(-0.2, 0.2);
    const tiltZ = r * 0.55 + sRandom(-0.3, 0.3);
    const numPts = 80;
    const verts = [], edges = [];
    for (let i = 0; i <= numPts; i++) {
      const a = (i / numPts) * Math.PI * 2;
      let pt = [radius * Math.cos(a), 0, radius * Math.sin(a)];
      pt = rotateX(pt, tiltX);
      pt = rotateZ(pt, tiltZ);
      verts.push(pt);
      if (i > 0) edges.push([i-1, i]);
    }
    rings.push({ verts, edges, depth: t });
  }
  const orbCore = geodesicSphere(diag * 0.055, 1);
  const ringData = { rings, core: orbCore };

  // Tensegrity
  seedRandom(99);
  const scale = diag * 0.4;
  const numStruts = 18;
  const struts = [];
  for (let i = 0; i < numStruts; i++) {
    const theta = Math.acos(1 - (2*(i+0.5)) / (numStruts*2));
    const phi = Math.PI * (1 + Math.sqrt(5)) * i;
    const x1 = scale * Math.sin(theta) * Math.cos(phi);
    const y1 = scale * Math.sin(theta) * Math.sin(phi);
    const z1 = scale * Math.cos(theta);
    const theta2 = Math.PI - theta + sRandom(-0.3, 0.3);
    const phi2 = phi + Math.PI + sRandom(-0.5, 0.5);
    const s2 = scale * (0.6 + sRandom(0.4));
    const x2 = s2 * Math.sin(theta2) * Math.cos(phi2);
    const y2 = s2 * Math.sin(theta2) * Math.sin(phi2);
    const z2 = s2 * Math.cos(theta2);
    struts.push({ a: [x1,y1,z1], b: [x2,y2,z2] });
  }
  const allPts = [];
  struts.forEach(s => { allPts.push(s.a); allPts.push(s.b); });
  const cables = [];
  for (let i = 0; i < allPts.length; i++) {
    const dists = [];
    for (let j = 0; j < allPts.length; j++) {
      if (i === j) continue;
      dists.push({ idx: j, d: vecLen([allPts[i][0]-allPts[j][0], allPts[i][1]-allPts[j][1], allPts[i][2]-allPts[j][2]]) });
    }
    dists.sort((a,b) => a.d - b.d);
    for (let k = 0; k < Math.min(3, dists.length); k++) cables.push([i, dists[k].idx]);
  }
  const tensData = { struts, allPts, cables };

  return { ringData, tensData };
}

const PERSP = 900;

function drawEdge(ctx, v1, v2, cx, cy, rX, rY, colorHex, alphaBase, lw, scale) {
  const a = rotateY(rotateX(v1, rX), rY);
  const b = rotateY(rotateX(v2, rX), rY);
  const sa = [a[0]*scale, a[1]*scale, a[2]*scale];
  const sb = [b[0]*scale, b[1]*scale, b[2]*scale];
  const pa = project(sa, PERSP, cx, cy);
  const pb = project(sb, PERSP, cx, cy);
  const avgZ = (pa[2] + pb[2]) / 2;
  const depth = Math.max(0, Math.min(1, (PERSP*2 - avgZ) / (PERSP*2)));
  const alpha = alphaBase * depth;
  if (alpha < 0.004) return;
  ctx.lineWidth = lw;
  ctx.strokeStyle = hexToRGBA(colorHex, alpha);
  ctx.beginPath();
  ctx.moveTo(pa[0], pa[1]);
  ctx.lineTo(pb[0], pb[1]);
  ctx.stroke();
}

function drawDot(ctx, v, cx, cy, rX, rY, colorHex, alphaBase, sz, scale) {
  const r = rotateY(rotateX(v, rX), rY);
  const sr = [r[0]*scale, r[1]*scale, r[2]*scale];
  const pr = project(sr, PERSP, cx, cy);
  const depth = Math.max(0, Math.min(1, (PERSP*2 - pr[2]) / (PERSP*2)));
  const alpha = alphaBase * depth;
  if (alpha < 0.01) return;
  ctx.fillStyle = hexToRGBA(colorHex, alpha);
  ctx.beginPath();
  ctx.arc(pr[0], pr[1], Math.max(0.5, sz * (PERSP / Math.max(pr[2], 1))), 0, Math.PI*2);
  ctx.fill();
}

function drawOrbital(ctx, ringData, W, H, t, speedMult, scale) {
  const cx = W * 0.8;
  const cy = H * 0.5;
  const rX = t * 0.04 * speedMult + 0.3;
  const rY = t * 0.06 * speedMult + 0.8;
  for (let ri = 0; ri < ringData.rings.length; ri++) {
    const ring = ringData.rings[ri];
    const col = ri % 3 === 0 ? COL.dark : ri % 3 === 1 ? COL.mid : COL.light;
    const alphaBase = mapRange(ring.depth, 0, 1, 0.22, 0.48);
    const lw = mapRange(ring.depth, 0, 1, 0.8, 1.4);
    for (let i = 0; i < ring.edges.length; i++) {
      const e = ring.edges[i];
      drawEdge(ctx, ring.verts[e[0]], ring.verts[e[1]], cx, cy, rX, rY, col, alphaBase, lw, scale);
    }
    const dotInterval = 16;
    for (let i = 0; i < ring.verts.length; i += dotInterval) {
      drawDot(ctx, ring.verts[i], cx, cy, rX, rY, COL.accent, alphaBase * 1.4, 1.8, scale);
    }
  }
  const core = ringData.core;
  for (let i = 0; i < core.edges.length; i++) {
    const e = core.edges[i];
    drawEdge(ctx, core.verts[e[0]], core.verts[e[1]], cx, cy, rX, rY, COL.accent, 0.45, 1.0, scale);
  }
}

function drawTensegrity(ctx, tensData, W, H, t, speedMult, scale) {
  const cx = W * 0.8;
  const cy = H * 0.48;
  const rX = t * 0.06 * speedMult + 0.4;
  const rY = t * 0.09 * speedMult + 1.2;
  for (let i = 0; i < tensData.cables.length; i++) {
    const c = tensData.cables[i];
    drawEdge(ctx, tensData.allPts[c[0]], tensData.allPts[c[1]], cx, cy, rX, rY, COL.light, 0.18, 0.7, scale);
  }
  for (let i = 0; i < tensData.struts.length; i++) {
    const s = tensData.struts[i];
    drawEdge(ctx, s.a, s.b, cx, cy, rX, rY, COL.dark, 0.38, 1.4, scale);
  }
  for (let i = 0; i < tensData.allPts.length; i++) {
    drawDot(ctx, tensData.allPts[i], cx, cy, rX, rY, COL.accent, 0.42, 3, scale);
  }
}

const MODES = ["orbital", "tensegrity"];
const CYCLE_DURATION = 15; // seconds before switching
const TRANSITION_DURATION = 1.2; // seconds for fade out + in

export default function AnimatedBackground() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    time: 0,
    geometry: null,
    running: true,
    // Mode cycling
    modeIndex: 0,
    cycleTimer: 0,
    transitioning: false,
    transitionPhase: 0, // 0=out, 1=in
    transitionProgress: 0,
    globalAlpha: 1,
    globalScale: 1,
    // Mouse
    mouseX: 0.8,   // normalized 0-1 (default at core)
    mouseY: 0.5,
    speedMult: 1,
  });

  useEffect(() => {
    const state = stateRef.current;
    state.running = true;
    state.geometry = null;

    const canvas = canvasRef.current;
    // Render at true device pixel ratio (cap at 2 for perf) for crisp lines
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      state.geometry = null;
    }
    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking
    function onMouseMove(e) {
      state.mouseX = e.clientX / window.innerWidth;
      state.mouseY = e.clientY / window.innerHeight;
      // Core is at (0.8, 0.5) in normalized space
      const dx = state.mouseX - 0.8;
      const dy = state.mouseY - 0.5;
      // Max possible distance from core ~= 0.85 (corner to corner approx)
      const dist = Math.sqrt(dx*dx + dy*dy) / 0.7;
      // Speed modulation: barely perceptible nudge, ±3% at most
      state.speedMult = 0.97 + dist * 0.06;
    }
    window.addEventListener("mousemove", onMouseMove);

    let rafId;
    let lastTime = null;

    function animate(timestamp) {
      if (!state.running) return;
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // seconds, capped
      lastTime = timestamp;

      const W = canvas.width;
      const H = canvas.height;

      if (!state.geometry) {
        state.geometry = buildGeometry(W, H);
      }

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);

      // Mode cycle timer
      if (!state.transitioning) {
        state.cycleTimer += dt;
        if (state.cycleTimer >= CYCLE_DURATION) {
          state.transitioning = true;
          state.transitionPhase = 0; // fading out
          state.transitionProgress = 0;
          state.cycleTimer = 0;
        }
      }

      // Handle transition
      if (state.transitioning) {
        state.transitionProgress += dt / (TRANSITION_DURATION / 2);
        if (state.transitionPhase === 0) {
          // Fading out: alpha 1→0, scale 1→0.6
          const p = Math.min(state.transitionProgress, 1);
          state.globalAlpha = 1 - p;
          state.globalScale = 1 - p * 0.4;
          if (state.transitionProgress >= 1) {
            // Switch mode
            state.modeIndex = (state.modeIndex + 1) % MODES.length;
            state.geometry = null; // rebuild
            state.transitionPhase = 1;
            state.transitionProgress = 0;
          }
        } else {
          // Fading in: alpha 0→1, scale 0.6→1
          const p = Math.min(state.transitionProgress, 1);
          state.globalAlpha = p;
          state.globalScale = 0.6 + p * 0.4;
          if (state.transitionProgress >= 1) {
            state.transitioning = false;
            state.globalAlpha = 1;
            state.globalScale = 1;
          }
        }
      }

      // Rebuild geometry if needed
      if (!state.geometry) {
        state.geometry = buildGeometry(W, H);
      }

      state.time += dt;
      const currentMode = MODES[state.modeIndex];
      const gAlpha = state.globalAlpha;
      const gScale = state.globalScale;

      // Apply global alpha via canvas
      ctx.save();
      ctx.globalAlpha = gAlpha;

      if (currentMode === "orbital") {
        drawOrbital(ctx, state.geometry.ringData, W, H, state.time, state.speedMult, gScale);
      } else {
        drawTensegrity(ctx, state.geometry.tensData, W, H, state.time, state.speedMult, gScale);
      }

      ctx.restore();

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      state.running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
