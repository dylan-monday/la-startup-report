import fs from "fs";
import path from "path";

let _data = null;

function loadData() {
  if (_data) return _data;
  const raw = fs.readFileSync(
    path.join(process.cwd(), "data", "gno-2025.json"),
    "utf-8"
  );
  _data = JSON.parse(raw);
  return _data;
}

// ============================================================
// PRIVACY / ACCURACY GUARD
// Suppress results derived from fewer than MIN_CELL_SIZE
// respondents to protect anonymity and statistical integrity.
// ============================================================
const MIN_CELL_SIZE = 10;

// --- Field metadata for Claude ---

const FIELD_INFO = {
  // Company profile
  year_founded:             { type: "number",   desc: "Year company was founded (2009-2025)" },
  org_type:                 { type: "category", desc: "LLC, C-Corp, S-Corp, etc." },
  state_of_incorporation:   { type: "category", desc: "State of incorporation" },
  industry:                 { type: "multi",    desc: "Primary industry (multi-select). Values: Software, Healthcare, Food and beverage, Media, Legal and consulting, Construction Tech, Beauty, Education, Manufacturing, Marketing, Retail, etc." },
  industry_other_text:      { type: "text",     desc: "Free-text other industry description (32 responses)" },
  products_or_services:     { type: "category", desc: "Products (includes apps & software), Services, or Both" },
  customer_types:           { type: "multi",    desc: "Customer segments: Consumers, Small & Medium Size Business, Large Businesses/Corporations, Government, Non-Profit" },
  special_designations:     { type: "multi",    desc: "Official business designations: Women-Owned, Minority-Owned, Veteran-Owned, LGBTQ+-Owned, Disability-Owned, None of the above. 112/112 responses." },
  plan_sales_outside_gno:   { type: "category", desc: "Does company plan to sell outside Greater New Orleans? Yes/No. 112/112 responses." },
  has_board:                { type: "category", desc: "Has formal board of directors: Yes or No. 112/112 responses." },
  board_size:               { type: "number",   desc: "Number of board members (30 responses)" },
  has_exit_strategy:        { type: "category", desc: "Has a defined exit strategy: Yes, No, Not yet but planning to. 109/112 responses." },

  // Geography & location
  zip_code:                 { type: "category", desc: "Company zip code" },
  parish:                   { type: "category", desc: "Parish: Orleans, Jefferson, St. Tammany, St. Bernard, Other" },
  is_hq:                    { type: "category", desc: "Is this the company HQ: Yes/No. 112/112 responses." },
  workspace_type:           { type: "category", desc: "Home Office, Leased Commercial Space, Co-Working Space, Owned Commercial Space, Sub-leased Commercial Space. 112/112 responses." },
  time_at_location:         { type: "category", desc: "How long at current location: < 1 year, 1-2 years, 3-5 years, 5+ years. 112/112 responses." },
  move_plans:               { type: "category", desc: "Plans to move/expand/reduce/stay. 112/112 responses." },
  will_stay_in_gno:         { type: "category", desc: "Plans to remain in Greater New Orleans: Yes, Probably yes, Unsure, Probably no, No (32 responses)" },
  square_footage:           { type: "category", desc: "Space occupied in SF (bucketed, 40 responses)" },
  lease_duration:           { type: "category", desc: "Length of current lease (31 responses)" },

  // Funding
  funding_attempted:        { type: "multi",    desc: "Funding sources attempted: Bootstrapping, Credit Card Debt, Friends & Family, Savings, Angel Investment, Venture Capital, Convertible Debt, SBA Backed Bank Loan, Traditional Bank Loans, Accelerator / Incubator, Cash Awards, Research Grants, CDFI Fund, Crowdfunding / Presales, Crowdfunding for Equity, Factoring, None. 102/112 responses." },
  funding_utilized:         { type: "multi",    desc: "Funding sources successfully utilized (same options). 101/112 responses." },
  funding_utilized_past_12mo: { type: "multi",  desc: "Funding sources used in past 12 months. 91/112 responses." },
  capital_source_geography: { type: "category", desc: "Where funding came from geographically (29 responses)" },
  pct_capital_from_gno:     { type: "category", desc: "Percentage of capital from GNO investors (18 responses — use with caution, low n)" },
  investment_capital_raised: { type: "category", desc: "Total capital raised (bucketed): $0-$50K through $10M+. 27 responses." },
  capital_raised_past_12mo: { type: "category", desc: "Capital raised in past 12 months (bucketed, 18 responses — low n)" },
  funding_rounds:           { type: "category", desc: "Number of funding rounds (27 responses)" },
  repeat_investors:         { type: "category", desc: "Has repeat investors: Yes/No (14 responses — low n)" },
  plan_to_raise:            { type: "category", desc: "Plans to raise capital: Yes, No, Maybe. 107/112 responses." },

  // Revenue & margins (bucketed by year)
  revenue_2020:             { type: "category", desc: "2020 gross revenue bucket (77 responses)" },
  revenue_2021:             { type: "category", desc: "2021 gross revenue bucket (79 responses)" },
  revenue_2022:             { type: "category", desc: "2022 gross revenue bucket (81 responses)" },
  revenue_2023:             { type: "category", desc: "2023 gross revenue bucket (82 responses)" },
  revenue_2024:             { type: "category", desc: "2024 gross revenue bucket (85 responses)" },
  revenue_2025_est:         { type: "category", desc: "2025 estimated gross revenue bucket (85 responses)" },
  margin_2020:              { type: "category", desc: "2020 gross margin % bucket (73 responses)" },
  margin_2021:              { type: "category", desc: "2021 gross margin % bucket (75 responses)" },
  margin_2022:              { type: "category", desc: "2022 gross margin % bucket (77 responses)" },
  margin_2023:              { type: "category", desc: "2023 gross margin % bucket (77 responses)" },
  margin_2024:              { type: "category", desc: "2024 gross margin % bucket (79 responses)" },
  margin_2025_est:          { type: "category", desc: "2025 estimated gross margin % bucket (76 responses)" },
  pct_public_sector_revenue: { type: "category", desc: "Percentage of revenue from public sector clients (93 responses)" },

  // Technology & AI
  tech_biggest_opportunity:     { type: "category", desc: "Biggest tech opportunity: Generative AI, AI/ML, Robotics & Automation, Cloud, VR/AR, IoT, Blockchain, Other. 93 responses." },
  tech_biggest_threat:          { type: "category", desc: "Biggest tech threat (same options). 93 responses." },
  tech_largest_long_term_impact:{ type: "category", desc: "Largest long-term tech impact (same options). 93 responses." },
  ai_impact:                    { type: "multi",    desc: "How AI impacted business: Improved productivity, Expanded market, Decreased costs, Increased sales, Increased contract value, Improved talent, Increased competition, Degraded talent, Decreased contract value, Decreased competition. 93 responses." },
  critical_tech_infrastructure: { type: "multi",    desc: "Critical technology infrastructure the company depends on. 93 responses." },
  marketing_channels:           { type: "multi",    desc: "Marketing channels used: Social media, Email, Referrals, Paid ads, Events, Content/SEO, PR, etc. 93 responses." },

  // Workforce
  ft_employees:         { type: "number",   desc: "Full-time salaried employees. 93 responses." },
  pt_employees:         { type: "number",   desc: "Part-time / contract / hourly employees. 93 responses." },
  founder_salary:       { type: "category", desc: "Founder salary range (bucketed). 81 responses." },
  employee_avg_salary:  { type: "category", desc: "Average employee salary (bucketed). 60 responses." },
  hourly_rate:          { type: "category", desc: "Hourly contractor rate (bucketed, 58 responses)" },
  plan_to_hire:         { type: "category", desc: "Plans to hire: Yes, No, Maybe. 89 responses." },
  planned_hires_ft:     { type: "number",   desc: "Number of planned full-time hires (41 responses)" },
  planned_hires_pt:     { type: "number",   desc: "Number of planned part-time hires (32 responses)" },
  benefits_offered:     { type: "multi",    desc: "Employee benefits offered: Medical, Remote Work, PTO, Dental, Vision, 401K, etc. 52 responses." },
  external_service_providers: { type: "multi", desc: "External service providers used: Accounting, Legal, HR, Marketing, IT, etc. 74 responses." },

  // Workforce demographics
  total_women:      { type: "number",   desc: "Total women employees (including founders). 74 responses." },
  total_bipoc:      { type: "number",   desc: "Total BIPOC employees (including founders). 65 responses." },
  total_veteran:    { type: "number",   desc: "Total veteran employees (including founders). 60 responses." },
  total_age_18_35:  { type: "number",   desc: "Total employees aged 18-35. 68 responses." },
  total_age_36_50:  { type: "number",   desc: "Total employees aged 36-50. 66 responses." },
  total_age_51plus: { type: "number",   desc: "Total employees aged 51+. 65 responses." },

  // Founder demographics
  founder1_gender:    { type: "category", desc: "Primary founder gender. 104 responses." },
  founder1_race:      { type: "category", desc: "Primary founder race/ethnicity. 102 responses." },
  founder1_education: { type: "category", desc: "Primary founder education level. 104 responses." },
  founder1_veteran:   { type: "category", desc: "Primary founder veteran status. 106 responses." },
  founder2_gender:    { type: "category", desc: "Co-founder gender (31 responses — only companies with 2+ founders)" },
  founder2_race:      { type: "category", desc: "Co-founder race/ethnicity (28 responses)" },
  founder2_education: { type: "category", desc: "Co-founder education level (31 responses)" },
  founder2_veteran:   { type: "category", desc: "Co-founder veteran status (33 responses)" },
};

