"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  CANVAS, LAYOUT, FONTS, GRID, ATTRIBUTION, ILLUSTRATION,
  getPalette, getDarkPalette, getPaletteOptions, DEFAULT_PALETTE,
} from "../../lib/design-system";

// ============================================================
// CHART BUILDER
// Pure Canvas API renderer. No charting library.
// Supports: bar, hbar (horizontal bar), stacked, donut
// ============================================================

// ============================================================
// DATA VALIDATION — check compatibility before rendering
// ============================================================

function validateDataForType(type, data) {
  if (!Array.isArray(data) || data.length === 0) {
    return "No data available to chart.";
  }
  if (type === "stacked") {
    if (!data[0]?.segments || !Array.isArray(data[0].segments)) {
      return "Stacked Bar requires grouped data with segments.\nTry Bar or Horizontal Bar for this dataset.";
    }
  }
  return null;
}

// Draw an error/unavailable message directly on canvas
function drawUnavailable(canvas, message, paletteKey, dark) {
  const ctx = canvas.getContext("2d");
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  const palette = dark ? getDarkPalette(paletteKey) : getPalette(paletteKey);

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  drawHeader(ctx, palette, {
    title: "Chart not available for this data",
    badge: "Louisiana Startup Report 2026",
  });
  drawAttribution(ctx, palette);

  // Message lines
  const lines = message.split("\n");
  const cy = CANVAS.height / 2 - (lines.length - 1) * 14;
  ctx.font = FONTS.display.subtitle;
  ctx.textAlign = "center";
  ctx.fillStyle = palette.textMid;
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS.width / 2, cy + i * 28);
  });
}

// Ensure fonts are loaded before rendering
async function waitForFonts() {
  try {
    await document.fonts.load(FONTS.display.title);
    await document.fonts.load(FONTS.mono.data);
  } catch (_) {}
}

// Draw the attribution footer
function drawAttribution(ctx, palette) {
  const y = CANVAS.height - LAYOUT.pad.bottom - ATTRIBUTION.height;

  // Divider line
  ctx.beginPath();
  ctx.moveTo(LAYOUT.pad.left, y + ATTRIBUTION.dividerY);
  ctx.lineTo(CANVAS.width - LAYOUT.pad.right, y + ATTRIBUTION.dividerY);
  ctx.strokeStyle = palette.soft;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.font = FONTS.mono.attribution;
  ctx.fillStyle = palette.textMid;
  ctx.textAlign = "left";
  ctx.fillText(ATTRIBUTION.text, LAYOUT.pad.left, y + ATTRIBUTION.dividerY + 16);
  ctx.fillStyle = palette.textMid;
  ctx.textAlign = "right";
  ctx.fillText(ATTRIBUTION.source, CANVAS.width - LAYOUT.pad.right, y + ATTRIBUTION.dividerY + 16);
}

// Draw header: optional badge, title, subtitle
function drawHeader(ctx, palette, { title, subtitle, badge }) {
  let y = LAYOUT.pad.top;

  if (badge) {
    ctx.font = FONTS.mono.badge;
    ctx.fillStyle = palette.textMid;
    ctx.textAlign = "left";
    const badgeText = badge.toUpperCase();
    const badgeW = ctx.measureText(badgeText).width + 20;
    const badgeH = LAYOUT.header.badgeHeight;

    ctx.strokeStyle = palette.soft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(LAYOUT.pad.left, y, badgeW, badgeH, 3);
    ctx.stroke();
    ctx.fillText(badgeText, LAYOUT.pad.left + 10, y + badgeH / 2 + 4);
    y += badgeH + LAYOUT.header.badgeMargin;
  }

  ctx.font = FONTS.display.title;
  ctx.fillStyle = palette.deep;
  ctx.textAlign = "left";
  ctx.fillText(title, LAYOUT.pad.left, y + LAYOUT.header.titleLineHeight);
  y += LAYOUT.header.titleLineHeight;

  if (subtitle) {
    ctx.font = FONTS.display.subtitle;
    ctx.fillStyle = palette.textMid;
    ctx.fillText(subtitle, LAYOUT.pad.left, y + LAYOUT.header.subtitleMargin + 15);
  }
}

