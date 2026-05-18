# LA.io Proposal Inputs — Cost Structure, Hours, Ongoing Ops

Line-item inputs for drafting the LA.io proposal. All figures derived from the April 2026 audit (`01-audit-findings.md`) and fix plan (`02-fixes-and-priorities.md`). Placeholder hourly rate shown as `$X/hr` — replace with billable rate.

Paired with: audit findings (technical appendix) and fix plan (scope justification).

---

## Context for the proposal writer

**Existing M+P proposal:** $50,320 design + development, valid through 2026-04-30.

**What's in this document:**
- Additional engineering scope surfaced by the production-readiness audit (launch-hardening work)
- Development-phase tooling costs during build
- Ongoing operations: infrastructure + managed services
- Year-one total investment ranges

Clarify with the M+P proposal team whether these hours are *included in* the $50,320 scope or are a separate line item. The audit-surfaced work (~96 hrs) is distinct from typical feature development — it's the engineering required to take the existing MVP to production safely.

---

## 1. Development scope — one-time engineering

Breakdown from `02-fixes-and-priorities.md`, consolidated into client-facing categories.

| Workstream | Hours | What it delivers |
|---|---|---|
| Security hardening | 12 | Rate limiting, abuse prevention, CSRF/CORS/body validation, Turnstile, spend circuit breaker, admin auth, analytics endpoint protection |
| Privacy engineering (k-anonymity) | 8 | Central suppression wrapper across all 8 tools, bucket-level floors, sensitive-field removal, narrowing-budget enforcement, statewide-readiness hardening |
| Persistent data infrastructure | 14 | Supabase Auth + magic link + middleware + allow-list; Supabase Postgres analytics; Resend email pipeline with audit log; data-request persistence |
| Accessibility + performance polish | 8 | WCAG AA compliance pass (aria-live, focus trap, focus-visible, reduced-motion), frontend performance (rAF gating, image optimization, font preloading, bundle trimming) |
| Admin page refactor | 8 | Split 1,073-line monolith into maintainable component tree; `useAnalytics` hook; server-side pagination; replaces inline CSS |
| Observability + alerting | 4 | Axiom structured logs, cost-spike alerts, error-rate alerts, usage dashboards |
| Statewide dataset migration | 14 | Schema design, SQL port of JS tools, region-awareness, ingestion pipeline with PII scrub |
| Integration testing + UAT | 12 | 20-question evaluation set, security regression tests, privacy audit with Tulane/IRB contact, launch-readiness review |
| Documentation + handoff | 6 | Operations runbook, incident response, content-update procedures, model-swap procedure |
| Haiku evaluation (optional) | 2 | Model cost-optimization study |
| Contingency buffer (15%) | ~12 | Unknown-unknowns; almost always consumed |
| **Development subtotal** | **~100 hrs** | |

Illustrative cost at common rates:

| Rate | Total |
|---|---|
| $100/hr | $10,000 |
| $125/hr | $12,500 |
| $150/hr | $15,000 |
| $175/hr | $17,500 |
| $200/hr | $20,000 |

**Excludes Phase 6 (PDF report RAG), which is a separate scope item at 40-80 hours if funded.**

---

## 2. Development-phase tooling (one-time, build duration)

Costs incurred during active development before launch. Assumes 6-8 weeks of active build plus 2-3 weeks of refinement.

| Service | Monthly rate | Months on | Dev-phase total |
|---|---|---|---|
| Anthropic API — development testing (~50k test turns at cached rate) | varies | 2 | $200-$400 |
| Vercel Pro (Preview + Production) | $20/seat | 2 | $40 |
| Supabase Pro (dev project + production setup) | $25 | 2 | $50 |
| Upstash Redis | $0 | — | $0 (free tier) |
| Resend (development + small pilot) | $0 | — | $0 (free tier) |
| Axiom (log ingestion during dev) | $0 | — | $0 (free tier) |
| Cloudflare Turnstile | $0 | — | $0 |
| Domain registration + DNS (first year) | — | — | $15-$30 |
| Misc dev tooling (Claude Code / IDE subscriptions) | $20-$40 | 2 | $40-$80 |
| **Dev-phase tooling subtotal** | | | **~$350-$600** |

Small relative to development labor, but worth itemizing in the proposal to show cost transparency and prevent scope confusion.

---

## 3. Ongoing operations — monthly recurring

### 3a. Infrastructure & services

| Service | Purpose | Launch-scale monthly |
|---|---|---|
| Vercel Pro (1 seat + Observability+) | Hosting, CDN, function runtime, observability | $20-$30 |
| Supabase Pro | Postgres database, authentication, backups, Point-in-Time Recovery | $25 |
| Upstash Redis | Rate limiting, session state, analytics buffering | $0-$10 |
| Anthropic API — production (Sonnet 4.6 + prompt caching) | Chatbot inference | $350-$1,000 |
| Resend | Transactional email (data requests, admin notifications) | $0 (free tier) → $20 |
| Axiom | Logs, metrics, alerting | $0 (free tier) → $25 |
| Cloudflare Turnstile | Bot/abuse prevention | $0 |
| Domain renewal (prorated monthly) | `.com`/`.org` equivalent | ~$2 |
| Claude Code / dev tooling (ongoing) | Dev productivity | $20-$40 |
| **Monthly infrastructure total** | | **~$420-$1,150** |

