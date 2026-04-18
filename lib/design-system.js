// ============================================================
// LOUISIANA STARTUP REPORT — DESIGN SYSTEM
// Color palettes, typography, and layout constants.
// Edit this file to update the visual language globally.
// ============================================================

// ------------------------------------------------------------
// COLOR SYSTEM
// Each theme is a tonal family: one hue, four stops.
// All themes follow the same structural rules so charts look
// consistent regardless of which palette is active.
//
// Stop roles:
//   bg       — canvas background (near-white, barely tinted)
//   soft     — subtle fills, chart gridlines, border-level elements
//   mid      — illustration lines, secondary bars, supporting data
//   primary  — main data bars, accent elements, illustration core
//   deep     — emphasis, titles, darkest data elements
//   text     — body text, labels (near-neutral, not pure black)
//   textMid  — secondary labels, axis text, captions
// ------------------------------------------------------------

export const PALETTES = {
  indigo: {
    name: "Indigo",
    bg:       "#f8f8ff",   // original: f8f8ff
    soft:     "#ebebf8",
    mid:      "#8282b6",   // original: 8282b6
    primary:  "#565698",   // original: 565698
    deep:     "#3a3a78",
    text:     "#363636",   // original: 363636
    textMid:  "#6b6b8a",
  },
  blue: {
    name: "Blue",
    bg:       "#f5f8ff",
    soft:     "#e6edf8",
    mid:      "#7a9ec8",
    primary:  "#4a74a8",
    deep:     "#2e5285",
    text:     "#363636",
    textMid:  "#5a7090",
  },
  teal: {
    name: "Teal",
    bg:       "#f4fafa",
    soft:     "#e2f2f2",
    mid:      "#6aabaa",
    primary:  "#3d8887",
    deep:     "#266665",
    text:     "#363636",
    textMid:  "#4a7a78",
  },
  green: {
    name: "Green",
    bg:       "#f5faf5",
    soft:     "#e4f2e4",
    mid:      "#76aa7a",
    primary:  "#48854c",
    deep:     "#2e6232",
    text:     "#363636",
    textMid:  "#4a7050",
  },
  amber: {
    name: "Amber",
    bg:       "#fffcf5",
    soft:     "#f5eedc",
    mid:      "#c8a460",
    primary:  "#a07c30",
    deep:     "#7a5c18",
    text:     "#363636",
    textMid:  "#7a6040",
  },
  rose: {
    name: "Rose",
    bg:       "#fff8f8",
    soft:     "#f5e6e8",
    mid:      "#c07888",
    primary:  "#964858",
    deep:     "#742838",
    text:     "#363636",
    textMid:  "#7a4a54",
  },
};

// Default theme
export const DEFAULT_PALETTE = "indigo";

// ------------------------------------------------------------
// TYPOGRAPHY
// Font stacks used in chart rendering (canvas drawText).
// Aktiv Grotesk must be loaded before canvas renders — use
// FontFace API or ensure CSS @font-face has loaded.
// ------------------------------------------------------------

export const FONTS = {
  display: {
    family: "'Aktiv Grotesk', -apple-system, sans-serif",
    weight: 300,
    // Canvas font strings
    title:    "300 28px 'Aktiv Grotesk', sans-serif",
    subtitle: "300 15px 'Aktiv Grotesk', sans-serif",
    label:    "300 12px 'Aktiv Grotesk', sans-serif",
  },
  mono: {
    family: "'JetBrains Mono', monospace",
    // Canvas font strings
    data:        "400 13px 'JetBrains Mono', monospace",
    dataLarge:   "400 22px 'JetBrains Mono', monospace",
    axis:        "400 11px 'JetBrains Mono', monospace",
    badge:       "400 9px 'JetBrains Mono', monospace",
    attribution: "400 10px 'JetBrains Mono', monospace",
  },
};

// ------------------------------------------------------------
// CHART CANVAS LAYOUT
// All measurements in pixels for a 1600×900 (16:9) canvas.
// ------------------------------------------------------------

