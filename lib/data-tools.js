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

// --- Field metadata for Claude ---

const FIELD_INFO = {
  // Company profile
  year_founded: { type: "number", desc: "Year company was founded (2009-2025)" },
  org_type: { type: "category", desc: "LLC, C-Corp, S-Corp, etc." },
  state_of_incorporation: { type: "category", desc: "State of incorporation" },
  industry: { type: "multi", desc: "Primary industry (multi-select). Values: Software, Healthcare, Food and beverage, Media, Legal and consulting, Construction Tech, Beauty, Education, Manufacturing, Marketing, Retail, etc." },
  products_or_services: { type: "category", desc: "Products (includes apps & software), Services, or Both" },
  customer_types: { type: "multi", desc: "Customer segments served: Consumers, Small & Medium Size Business, Large Businesses/Corporations, Government, Non-Profit" },
  has_board: { type: "category", desc: "Yes or No" },

  // Geography
  zip_code: { type: "category", desc: "Company zip code" },
  parish: { type: "category", desc: "Parish: Orleans Parish, Jefferson Parish, St. Tammany Parish, St. Bernard Parish, Other" },

  // Workspace
  workspace_type: { type: "category", desc: "Home Office, Leased Commercial Space, Co-Working Space, Owned Commercial Space, Sub-leased Commercial Space" },
  move_plans: { type: "category", desc: "Plans to move/expand/reduce/stay" },
  square_footage: { type: "category", desc: "Space occupied (bucketed)" },

  // Funding
  funding_attempted: { type: "multi", desc: "Funding sources attempted: Bootstrapping (Revenue), Credit Card Debt, Friends & Family, Savings, Angel Investment, Venture Capital, Convertible Debt, SBA Backed Bank Loan, Traditional Bank Loans, Accelerator / Incubator, Cash Awards, Research Grants, CDFI Fund, Crowdfunding / Presales, Crowdfunding for Equity, Factoring, None" },
  funding_utilized: { type: "multi", desc: "Funding sources successfully utilized (same options as attempted)" },
  funding_utilized_past_12mo: { type: "multi", desc: "Funding sources used in past 12 months (same options)" },
  investment_capital_raised: { type: "category", desc: "Total capital raised (bucketed): $0-$50,000 through $10,000,001-$25,000,000" },
  capital_raised_past_12mo: { type: "category", desc: "Capital raised in past 12 months (bucketed)" },
  funding_rounds: { type: "category", desc: "Number of funding rounds: 1, 2, 3, 5 or more" },
  plan_to_raise: { type: "category", desc: "Yes, No, or Maybe" },

  // Revenue (bucketed by year)
  revenue_2020: { type: "category", desc: "2020 gross revenue bucket" },
  revenue_2021: { type: "category", desc: "2021 gross revenue bucket" },
  revenue_2022: { type: "category", desc: "2022 gross revenue bucket" },
  revenue_2023: { type: "category", desc: "2023 gross revenue bucket" },
  revenue_2024: { type: "category", desc: "2024 gross revenue bucket" },
  revenue_2025_est: { type: "category", desc: "2025 estimated gross revenue bucket" },
  margin_2024: { type: "category", desc: "2024 gross margin percentage bucket" },
  margin_2025_est: { type: "category", desc: "2025 estimated gross margin bucket" },

  // Technology & AI
  tech_biggest_opportunity: { type: "category", desc: "Biggest tech opportunity: Generative AI (ChatGPT), Artificial Intelligence / Machine Learning, Robotics & Automation, Cloud Computing, VR/AR, IoT, Blockchain, Other" },
  tech_biggest_threat: { type: "category", desc: "Biggest tech threat (same options)" },
  tech_largest_long_term_impact: { type: "category", desc: "Largest long-term tech impact (same options)" },
  ai_impact: { type: "multi", desc: "How AI impacted business: Improved product / productivity, Expanded addressable market, Decreased costs, Increased sales, Increased average contract / customer value, Improved talent attraction / retention, Increased competition, Degraded talent attraction / retention, Decreased average contract / customer value, Decreased competition" },

  // Workforce
  ft_employees: { type: "number", desc: "Full-time salaried employees" },
  pt_employees: { type: "number", desc: "Part-time / contract / hourly employees" },
  founder_salary: { type: "category", desc: "Founder salary range (bucketed)" },
  employee_avg_salary: { type: "category", desc: "Average employee salary (bucketed)" },
  plan_to_hire: { type: "category", desc: "Yes, No, or Maybe" },
  total_women: { type: "number", desc: "Total women employees" },
  total_bipoc: { type: "number", desc: "Total BIPOC employees" },

  // Founder demographics
  founder1_gender: { type: "category", desc: "Primary founder gender" },
  founder1_race: { type: "category", desc: "Primary founder race/ethnicity" },
  founder1_education: { type: "category", desc: "Primary founder education level" },
  founder1_veteran: { type: "category", desc: "Primary founder veteran status" },

  // Benefits
  benefits_offered: { type: "multi", desc: "Employee benefits: Medical Insurance, Remote Work Option, Paid Time Off, Dental, Vision, 401K Matching, Paid Continuing Education, Paid Maternity/Paternity Leave, Life Insurance, etc." },
};

