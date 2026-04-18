"use client";

import { useState, useEffect } from "react";

const INITIAL = {
  name: "",
  email: "",
  phone: "",
  company: "",
  use_case: "",
};

export default function DataRequestModal({ onClose }) {
  const [form, setForm] = useState(INITIAL);
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errors, setErrors] = useState({});

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function validate() {
    const e = {};
    if (!form.name.trim())     e.name     = "Required";
    if (!form.email.trim())    e.email    = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.company.trim())  e.company  = "Required";
    if (!form.use_case.trim()) e.use_case = "Required";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus("submitting");
    setErrors({});
    try {
      const res = await fetch("/api/data-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="data-request-modal" onClick={e => e.stopPropagation()}>

        <div className="drm-header">
          <div>
            <div className="drm-badge">Louisiana Startup Report 2026</div>
            <h2 className="drm-title">Request Raw Data Access</h2>
            <p className="drm-subtitle">
              The Tulane Lepage Center reviews all requests and provides access to qualified researchers, policymakers, and organizations.
            </p>
          </div>
          <button className="drm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {status === "success" ? (
          <div className="drm-success">
            <div className="drm-success-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 14L12 18L20 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="drm-success-title">Request submitted</h3>
            <p className="drm-success-body">
              The Tulane Lepage Center will review your request and follow up at {form.email}.
            </p>
            <button className="drm-submit-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="drm-form" onSubmit={handleSubmit} noValidate>
            <div className="drm-fields">
              <div className="drm-row">
                <Field label="Full name" error={errors.name} required>
                  <input
                    className={`drm-input ${errors.name ? "drm-input--error" : ""}`}
                    type="text"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={e => handleChange("name", e.target.value)}
                    disabled={status === "submitting"}
                  />
                </Field>
                <Field label="Organization" error={errors.company} required>
                  <input
                    className={`drm-input ${errors.company ? "drm-input--error" : ""}`}
                    type="text"
                    placeholder="Company or institution"
                    value={form.company}
                    onChange={e => handleChange("company", e.target.value)}
                    disabled={status === "submitting"}
                  />
                </Field>
              </div>
              <div className="drm-row">
                <Field label="Email" error={errors.email} required>
                  <input
                    className={`drm-input ${errors.email ? "drm-input--error" : ""}`}
                    type="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={e => handleChange("email", e.target.value)}
                    disabled={status === "submitting"}
                  />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <input
                    className="drm-input"
                    type="tel"
                    placeholder="Optional"
                    value={form.phone}
                    onChange={e => handleChange("phone", e.target.value)}
                    disabled={status === "submitting"}
                  />
                </Field>
              </div>
              <Field label="How will you use the data?" error={errors.use_case} required>
                <textarea
                  className={`drm-input drm-textarea ${errors.use_case ? "drm-input--error" : ""}`}
                  placeholder="Describe your research purpose, intended analysis, or how this data will inform your work..."
                  rows={4}
                  value={form.use_case}
                  onChange={e => handleChange("use_case", e.target.value)}
                  disabled={status === "submitting"}
                />
              </Field>
            </div>

            {status === "error" && (
              <p className="drm-error-msg">Something went wrong. Please try again or email lepage@tulane.edu directly.</p>
            )}

            <div className="drm-footer">
              <p className="drm-fine-print">
                Submitted to the Albert Lepage Center for Entrepreneurship &amp; Innovation at Tulane University.
              </p>
              <button
                className="drm-submit-btn"
                type="submit"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, required, children }) {
  return (
    <div className="drm-field">
      <label className="drm-label">
        {label}{required && <span className="drm-required">*</span>}
      </label>
      {children}
      {error && <span className="drm-field-error">{error}</span>}
    </div>
  );
}