// --- Tool definitions for Claude ---

export const toolDefinitions = [
  {
    name: "count_respondents",
    description: "Count respondents, optionally filtered. Use for 'how many companies...' questions. For multi-select fields, filter matches if the respondent selected that value.",
    input_schema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Key-value filters. For multi-select fields, matches if the value is in the array.",
          additionalProperties: { type: "string" }
        }
      }
    }
  },
  {
    name: "get_distribution",
    description: "Get the distribution of values for a field, optionally filtered. Returns counts and percentages. IMPORTANT: always check the responding_count (not filtered_count) — many fields have partial responses. If responding_count < 10, treat the result as statistically unreliable. The pct values are of responding_count, not total respondents.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", description: "The field to get distribution for" },
        filters: {
          type: "object",
          description: "Optional filters",
          additionalProperties: { type: "string" }
        },
        limit: { type: "number", description: "Max categories to return (default 20, sorted by count desc)" }
      },
      required: ["field"]
    }
  },
  {
    name: "cross_tabulate",
    description: "Cross-tabulate two fields. Returns counts. Cells with fewer than 10 respondents are suppressed for privacy. Use for 'how does X break down by Y' questions. Avoid using two multi-select fields together.",
    input_schema: {
      type: "object",
      properties: {
        field_a: { type: "string", description: "Row field" },
        field_b: { type: "string", description: "Column field" },
        filters: {
          type: "object",
          description: "Optional filters",
          additionalProperties: { type: "string" }
        }
      },
      required: ["field_a", "field_b"]
    }
  },
  {
    name: "get_numeric_stats",
    description: "Statistics (mean, median, min, max) for numeric fields: ft_employees, pt_employees, total_women, total_bipoc, total_veteran, total_age_18_35, total_age_36_50, total_age_51plus, year_founded, board_size, planned_hires_ft, planned_hires_pt. Results with n < 10 are flagged as unreliable.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", description: "Numeric field name" },
        filters: {
          type: "object",
          description: "Optional filters",
          additionalProperties: { type: "string" }
        }
      },
      required: ["field"]
    }
  },
  {
    name: "analyze_funding_gaps",
    description: "Compare funding sources attempted vs. utilized to show gaps. Optionally filtered.",
    input_schema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional filters",
          additionalProperties: { type: "string" }
        }
      }
    }
  },
  {
    name: "get_revenue_trajectory",
    description: "Show how revenue (and optionally margin) distribution changed year over year (2020-2025). Returns counts per revenue/margin bucket per year.",
    input_schema: {
      type: "object",
      properties: {
        include_margins: {
          type: "boolean",
          description: "Also include gross margin trajectory (default false)"
        },
        filters: {
          type: "object",
          description: "Optional filters",
          additionalProperties: { type: "string" }
        }
      }
    }
  },
  {
    name: "get_dataset_summary",
    description: "Overview of the dataset: total respondents, top industries, parishes, key stats, and a list of the most data-rich fields to query. Use for general orientation questions.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "list_available_fields",
    description: "List all queryable fields with types, descriptions, and response counts. Use when you need to know what data is available or to choose the right field name.",
    input_schema: { type: "object", properties: {} }
  }
];

