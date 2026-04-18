"use client";

import { useEffect } from "react";
import ChartBuilder from "./ChartBuilder";

export default function ChartModal({ config, onClose }) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div
        className="chart-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <ChartBuilder config={config} onClose={onClose} />
      </div>
    </div>
  );
}