// --- Tool definitions for Claude ---

export const toolDefinitions = [
  {
    name: "count_respondents",
    description: "Count respondents, optionally filtered. Use this to answer 'how many companies...' questions. For multi-select fields (industry, funding sources, AI impact, etc.), the filter matches if the respondent selected that value among their choices.",
    input_schema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Key-value pairs to filter by. Keys are field names, values are the value to match. For multi-select fields, matches if the value is in the array.",
          additionalProperties: { type: "string" }
        }
      }
    }
  },
  {
    name: "get_distribution",
    description: "Get the distribution of values for a field, optionally filtered. Returns counts for each unique value. Use for 'what is the breakdown of...' or 'what percentage of...' questions.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          description: "The field to get distribution for"
        },
        filters: {
          type: "object",
          description: "Optional filters to apply first",
          additionalProperties: { type: "string" }
        },
        limit: {
          type: "number",
          description: "Max number of categories to return (default 20, sorted by count desc)"
        }
      },
      required: ["field"]
    }
  },
  {
    name: "cross_tabulate",
    description: "Cross-tabulate two fields to see how they relate. Returns a table of counts. Use for questions like 'how does X break down by Y' or comparing across categories.",
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
    description: "Get statistics (mean, median, min, max, distribution) for a numeric field like ft_employees, pt_employees, total_women, total_bipoc, year_founded. Optionally filtered.",
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
    description: "Compare funding sources attempted vs. utilized to identify gaps where companies try but fail to access funding. Optionally filtered.",
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
    description: "Show how revenue distribution has changed across years (2020-2025). Returns the count of respondents in each revenue bucket per year. Optionally filtered.",
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
    name: "get_dataset_summary",
    description: "Get an overview of the dataset: total respondents, top industries, parish distribution, year range, and key stats. Use this when the user asks general questions about the data.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "list_available_fields",
    description: "List all queryable fields with their types and descriptions. Use when you need to know what data is available.",
    input_schema: {
      type: "object",
      properties: {}
    }
  }
];

// --- Tool execution ---