// --- Tool execution ---

function applyFilters(respondents, filters) {
  if (\!filters || Object.keys(filters).length === 0) return respondents;
  return respondents.filter(r =>
    Object.entries(filters).every(([key, val]) => {
      const fieldVal = r[key];
      if (fieldVal === null || fieldVal === undefined) return false;
      if (Array.isArray(fieldVal)) return fieldVal.includes(val);
      return String(fieldVal) === String(val);
    })
  );
}

function multiSelectDistribution(respondents, field) {
  const counts = {};
  respondents.forEach(r => {
    const val = r[field];
    if (Array.isArray(val)) {
      val.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    } else if (val) {
      counts[val] = (counts[val] || 0) + 1;
    }
  });
  return counts;
}

// Suppress cells below MIN_CELL_SIZE and return a note
function suppressedNote(n) {
  return `suppressed (n=${n} < ${MIN_CELL_SIZE} — too few respondents for reliable results)`;
}

export function executeTool(name, input) {
  const data = loadData();
  const respondents = data.respondents;

  switch (name) {

    case "count_respondents": {
      const filtered = applyFilters(respondents, input.filters);
      return { count: filtered.length, total: respondents.length };
    }

    case "get_distribution": {
      const filtered = applyFilters(respondents, input.filters);
      const info = FIELD_INFO[input.field];
      const isMulti = info && info.type === "multi";

      let counts;
      if (isMulti) {
        counts = multiSelectDistribution(filtered, input.field);
      } else {
        counts = {};
        filtered.forEach(r => {
          const v = r[input.field];
          if (v \!== null && v \!== undefined) {
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
          }
        });
      }

      const responding = isMulti
        ? filtered.filter(r => Array.isArray(r[input.field]) && r[input.field].length > 0).length
        : filtered.filter(r => r[input.field] \!== null && r[input.field] \!== undefined).length;

      const reliabilityNote = responding < MIN_CELL_SIZE
        ? `WARNING: Only ${responding} respondents answered this field in this filter — results are not statistically reliable.`
        : responding < 20
        ? `NOTE: ${responding} respondents answered this field — interpret with caution.`
        : null;

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, input.limit || 20);

      return {
        field: input.field,
        filtered_count: filtered.length,
        responding_count: responding,
        reliability_note: reliabilityNote,
        note_multi_select: isMulti ? "Multi-select field: percentages do not add to 100%. Each pct is share of respondents who chose this option." : null,
        distribution: sorted.map(([val, count]) => ({
          value: val,
          count,
          pct: responding > 0 ? Math.round(count / responding * 1000) / 10 : 0
        }))
      };
    }

    case "cross_tabulate": {
      const filtered = applyFilters(respondents, input.filters);
      const infoA = FIELD_INFO[input.field_a];
      const infoB = FIELD_INFO[input.field_b];
      const isMultiA = infoA && infoA.type === "multi";
      const isMultiB = infoB && infoB.type === "multi";

      const table = {};
      filtered.forEach(r => {
        const valsA = isMultiA && Array.isArray(r[input.field_a]) ? r[input.field_a] : (r[input.field_a] ? [String(r[input.field_a])] : []);
        const valsB = isMultiB && Array.isArray(r[input.field_b]) ? r[input.field_b] : (r[input.field_b] ? [String(r[input.field_b])] : []);
        valsA.forEach(a => {
          if (\!table[a]) table[a] = {};
          valsB.forEach(b => {
            table[a][b] = (table[a][b] || 0) + 1;
          });
        });
      });

      // Suppress cells below MIN_CELL_SIZE
      const suppressed = [];
      Object.keys(table).forEach(a => {
        Object.keys(table[a]).forEach(b => {
          if (table[a][b] < MIN_CELL_SIZE) {
            suppressed.push(`${a} × ${b} (n=${table[a][b]})`);
            table[a][b] = suppressedNote(table[a][b]);
          }
        });
      });

      return {
        field_a: input.field_a,
        field_b: input.field_b,
        filtered_count: filtered.length,
        suppressed_cells: suppressed.length > 0 ? suppressed : null,
        suppression_note: suppressed.length > 0
          ? `${suppressed.length} cell(s) suppressed where n < ${MIN_CELL_SIZE} to protect respondent privacy.`
          : null,
        table
      };
    }

    case "get_numeric_stats": {
      const filtered = applyFilters(respondents, input.filters);
      const vals = filtered
        .map(r => r[input.field])
        .filter(v => v \!== null && v \!== undefined && typeof v === "number");

      if (vals.length === 0) return { field: input.field, count: 0, message: "No numeric values found for this filter." };

      const reliabilityNote = vals.length < MIN_CELL_SIZE
        ? `WARNING: Only ${vals.length} respondents have data for this field in this filter — results are not statistically reliable.`
        : vals.length < 20
        ? `NOTE: ${vals.length} respondents — interpret with caution.`
        : null;

      vals.sort((a, b) => a - b);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      const median = vals.length % 2 === 0
        ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
        : vals[Math.floor(vals.length / 2)];

      return {
        field: input.field,
        count: vals.length,
        reliability_note: reliabilityNote,
        mean: Math.round(mean * 10) / 10,
        median,
        min: vals[0],
        max: vals[vals.length - 1],
        distribution: {
          "0":    vals.filter(v => v === 0).length,
          "1-2":  vals.filter(v => v >= 1 && v <= 2).length,
          "3-5":  vals.filter(v => v >= 3 && v <= 5).length,
          "6-9":  vals.filter(v => v >= 6 && v <= 9).length,
          "10-19":vals.filter(v => v >= 10 && v <= 19).length,
          "20-39":vals.filter(v => v >= 20 && v <= 39).length,
          "40+":  vals.filter(v => v >= 40).length,
        }
      };
    }

    case "analyze_funding_gaps": {
      const filtered = applyFilters(respondents, input.filters);
      const attempted = multiSelectDistribution(filtered, "funding_attempted");
      const utilized  = multiSelectDistribution(filtered, "funding_utilized");
      const recent    = multiSelectDistribution(filtered, "funding_utilized_past_12mo");

      const allSources = [...new Set([
        ...Object.keys(attempted),
        ...Object.keys(utilized),
        ...Object.keys(recent)
      ])].sort();

      const analysis = allSources.map(source => ({
        source,
        attempted:             attempted[source] || 0,
        utilized:              utilized[source]  || 0,
        utilized_past_12mo:    recent[source]    || 0,
        gap: (attempted[source] || 0) - (utilized[source] || 0),
      })).sort((a, b) => b.gap - a.gap);

      return { filtered_count: filtered.length, funding_analysis: analysis };
    }

    case "get_revenue_trajectory": {
      const filtered = applyFilters(respondents, input.filters);
      const revenueYears = [
        "revenue_2020","revenue_2021","revenue_2022",
        "revenue_2023","revenue_2024","revenue_2025_est"
      ];
      const marginYears = [
        "margin_2020","margin_2021","margin_2022",
        "margin_2023","margin_2024","margin_2025_est"
      ];

      const trajectory = {};
      revenueYears.forEach(yearField => {
        const counts = {};
        filtered.forEach(r => {
          const v = r[yearField];
          if (v) counts[v] = (counts[v] || 0) + 1;
        });
        const n = filtered.filter(r => r[yearField]).length;
        trajectory[yearField.replace("revenue_", "")] = { counts, n };
      });

      const result = { filtered_count: filtered.length, revenue_trajectory: trajectory };

      if (input.include_margins) {
        const margins = {};
        marginYears.forEach(yearField => {
          const counts = {};
          filtered.forEach(r => {
            const v = r[yearField];
            if (v) counts[v] = (counts[v] || 0) + 1;
          });
          const n = filtered.filter(r => r[yearField]).length;
          margins[yearField.replace("margin_", "")] = { counts, n };
        });
        result.margin_trajectory = margins;
      }

      return result;
    }

    case "get_dataset_summary": {
      const industries = multiSelectDistribution(respondents, "industry");
      const topIndustries = Object.entries(industries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const parishes = {};
      respondents.forEach(r => {
        if (r.parish) parishes[r.parish] = (parishes[r.parish] || 0) + 1;
      });

      const years = respondents.map(r => r.year_founded).filter(Boolean);

      const designations = multiSelectDistribution(respondents, "special_designations");

      return {
        total_respondents: respondents.length,
        year_range: { min: Math.min(...years), max: Math.max(...years) },
        top_industries: topIndustries.map(([name, count]) => ({ name, count })),
        parish_distribution: Object.entries(parishes).sort((a, b) => b[1] - a[1]),
        products_vs_services: {
          products: respondents.filter(r => r.products_or_services === "Products (includes apps & software)").length,
          services: respondents.filter(r => r.products_or_services === "Services").length,
          both:     respondents.filter(r => r.products_or_services === "Both").length,
        },
        special_designations: Object.entries(designations).sort((a, b) => b[1] - a[1]),
        pct_plan_to_hire: Math.round(
          respondents.filter(r => r.plan_to_hire === "Yes").length /
          respondents.filter(r => r.plan_to_hire).length * 100
        ),
        pct_plan_to_raise: Math.round(
          respondents.filter(r => r.plan_to_raise === "Yes").length /
          respondents.filter(r => r.plan_to_raise).length * 100
        ),
        pct_has_exit_strategy: Math.round(
          respondents.filter(r => r.has_exit_strategy === "Yes").length /
          respondents.filter(r => r.has_exit_strategy).length * 100
        ),
        pct_plan_sales_outside_gno: Math.round(
          respondents.filter(r => r.plan_sales_outside_gno === "Yes").length /
          respondents.filter(r => r.plan_sales_outside_gno).length * 100
        ),
        median_ft_employees: (() => {
          const vals = respondents.map(r => r.ft_employees).filter(v => v \!== null && typeof v === "number").sort((a, b) => a - b);
          return vals.length > 0 ? vals[Math.floor(vals.length / 2)] : null;
        })(),
        high_response_rate_fields: [
          "industry","parish","org_type","workspace_type","move_plans","customer_types",
          "plan_to_raise","has_exit_strategy","funding_attempted","funding_utilized",
          "special_designations","plan_sales_outside_gno","time_at_location","founder1_gender",
          "founder1_race","ai_impact","tech_biggest_opportunity","marketing_channels",
          "pct_public_sector_revenue","ft_employees","pt_employees"
        ]
      };
    }

    case "list_available_fields": {
      return { fields: FIELD_INFO };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
