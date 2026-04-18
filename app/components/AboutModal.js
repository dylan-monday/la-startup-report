"use client";

import { useEffect } from "react";

export default function AboutModal({ onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="about-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="about-modal" role="dialog" aria-modal="true" aria-label="About this report">

        <div className="about-modal-header">
          <div className="about-modal-badge">Louisiana Startup Report 2026</div>
          <h2 className="about-modal-title">About this report</h2>
          <button className="about-modal-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="about-modal-divider" />
        </div>

        <div className="about-modal-body">

          <div className="about-section">
            <div className="about-section-label">What this is</div>
            <p className="about-section-text">
              The Louisiana Startup Report is an annual survey of startup founders and operators
              across Greater New Orleans. Now in its seventh year, the 2026 report captures data
              from 112 respondents across Orleans, Jefferson, St. Tammany, and St. Bernard parishes,
              covering funding, hiring, AI adoption, revenue trends, and founder demographics.
              Beginning in 2026, the survey is expanding statewide across eight regions.
            </p>
          </div>

          <div className="about-section">
            <div className="about-section-label">How to use it</div>
            <p className="about-section-text">
              This interactive report is designed to be explored through conversation. Use the
              data assistant at the bottom of the page to ask questions in plain language — about
              specific industries, funding gaps, hiring plans, or any other dimension of the survey.
              The assistant has direct access to the full dataset and can generate charts you can
              download and share.
            </p>
          </div>

          <div className="about-section">
            <div className="about-section-label">Methodology</div>
            <p className="about-section-text">
              Responses were collected via an annual survey distributed to the Greater New Orleans
              startup community in late 2024 and early 2025. Participation was voluntary.
              Results reflect self-reported data from 112 respondents. Where anonymity is a concern,
              data is aggregated at the regional level and individual responses are not surfaced.
              The AI assistant does not identify individual companies or founders.
            </p>
          </div>

          <div className="about-section">
            <div className="about-section-label">Partners</div>
            <div className="about-partners">
              <div className="about-partner">
                <span className="about-partner-name">Albert Lepage Center for Entrepreneurship &amp; Innovation</span>
                <span className="about-partner-role">Tulane Freeman School of Business — research and data</span>
              </div>
              <div className="about-partner">
                <span className="about-partner-name">LA.io</span>
                <span className="about-partner-role">Louisiana&apos;s startup network — community and distribution</span>
              </div>
              <div className="about-partner">
                <span className="about-partner-name">Monday + Partners</span>
                <span className="about-partner-role">Design, development, and AI integration — <a className="about-contact-link" href="https://mondayandpartners.com" target="_blank" rel="noopener">mondayandpartners.com</a></span>
              </div>
            </div>
          </div>

          <div className="about-section">
            <div className="about-section-label">Data access</div>
            <p className="about-section-text">
              Researchers, journalists, and entrepreneurs can request access to the full anonymized
              dataset directly from Tulane. Use the &ldquo;Request data&rdquo; link in the nav, or ask
              the data assistant — it will surface the request form after extended use.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