### 3b. Usage-based scenarios

Cost brackets for the LA.io executive summary:

| Scenario | Monthly usage | Monthly cost | Annual |
|---|---|---|---|
| **Conservative** — launch without traffic spike | ~5k chat turns | ~$420 | **$5,040** |
| **Expected** — 1,000 users actively engaging | ~25k chat turns | ~$700 | **$8,400** |
| **Growth** — 2,500+ users, growing adoption | ~60k chat turns | ~$1,150 | **$13,800** |

Assumptions:
- Prompt caching enabled (cuts Anthropic input cost by ~85% on the static prefix)
- Sonnet 4.6 (with Haiku 4.5 as potential downgrade if evaluation succeeds — could shave $300-$500/month)
- 5 sessions/user/month, 5 turns/session average
- Rate limits active, circuit breakers enforced

### 3c. Abuse resistance

Hard ceilings built into the architecture:

| Layer | Ceiling | Behavior at ceiling |
|---|---|---|
| Anthropic workspace spend | $1,500/month (configurable) | API returns 429; no more billable calls |
| Application circuit breaker | $1,200/month cumulative | Unauthenticated users get 503 until next day |
| Per-IP rate limit | 10 msg/min, 200 msg/day | Return 429 with retry-after header |
| Per-session limit | 25 queries | Client soft-cap + server enforcement |
| Per-message size | 8KB content, 32 messages/request | Return 400 |

**Documented worst case without these safeguards:** $500-$2,500/day from a single attacker.
**Documented worst case with safeguards:** ~$6/day per attacker IP; circuit breaker triggers within hours.

---

## 4. Managed services / ongoing maintenance time

Post-launch operational time. Required for any production LLM application — not optional.

| Activity | Frequency | Hours/month |
|---|---|---|
| Monitoring & alert triage | Continuous + weekly review | 2-3 |
| Content / data updates (new survey data, corrections) | Quarterly + ad hoc | 2-4 |
| Prompt tuning based on flagged conversations | Monthly QA review | 2-3 |
| Model / dependency updates (new Anthropic releases, security patches) | Monthly | 1-2 |
| Incident response (abuse, outages, cost spikes) | As needed | 2-4 avg |
| Usage / analytics reporting to stakeholders | Monthly | 1-2 |
| API key rotation + credential hygiene | Quarterly | 1 (quarterly) |
| **Subtotal monthly ongoing** | | **~10-18 hrs/month** |

Illustrative annual cost at common rates:

| Rate | Monthly (14 hrs avg) | Annual |
|---|---|---|
| $100/hr | $1,400 | $16,800 |
| $125/hr | $1,750 | $21,000 |
| $150/hr | $2,100 | $25,200 |
| $175/hr | $2,450 | $29,400 |
| $200/hr | $2,800 | $33,600 |

---

## 5. Year-one total investment

Combined infrastructure + managed services. Development labor is separate (section 1).

| Scenario | Infra (annual) | Managed services (annual @ $150/hr) | Year-1 operational total |
|---|---|---|---|
| **Conservative** | $5,040 | $16,800 (10 hrs/mo) | **~$21,800** |
| **Expected** | $8,400 | $25,200 (14 hrs/mo) | **~$33,600** |
| **Growth** | $13,800 | $32,400 (18 hrs/mo) | **~$46,200** |

Plus one-time development (section 1): ~$10,000-$20,000 at $100-$200/hr.

**Total year-one engagement (development + first-year operational):**

| Scenario | Development | Operational | **Total Year 1** |
|---|---|---|---|
| Conservative | $12,500 @ $125/hr | $21,800 | **~$34,300** |
| Expected | $15,000 @ $150/hr | $33,600 | **~$48,600** |
| Growth | $17,500 @ $175/hr | $46,200 | **~$63,700** |

These are launch-scale numbers. At scale below 1,000 active users the operational costs drop accordingly (Anthropic dominates and scales with usage).

---

## 6. Year-two and beyond

Once built, ongoing costs stabilize:

- Infrastructure: same as year 1 brackets ($5-$14k/yr)
- Managed services: drops to ~8-12 hrs/month as prompts stabilize and incidents become rarer (~$12-$18k/yr at $125-$150/hr)
- New features (e.g., PDF RAG, new dataset releases): quoted separately as they arise

**Year-2 steady state: ~$20-$30k/year operational** for a stable 1,000-user chatbot with no major feature additions.

---

## 7. Executive summary language for the proposal