// Draw a small illustration accent (orbital rings sketch)
function drawIllustration(ctx, palette) {
  if (!ILLUSTRATION.enabled) return;
  const size = ILLUSTRATION.size;
  const margin = 20;
  const cx = CANVAS.width - LAYOUT.pad.right - size / 2 - margin;
  const cy = LAYOUT.pad.top + size / 2 + margin;

  ctx.save();
  ctx.globalAlpha = ILLUSTRATION.alpha;

  // Simple orbital rings as decorative mark
  const rings = [
    { rx: size * 0.48, ry: size * 0.14, angle: 0.3 },
    { rx: size * 0.38, ry: size * 0.22, angle: -0.5 },
    { rx: size * 0.28, ry: size * 0.28, angle: 0.8 },
  ];

  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 0.7;

  rings.forEach(({ rx, ry, angle }) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Central dot cluster
  ctx.fillStyle = palette.primary;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = size * 0.1;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Draw horizontal grid lines behind chart
function drawGrid(ctx, palette, chartTop, chartBottom, chartLeft, chartRight, maxVal) {
  ctx.strokeStyle = palette.soft;
  ctx.lineWidth = GRID.lineWidth;
  ctx.globalAlpha = GRID.alpha;

  for (let i = 0; i <= GRID.count; i++) {
    const t = i / GRID.count;
    const y = chartBottom - t * (chartBottom - chartTop);
    const val = Math.round(t * maxVal);

    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();

    // Axis label
    ctx.globalAlpha = 1;
    ctx.font = FONTS.mono.axis;
    ctx.fillStyle = palette.textMid;
    ctx.textAlign = "right";
    ctx.fillText(
      val % 1 === 0 ? val.toString() : val.toFixed(1),
      chartLeft - 8,
      y + 4,
    );
    ctx.globalAlpha = GRID.alpha;
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// CHART TYPE RENDERERS
// ============================================================

function renderBar(ctx, palette, data, chartArea) {
  const { top, bottom, left, right } = chartArea;
  const barAreaLeft = left + LAYOUT.bar.axisPadding;
  const barAreaWidth = right - barAreaLeft;
  const maxVal = Math.max(...data.map(d => d.value)) * 1.15;

  drawGrid(ctx, palette, top, bottom, barAreaLeft, right, maxVal);

  const n = data.length;
  const totalGapFraction = LAYOUT.bar.groupGap;
  const barW = Math.min(
    LAYOUT.bar.maxBarWidth,
    barAreaWidth / (n + n * totalGapFraction),
  );
  const step = barAreaWidth / n;

  data.forEach((d, i) => {
    const barH = ((d.value / maxVal) * (bottom - top));
    const x = barAreaLeft + i * step + (step - barW) / 2;
    const y = bottom - barH;

    // Bar
    ctx.fillStyle = d.color || palette.primary;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, LAYOUT.bar.barRadius);
    ctx.fill();

    // Value label above bar
    ctx.font = FONTS.mono.axis;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "center";
    ctx.fillText(
      formatValue(d.value, d.format),
      x + barW / 2,
      y - LAYOUT.bar.labelPadding,
    );

    // Category label below axis
    ctx.font = FONTS.display.label;
    ctx.fillStyle = palette.textMid;
    ctx.textAlign = "center";
    wrapText(ctx, d.label, x + barW / 2, bottom + 20, barW + 8, 14);
  });
}

function renderHBar(ctx, palette, data, chartArea) {
  const { top, bottom, left, right } = chartArea;
  const labelWidth = LAYOUT.hbar.labelWidth;
  const barLeft = left + labelWidth + 12;
  const barRight = right;
  const maxVal = Math.max(...data.map(d => d.value)) * 1.12;

  const totalH = data.length * (LAYOUT.hbar.barHeight + LAYOUT.hbar.barGap);
  const startY = top + (bottom - top - totalH) / 2;

  data.forEach((d, i) => {
    const y = startY + i * (LAYOUT.hbar.barHeight + LAYOUT.hbar.barGap);
    const barW = ((d.value / maxVal) * (barRight - barLeft));

    // Category label
    ctx.font = FONTS.display.label;
    ctx.fillStyle = palette.textMid;
    ctx.textAlign = "right";
    ctx.fillText(d.label, left + labelWidth, y + LAYOUT.hbar.barHeight / 2 + 4);

    // Bar background track
    ctx.fillStyle = palette.soft;
    ctx.beginPath();
    ctx.roundRect(barLeft, y, barRight - barLeft, LAYOUT.hbar.barHeight, LAYOUT.bar.barRadius);
    ctx.fill();

    // Bar fill
    ctx.fillStyle = d.color || palette.primary;
    ctx.beginPath();
    ctx.roundRect(barLeft, y, Math.max(barW, 4), LAYOUT.hbar.barHeight, LAYOUT.bar.barRadius);
    ctx.fill();

    // Value label
    ctx.font = FONTS.mono.axis;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.fillText(
      formatValue(d.value, d.format),
      barLeft + barW + LAYOUT.hbar.valuePadding,
      y + LAYOUT.hbar.barHeight / 2 + 4,
    );
  });
}

function renderStacked(ctx, palette, data, chartArea) {
  // data: [{ label, segments: [{ label, value, color? }] }]
  const { top, bottom, left, right } = chartArea;
  const barAreaLeft = left + LAYOUT.bar.axisPadding;
  const barAreaWidth = right - barAreaLeft;
  const maxVal = Math.max(...data.map(d => d.segments.reduce((s, seg) => s + seg.value, 0))) * 1.15;

  drawGrid(ctx, palette, top, bottom, barAreaLeft, right, maxVal);

  // Build color sequence from palette
  const segColors = [palette.primary, palette.mid, palette.deep, palette.soft];

  const n = data.length;
  const barW = Math.min(LAYOUT.bar.maxBarWidth, barAreaWidth / (n + n * LAYOUT.bar.groupGap));
  const step = barAreaWidth / n;

  data.forEach((d, i) => {
    const total = d.segments.reduce((s, seg) => s + seg.value, 0);
    const x = barAreaLeft + i * step + (step - barW) / 2;
    let yBase = bottom;

    d.segments.forEach((seg, si) => {
      const segH = (seg.value / maxVal) * (bottom - top);
      const y = yBase - segH;
      ctx.fillStyle = seg.color || segColors[si % segColors.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barW, segH, si === d.segments.length - 1 ? LAYOUT.bar.barRadius : 0);
      ctx.fill();
      yBase = y;
    });

    // Total label
    const totalH = (total / maxVal) * (bottom - top);
    ctx.font = FONTS.mono.axis;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "center";
    ctx.fillText(formatValue(total, d.format), x + barW / 2, bottom - totalH - LAYOUT.bar.labelPadding);

    // Category label
    ctx.font = FONTS.display.label;
    ctx.fillStyle = palette.textMid;
    ctx.textAlign = "center";
    wrapText(ctx, d.label, x + barW / 2, bottom + 20, barW + 8, 14);
  });
}

function renderDonut(ctx, palette, data, chartArea) {
  const { top, bottom, left, right } = chartArea;
  const chartH = bottom - top;
  const outerR = chartH * LAYOUT.donut.outerRadiusFraction;
  const innerR = chartH * LAYOUT.donut.innerRadiusFraction;
  const cx = left + (right - left) * 0.38;
  const cy = top + chartH / 2;

  const total = data.reduce((s, d) => s + d.value, 0);
  const segColors = [palette.primary, palette.mid, palette.deep, palette.soft];
  const gap = LAYOUT.donut.segmentGap;

  let angle = -Math.PI / 2;
  data.forEach((d, i) => {
    const sweep = (d.value / total) * (Math.PI * 2 - gap * data.length);

    ctx.fillStyle = d.color || segColors[i % segColors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle + gap / 2, angle + sweep + gap / 2);
    ctx.arc(cx, cy, innerR, angle + sweep + gap / 2, angle + gap / 2, true);
    ctx.closePath();
    ctx.fill();

    angle += sweep + gap;
  });

  // Center total
  ctx.font = FONTS.mono.dataLarge;
  ctx.fillStyle = palette.deep;
  ctx.textAlign = "center";
  ctx.fillText(total.toString(), cx, cy + 8);
  ctx.font = FONTS.display.label;
  ctx.fillStyle = palette.textMid;
  ctx.fillText("total", cx, cy + 24);

  // Legend
  const legendX = CANVAS.width * LAYOUT.donut.legendLeft;
  const legendLineH = 28;
  const legendTop = cy - (data.length * legendLineH) / 2;

  data.forEach((d, i) => {
    const ly = legendTop + i * legendLineH;
    const pct = ((d.value / total) * 100).toFixed(1);

    // Color swatch
    ctx.fillStyle = d.color || segColors[i % segColors.length];
    ctx.beginPath();
    ctx.roundRect(legendX, ly + 4, 10, 10, 2);
    ctx.fill();

    // Label
    ctx.font = FONTS.display.label;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.fillText(d.label, legendX + 18, ly + 14);

    // Percentage
    ctx.font = FONTS.mono.axis;
    ctx.fillStyle = palette.textMid;
    ctx.textAlign = "right";
    ctx.fillText(`${pct}%`, right, ly + 14);

    // Value
    ctx.fillStyle = palette.text;
    ctx.fillText(formatValue(d.value, d.format), right - 52, ly + 14);
  });
}

// ============================================================
// UTILITIES
// ============================================================

function formatValue(val, format) {
  if (!format) return val % 1 === 0 ? val.toString() : val.toFixed(1);
  if (format === "percent") return `${val}%`;
  if (format === "dollar") return `$${val.toLocaleString()}`;
  if (format === "count") return val.toLocaleString();
  return val.toString();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  words.forEach((word, i) => {
    const test = line + (line ? " " : "") + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
    if (i === words.length - 1) ctx.fillText(line, x, lineY);
  });
}

// ============================================================
// MAIN RENDER FUNCTION
// ============================================================

async function renderChart(canvas, config) {
  await waitForFonts();

  const ctx = canvas.getContext("2d");
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;

  const palette = config.dark
    ? getDarkPalette(config.palette || DEFAULT_PALETTE)
    : getPalette(config.palette || DEFAULT_PALETTE);

  // Background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  // Header
  drawHeader(ctx, palette, {
    title: config.title || "Untitled Chart",
    subtitle: config.subtitle || "",
    badge: config.badge || "Louisiana Startup Report 2026",
  });

  // Illustration accent
  drawIllustration(ctx, palette);

  // Attribution
  drawAttribution(ctx, palette);

  // Chart area bounds
  const chartArea = {
    top:    LAYOUT.chartAreaTop(),
    bottom: LAYOUT.chartAreaBottom(),
    left:   LAYOUT.chartAreaLeft(),
    right:  LAYOUT.chartAreaRight(),
  };

  // Render chart type
  const type = config.type || "bar";
  if (type === "bar")     renderBar(ctx, palette, config.data, chartArea);
  if (type === "hbar")    renderHBar(ctx, palette, config.data, chartArea);
  if (type === "stacked") renderStacked(ctx, palette, config.data, chartArea);
  if (type === "donut")   renderDonut(ctx, palette, config.data, chartArea);
}

// ============================================================
// COMPONENT
// ============================================================

const CHART_TYPES = [
  { key: "bar",     label: "Bar" },
  { key: "hbar",    label: "Horizontal Bar" },
  { key: "stacked", label: "Stacked Bar" },
  { key: "donut",   label: "Donut" },
];

export default function ChartBuilder({ config, onClose }) {
  const canvasRef = useRef(null);
  const [palette, setPalette] = useState(config?.palette || DEFAULT_PALETTE);
  const [chartType, setChartType] = useState(config?.type || "bar");
  const [darkMode, setDarkMode] = useState(false);
  const [rendering, setRendering] = useState(false);

  const paletteOptions = getPaletteOptions();

  const activeConfig = {
    ...config,
    palette,
    type: chartType,
    dark: darkMode,
  };

  const draw = useCallback(async () => {
    if (!canvasRef.current || !config?.data) return;
    setRendering(true);
    try {
      const err = validateDataForType(chartType, config.data);
      if (err) {
        drawUnavailable(canvasRef.current, err, palette, darkMode);
        return;
      }
      await renderChart(canvasRef.current, activeConfig);
    } catch (e) {
      drawUnavailable(
        canvasRef.current,
        "Could not render this chart type with the current data.\nTry a different chart type.",
        palette,
        darkMode,
      );
    } finally {
      setRendering(false);
    }
  }, [palette, chartType, darkMode, config]);

  useEffect(() => {
    draw();
  }, [draw]);

  function downloadPNG() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    const title = (config?.title || "chart").toLowerCase().replace(/\s+/g, "-");
    const mode = darkMode ? "-dark" : "";
    link.download = `la-startup-report-${title}-${palette}${mode}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <div className={`chart-builder ${darkMode ? "chart-builder--dark" : ""}`}>
      <div className="chart-builder-header">
        <span className="chart-builder-title">Chart Builder</span>
        <div className="chart-builder-controls">

          {/* Chart type picker */}
          <div className="chart-control-group">
            {CHART_TYPES.map(t => (
              <button
                key={t.key}
                className={`chart-type-btn ${chartType === t.key ? "active" : ""}`}
                onClick={() => setChartType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Palette picker */}
          <div className="chart-control-group">
            {paletteOptions.map(p => (
              <button
                key={p.key}
                className={`chart-palette-btn ${palette === p.key ? "active" : ""}`}
                onClick={() => setPalette(p.key)}
                title={p.name}
              >
                <span
                  className="chart-palette-swatch"
                  style={{ background: p.swatch }}
                />
                {p.name}
              </button>
            ))}
          </div>

          {/* Dark mode toggle */}
          <button
            className={`chart-dark-toggle ${darkMode ? "chart-dark-toggle--on" : ""}`}
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              // Sun icon
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3"/>
                <line x1="7" y1="0.5" x2="7" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="7" y1="11.5" x2="7" y2="13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="0.5" y1="7" x2="2.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="11.5" y1="7" x2="13.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="2.4" y1="2.4" x2="3.8" y2="3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="10.2" y1="10.2" x2="11.6" y2="11.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="11.6" y1="2.4" x2="10.2" y2="3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="3.8" y1="10.2" x2="2.4" y2="11.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              // Moon icon
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12 8.5A5.5 5.5 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          <button className="chart-download-btn" onClick={downloadPNG} disabled={rendering}>
            {rendering ? "Rendering..." : "Download PNG"}
          </button>

          {onClose && (
            <button className="chart-close-btn" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      <div className={`chart-canvas-wrap ${darkMode ? "chart-canvas-wrap--dark" : ""}`}>
        <canvas
          ref={canvasRef}
          className="chart-canvas"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
    </div>
  );
}