export const CANVAS = {
  width:  1600,
  height: 900,
};

export const LAYOUT = {
  // Outer padding — breathing room from canvas edge
  pad: {
    top:    72,
    right:  80,
    bottom: 72,
    left:   80,
  },

  // Header block (title + subtitle + optional badge)
  header: {
    badgeHeight:    22,
    badgeMargin:    12,   // gap below badge before title
    titleLineHeight: 38,
    subtitleMargin: 10,   // gap between title and subtitle
    blockHeight:    110,  // total reserved height for header
  },

  // Chart plot area — computed from above, but exposed for overrides
  // Actual chart area starts at pad.top + header.blockHeight
  chartAreaTop() {
    return this.pad.top + this.header.blockHeight + 24;
  },
  chartAreaBottom() {
    return CANVAS.height - this.pad.bottom - ATTRIBUTION.height - 24;
  },
  chartAreaLeft() {
    return this.pad.left;
  },
  chartAreaRight() {
    return CANVAS.width - this.pad.right;
  },
  chartAreaWidth() {
    return this.chartAreaRight() - this.chartAreaLeft();
  },
  chartAreaHeight() {
    return this.chartAreaBottom() - this.chartAreaTop();
  },

  // Bar chart specifics
  bar: {
    maxBarWidth:     64,   // cap on individual bar width
    groupGap:        0.25, // gap between bars as fraction of bar width
    barRadius:       2,    // corner radius on bars
    labelPadding:    8,    // gap between bar top and value label
    axisPadding:    40,    // space reserved for y-axis labels on left
    categoryPadding: 24,   // space for category labels below axis
  },

  // Horizontal bar specifics
  hbar: {
    barHeight:      32,
    barGap:         14,
    labelWidth:    220,   // reserved width for category labels on left
    valuePadding:    8,   // gap between bar end and value label
  },

  // Donut specifics
  donut: {
    outerRadiusFraction: 0.38,  // as fraction of chart area height
    innerRadiusFraction: 0.22,
    legendLeft:          0.55,  // legend x as fraction of canvas width
    segmentGap:          0.02,  // gap between segments in radians
  },
};

// ------------------------------------------------------------
// ATTRIBUTION FOOTER
// Appears at the bottom of every chart.
// ------------------------------------------------------------

export const ATTRIBUTION = {
  height:   44,
  text:     "Tulane Freeman School of Business · Albert Lepage Center for Entrepreneurship & Innovation · LA.io",
  source:   "Louisiana Startup Report 2026 · mondayandpartners.com",
  dividerY: 16,   // distance from bottom of chart area to divider line
};

// ------------------------------------------------------------
// GRID LINES
// Horizontal reference lines behind bar/line charts.
// ------------------------------------------------------------

export const GRID = {
  count:      4,     // number of horizontal grid lines
  alpha:      0.35,  // opacity of grid lines (applied to palette.soft)
  lineWidth:  0.75,
};

// ------------------------------------------------------------
// ILLUSTRATION ACCENT
// Small generative geometry element used as a decorative mark
// in the chart — top-right corner, subtle.
// ------------------------------------------------------------

export const ILLUSTRATION = {
  enabled:  true,
  position: "top-right",   // top-right | top-left | bottom-right
  size:     120,            // diameter in pixels
  alpha:    0.12,           // overall opacity of the illustration
};

// ------------------------------------------------------------
// HELPER — get palette by key, fall back to indigo
// ------------------------------------------------------------

export function getPalette(key) {
  return PALETTES[key] || PALETTES[DEFAULT_PALETTE];
}

// ------------------------------------------------------------
// HELPER — list all palette keys and names for UI
// ------------------------------------------------------------

export function getPaletteOptions() {
  return Object.entries(PALETTES).map(([key, p]) => ({
    key,
    name: p.name,
    swatch: p.primary,
  }));
}
