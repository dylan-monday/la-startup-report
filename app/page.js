"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import AnimatedBackground from "./components/AnimatedBackground";
import ChatDrawer from "./components/ChatDrawer";
import DesignPanel from "./components/DesignPanel";
import "./globals.css";

const DataRequestModal = dynamic(() => import("./components/DataRequestModal"), { ssr: false });
const AboutModal = dynamic(() => import("./components/AboutModal"), { ssr: false });

const NAV_LINKS = [
  { label: "Key Metrics", href: "#metrics" },
  { label: "Funding", href: "#funding" },
  { label: "Industries", href: "#industries" },
  { label: "AI Adoption", href: "#ai" },
  { label: "Workforce", href: "#workforce" },
];

export default function ReportPage() {
  const [scrolled, setScrolled] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleAskData() {
    const handle = document.querySelector(".drawer-handle");
    if (handle) handle.click();
  }

  return (
    <>
      <AnimatedBackground />

      {/* Sticky condensed header */}
      <div className={`sticky-header ${scrolled ? "sticky-header-visible" : ""}`}>
        <div className="sticky-header-inner">
          <div className="sticky-logo">
            <span className="sticky-logo-mono">LA</span>
            <span className="sticky-logo-text">Startup Report 2026</span>
          </div>
          <nav className="sticky-nav">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="sticky-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="sticky-actions">
            <button
              className="sticky-about-btn"
              onClick={() => setAboutModalOpen(true)}
            >
              About
            </button>
            <button
              className="sticky-data-btn"
              onClick={() => setDataModalOpen(true)}
            >
              Request data
            </button>
            <button className="sticky-ask-btn" onClick={handleAskData}>
              Ask the data
            </button>
          </div>
        </div>
      </div>

      {/* Report content */}
      <div className="content-layer">

        <div className="hero">
          <div className="hero-badge">Louisiana Startup Report 2026</div>
          <h1>
            The state of <em>innovation</em> in Louisiana
          </h1>
          <p className="hero-lead">
            An annual report on startup formation, venture funding, and
            entrepreneurial growth across Louisiana. A collaboration between
            Tulane University and LA.io.
          </p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={handleAskData}>
              Ask the data
            </button>
            <button className="btn-secondary" onClick={() => setDataModalOpen(true)}>
              Request raw data
            </button>
          </div>
        </div>

        <section id="metrics" className="report-section">
          <h2 className="section-label">Key Metrics — 2025 GNO</h2>
          <h3 className="section-title">Greater New Orleans startup cohort</h3>
          <p className="section-text">
            112 respondents from Orleans, Jefferson, St. Tammany, and St.
            Bernard parishes. The 7th annual survey, now expanding statewide
            for 2026.
          </p>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-number"><span className="accent">112</span></div>
              <div className="stat-label">Survey respondents</div>
            </div>
            <div className="stat-card">
              <div className="stat-number"><span className="accent">7</span></div>
              <div className="stat-label">Years of data</div>
            </div>
            <div className="stat-card">
              <div className="stat-number"><span className="accent">69</span>%</div>
              <div className="stat-label">Using AI in operations</div>
            </div>
            <div className="stat-card">
              <div className="stat-number"><span className="accent">8</span></div>
              <div className="stat-label">Regions in 2026</div>
            </div>
          </div>
        </section>

        <section id="funding" className="report-section">
          <h2 className="section-label">Funding</h2>
          <h3 className="section-title">How GNO startups are raising capital</h3>
          <p className="section-text">
            28 companies attempted to access venture capital in 2025. Only 10
            succeeded — a gap of 18, the largest of any funding source in the
            survey. Ask the data assistant to break this down further.
          </p>
        </section>

        <section id="industries" className="report-section">
          <h2 className="section-label">Industries</h2>
          <h3 className="section-title">Who's building in Greater New Orleans</h3>
          <p className="section-text">
            Software leads the cohort, followed by Healthcare, Food & Beverage,
            and Professional Services. Ask the data assistant for a full
            industry breakdown with counts.
          </p>
        </section>

        <section id="ai" className="report-section">
          <h2 className="section-label">AI Adoption</h2>
          <h3 className="section-title">Artificial intelligence in the startup cohort</h3>
          <p className="section-text">
            69% of the 93 respondents who answered the AI question reported a
            positive impact on productivity. Ask the assistant to break down
            which operational areas are seeing the most change.
          </p>
        </section>

        <section id="workforce" className="report-section">
          <h2 className="section-label">Workforce</h2>
          <h3 className="section-title">Hiring trends and team composition</h3>
          <p className="section-text">
            Ask the data assistant about full-time vs. part-time ratios,
            compensation structures, and how hiring intent has shifted year
            over year across the cohort.
          </p>
        </section>

      </div>

      <ChatDrawer onRequestData={() => setDataModalOpen(true)} />
      <DesignPanel />

      {dataModalOpen && (
        <DataRequestModal onClose={() => setDataModalOpen(false)} />
      )}

      {aboutModalOpen && (
        <AboutModal onClose={() => setAboutModalOpen(false)} />
      )}
    </>
  );
}