function applyFilters(respondents, filters) {
  if (!filters || Object.keys(filters).length === 0) return respondents;
  return respondents.filter(r => {
    return Object.entries(filters).every(([key, val]) => {
      const fieldVal = r[key];
      if (fieldVal === null || fieldVal === undefined) return false;
      if (Array.isArray(fieldVal)) return fieldVal.includes(val);
      return String(fieldVal) === String(val);
    });
  });
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
          if (v !== null && v !== undefined) {
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
          }
        });
      }

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, input.limit || 20);

      const responding = isMulti
        ? filtered.filter(r => Array.isArray(r[input.field]) && r[input.field].length > 0).length
        : filtered.filter(r => r[input.field] !== null && r[input.field] !== undefined).length;

      return {
        field: input.field,
        filtered_count: filtered.length,
        responding_count: responding,
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
        let valsA = isMultiA && Array.isArray(r[input.field_a]) ? r[input.field_a] : (r[input.field_a] ? [String(r[input.field_a])] : []);
        let valsB = isMultiB && Array.isArray(r[input.field_b]) ? r[input.field_b] : (r[input.field_b] ? [String(r[input.field_b])] : []);
        valsA.forEach(a => {
          if (!table[a]) table[a] = {};
          valsB.forEach(b => {
            table[a][b] = (table[a][b] || 0) + 1;
          });
        });
      });

      return { field_a: input.field_a, field_b: input.field_b, filtered_count: filtered.length, table };
    }

    case "get_numeric_stats": {
      const filtered = applyFilters(respondents, input.filters);
      const vals = filtered.map(r => r[input.field]).filter(v => v !== null && v !== undefined && typeof v === "number");

      if (vals.length === 0) return { field: input.field, count: 0, message: "No numeric values found" };

      vals.sort((a, b) => a - b);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      const median = vals.length % 2 === 0
        ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
        : vals[Math.floor(vals.length / 2)];

      return {
        field: input.field,
        count: vals.length,
        mean: Math.round(mean * 10) / 10,
        median,
        min: vals[0],
        max: vals[vals.length - 1],
        distribution: {
          "0": vals.filter(v => v === 0).length,
          "1-2": vals.filter(v => v >= 1 && v <= 2).length,
          "3-5": vals.filter(v => v >= 3 && v <= 5).length,
          "6-9": vals.filter(v => v >= 6 && v <= 9).length,
          "10-19": vals.filter(v => v >= 10 && v <= 19).length,
          "20-39": vals.filter(v => v >= 20 && v <= 39).length,
          "40+": vals.filter(v => v >= 40).length,
        }
      };
    }

    case "analyze_funding_gaps": {
      const filtered = applyFilters(respondents, input.filters);
      const attempted = multiSelectDistribution(filtered, "funding_attempted");
      const utilized = multiSelectDistribution(filtered, "funding_utilized");
      const recent = multiSelectDistribution(filtered, "funding_utilized_past_12mo");

      const allSources = [...new Set([...Object.keys(attempted), ...Object.keys(utilized), ...Object.keys(recent)])].sort();
      const analysis = allSources.map(source => ({
        source,
        attempted: attempted[source] || 0,
        utilized: utilized[source] || 0,
        utilized_past_12mo: recent[source] || 0,
        gap: (attempted[source] || 0) - (utilized[source] || 0),
      })).sort((a, b) => b.gap - a.gap);

      return { filtered_count: filtered.length, funding_analysis: analysis };
    }

    case "get_revenue_trajectory": {
      const filtered = applyFilters(respondents, input.filters);
      const years = ["revenue_2020", "revenue_2021", "revenue_2022", "revenue_2023", "revenue_2024", "revenue_2025_est"];
      const trajectory = {};

      years.forEach(yearField => {
        const counts = {};
        filtered.forEach(r => {
          const v = r[yearField];
          if (v) counts[v] = (counts[v] || 0) + 1;
        });
        trajectory[yearField.replace("revenue_", "")] = counts;
      });

      return { filtered_count: filtered.length, trajectory };
    }

    case "get_dataset_summary": {
      const industries = multiSelectDistribution(respondents, "industry");
      const topIndustries = Object.entries(industries).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const parishes = {};
      respondents.forEach(r => {
        if (r.parish) parishes[r.parish] = (parishes[r.parish] || 0) + 1;
      });
      const years = respondents.map(r => r.year_founded).filter(Boolean);

      return {
        total_respondents: respondents.length,
        year_range: { min: Math.min(...years), max: Math.max(...years) },
        top_industries: topIndustries.map(([name, count]) => ({ name, count })),
        parish_distribution: Object.entries(parishes).sort((a, b) => b[1] - a[1]),
        products_vs_services: {
          products: respondents.filter(r => r.products_or_services === "Products (includes apps & software)").length,
          services: respondents.filter(r => r.products_or_services === "Services").length,
          both: respondents.filter(r => r.products_or_services === "Both").length,
        },
        pct_plan_to_hire: Math.round(respondents.filter(r => r.plan_to_hire === "Yes").length / respondents.filter(r => r.plan_to_hire).length * 100),
        median_ft_employees: (() => {
          const vals = respondents.map(r => r.ft_employees).filter(v => v !== null && typeof v === "number").sort((a, b) => a - b);
          return vals.length > 0 ? vals[Math.floor(vals.length / 2)] : null;
        })(),
      };
    }

    case "list_available_fields": {
      return { fields: FIELD_INFO };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
