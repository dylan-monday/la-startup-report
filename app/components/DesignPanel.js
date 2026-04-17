"use client";

import { useState, useEffect, useCallback } from "react";

// Design tokens that map to CSS custom properties
const DESIGN_TOKENS = [
  {
    group: "Colors",
    tokens: [
      { prop: "--dark", label: "Dark / Primary", type: "color", default: "#03243c" },
      { prop: "--bg", label: "Background", type: "color", default: "#f3f5f6" },
      { prop: "--accent", label: "Accent", type: "color", default: "#0a5e8a" },
      { prop: "--accent-bright", label: "Accent Bright", type: "color", default: "#0c7bb3" },
      { prop: "--text", label: "Text", type: "color", default: "#03243c" },
      { prop: "--text-mid", label: "Text Mid", type: "color", default: "#3d6070" },
      { prop: "--text-light", label: "Text Light", type: "color", default: "#7a9aaa" },
      { prop: "--border", label: "Border", type: "color", default: "#d0d8dc" },
      { prop: "--border-light", label: "Border Light", type: "color", default: "#e4e9eb" },
    ],
  },
  {
    group: "Drawer",
    tokens: [
      { prop: "--drawer-blur", label: "Backdrop Blur", type: "range", min: 0, max: 40, step: 1, unit: "px", default: 20 },
      { prop: "--drawer-opacity", label: "Glass Opacity", type: "range", min: 0, max: 1, step: 0.05, unit: "", default: 0.88 },
      { prop: "--drawer-radius", label: "Corner Radius", type: "range", min: 0, max: 32, step: 1, unit: "px", default: 16 },
      { prop: "--drawer-max-height", label: "Max Height", type: "range", min: 40, max: 95, step: 1, unit: "vh", default: 85 },
    ],
  },
  {
    group: "Typography",
    tokens: [
      { prop: "--body-weight", label: "Body Weight", type: "range", min: 100, max: 700, step: 100, unit: "", default: 300 },
      { prop: "--heading-weight", label: "Heading Weight", type: "range", min: 100, max: 700, step: 100, unit: "", default: 300 },
      { prop: "--msg-font-size", label: "Message Size", type: "range", min: 12, max: 18, step: 1, unit: "px", default: 14 },
      { prop: "--msg-line-height", label: "Message Line Height", type: "range", min: 1.2, max: 2.0, step: 0.1, unit: "", default: 1.7 },
    ],
  },
  {
    group: "Spacing",
    tokens: [
      { prop: "--msg-padding-x", label: "Message Padding H", type: "range", min: 8, max: 32, step: 2, unit: "px", default: 20 },
      { prop: "--msg-padding-y", label: "Message Padding V", type: "range", min: 8, max: 24, step: 2, unit: "px", default: 16 },
      { prop: "--msg-radius", label: "Message Radius", type: "range", min: 0, max: 24, step: 1, unit: "px", default: 12 },
      { prop: "--msg-max-width", label: "Message Max Width %", type: "range", min: 60, max: 100, step: 5, unit: "%", default: 85 },
    ],
  },
  {
    group: "User Message",
    tokens: [
      { prop: "--msg-user-bg", label: "Background", type: "color", default: "#03243c" },
      { prop: "--msg-user-color", label: "Text Color", type: "color", default: "#c8dce8" },
    ],
  },
  {
    group: "Assistant Message",
    tokens: [
      { prop: "--msg-assistant-bg", label: "Background", type: "color", default: "#ffffff" },
      { prop: "--msg-assistant-color", label: "Text Color", type: "color", default: "#3d6070" },
      { prop: "--msg-assistant-border", label: "Border Color", type: "color", default: "#e4e9eb" },
    ],
  },
];

export default function DesignPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState({});

  // Initialize values from defaults
  useEffect(() => {
    const initial = {};
    DESIGN_TOKENS.forEach((group) => {
      group.tokens.forEach((token) => {
        initial[token.prop] = token.default;
      });
    });
    setValues(initial);
  }, []);

  // Listen for keyboard shortcut
  useEffect(() => {
    function handleKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Apply CSS custom properties to :root
  const applyValues = useCallback((vals) => {
    const root = document.documentElement;
    Object.entries(vals).forEach(([prop, value]) => {
      const token = findToken(prop);
      if (!token) return;
      if (token.type === "color") {
        root.style.setProperty(prop, value);
      } else {
        root.style.setProperty(prop, value + (token.unit || ""));
      }
    });
  }, []);

  useEffect(() => {
    if (Object.keys(values).length > 0) {
      applyValues(values);
    }
  }, [values, applyValues]);

  function findToken(prop) {
    for (const group of DESIGN_TOKENS) {
      for (const token of group.tokens) {
        if (token.prop === prop) return token;
      }
    }
    return null;
  }

  function updateValue(prop, value) {
    setValues((prev) => {
      const next = { ...prev, [prop]: value };
      return next;
    });
  }

  function resetAll() {
    const initial = {};
    DESIGN_TOKENS.forEach((group) => {
      group.tokens.forEach((token) => {
        initial[token.prop] = token.default;
      });
    });
    setValues(initial);
  }

  function copyCSS() {
    let css = ":root {\n";
    Object.entries(values).forEach(([prop, value]) => {
      const token = findToken(prop);
      if (!token) return;
      const unit = token.type === "color" ? "" : token.unit || "";
      css += `  ${prop}: ${value}${unit};\n`;
    });
    css += "}";
    navigator.clipboard.writeText(css).then(() => {
      alert("CSS copied to clipboard");
    });
  }

  if (!isOpen) return null;

  return (
    <div className="design-panel">
      <div className="design-panel-header">
        <span className="design-panel-title">Design</span>
        <div className="design-panel-actions">
          <button className="design-panel-btn" onClick={copyCSS}>
            Copy CSS
          </button>
          <button className="design-panel-btn" onClick={resetAll}>
            Reset
          </button>
          <button
            className="design-panel-close"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="design-panel-body">
        {DESIGN_TOKENS.map((group) => (
          <div key={group.group} className="design-group">
            <div className="design-group-label">{group.group}</div>
            {group.tokens.map((token) => (
              <div key={token.prop} className="design-row">
                <label className="design-label">{token.label}</label>
                {token.type === "color" ? (
                  <div className="design-color-wrap">
                    <input
                      type="color"
                      className="design-color"
                      value={values[token.prop] || token.default}
                      onChange={(e) => updateValue(token.prop, e.target.value)}
                    />
                    <span className="design-value">
                      {values[token.prop] || token.default}
                    </span>
                  </div>
                ) : (
                  <div className="design-range-wrap">
                    <input
                      type="range"
                      className="design-range"
                      min={token.min}
                      max={token.max}
                      step={token.step}
                      value={values[token.prop] ?? token.default}
                      onChange={(e) =>
                        updateValue(token.prop, parseFloat(e.target.value))
                      }
                    />
                    <span className="design-value">
                      {values[token.prop] ?? token.default}
                      {token.unit}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