Drop-in text for the proposal's executive summary section. Adjust voice to match M+P's standard.

> **Chatbot MVP — Production Readiness**
>
> The LA Startup Report chatbot has been built as a demonstrable MVP and is technically functional today. A comprehensive production-readiness audit identified the specific engineering work required to safely serve a public audience of ~1,000 users.
>
> **Development scope:** Approximately 100 hours of additional engineering — covering security hardening (rate limiting, abuse prevention, admin authentication), privacy engineering (k-anonymity enforcement across all query paths), persistent data infrastructure (authenticated analytics, data-request pipeline), accessibility compliance (WCAG AA), observability, and dataset migration from static JSON to a secure database.
>
> **Operating infrastructure:** $420-$1,150 per month for the full production stack (Vercel Pro hosting, Supabase Pro database + auth, Anthropic API with prompt caching, rate-limiting via Upstash, bot prevention via Cloudflare Turnstile, observability via Axiom, transactional email via Resend). Costs scale with adoption; free tiers carry the conservative scenario.
>
> **Cost controls:** Hard spending limits are enforced at multiple layers — Anthropic workspace cap ($1,500/month ceiling), application-level circuit breaker ($1,200/month trigger that gracefully degrades public access), per-IP rate limits (10 messages/minute, 200/day), per-session query caps (25 queries). Documented worst-case abuse without safeguards is $500-$2,500/day; with safeguards, effectively bounded.
>
> **Ongoing operations:** ~14 hours/month for monitoring, content updates, prompt tuning, and incident response. This is operating overhead, not development — required for any production LLM application.
>
> **Year-one total investment range:**
> - Conservative adoption: ~$34,000 (development + infrastructure + first-year ops)
> - Expected adoption: ~$49,000
> - Growth adoption: ~$64,000
>
> Year-two and beyond stabilize at approximately $20-$30k/year operational, assuming no major new features.
>
> **Privacy assurances:** The statewide dataset migration includes a k-anonymity enforcement pass (minimum sample size of 10 respondents per returned query, bucket-level suppression on distributions, removal of re-identification vectors including ZIP code and free-text fields, optional differential-privacy-style noise), enforced at the SQL layer via Supabase row-level security. Tulane IRB/legal review of the privacy safeguards is recommended before statewide data lands in the system.

---

## 8. Assumptions to confirm with LA.io / M+P

These shape the numbers above. Revisit if any change:

1. **Audience size:** ~1,000 launch users, modest growth. If targeting 5,000+ at launch, usage-based Anthropic cost scales ~3-4×.
2. **Hourly rate:** placeholder `$X/hr` throughout — replace with billable rate before sending.
3. **PDF RAG scope:** treated as separate (Phase 6 in fix plan), not included in core scope. If the interactive web report needs "ask the full report prose," that's +40-80 hours and +$5-$20/month.
4. **Who pays for services:** assumes client-owned accounts (Vercel, Supabase, Anthropic, Upstash, Resend, Axiom, Cloudflare). M+P operates under client's billing. Alternative is M+P-owned accounts with usage passed through.
5. **Data licensing:** Louisiana startup data is public, per owner. Confirm any derivative-work restrictions before ingesting at statewide scale.
6. **Launch timeline:** fix plan assumes ~2-3 weeks for Phases 1-3 (36 hrs of work, real-time depends on availability). Compress if needed with paired development.
7. **SSO requirement:** assumes Supabase Auth magic link is sufficient. If Tulane IT requires SAML SSO from their IdP, add ~8-16 hours (Supabase Pro supports SAML; WorkOS is a cleaner alternative at +$125-$250/month).

---

## 9. Not in scope (flag for later conversations)

- PDF report RAG pipeline (Phase 6, separate scope)
- Multi-language support (Spanish for Louisiana audiences — potentially relevant)
- Mobile app wrappers
- Custom analytics dashboards beyond the current admin view
- Integration with Tulane/LA.io single sign-on systems
- Content moderation queue UI for reviewing flagged conversations
- A/B testing infrastructure for prompt iterations
- Automated weekly digest emails to stakeholders
- Public API for third-party access to aggregated insights

Any of these can be quoted individually if prioritized.

---

## Files referenced in this proposal

All from `chatbot/`:

- `app/api/chat/route.js` — main chatbot endpoint
- `app/api/analytics/route.js` — admin analytics (needs auth)
- `app/api/data-request/route.js` — data-access form endpoint
- `app/admin/page.js` — admin dashboard
- `lib/data-tools.js` — query tools + k-anonymity layer
- `lib/system-prompt.js` — chatbot instructions + style rules
- `lib/analytics.js` — in-memory analytics store (to be replaced)
- `data/gno-2025.json` — MVP dataset (112 respondents, Greater New Orleans)

Technical details, severity rankings, and code-level citations: `01-audit-findings.md`.
Full fix plan with time estimates per task: `02-fixes-and-priorities.md`.
