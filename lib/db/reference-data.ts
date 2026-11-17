/**
 * Reference data every environment needs (production included).
 * Upserted by `pnpm db:seed`; editing a row in the DB afterwards is the way to tune it.
 */

/** Signal types and starting weights from PLAN.md → Daily pipeline. */
export const SIGNAL_TYPES = [
  {
    key: "liquidity_event",
    label: "Acquisition, merger or IPO announced; lockup ending",
    source: "SEC 8-K / S-1, news",
    defaultWeight: 1.0,
    isGate: false,
    sortOrder: 1,
  },
  {
    key: "funding_round",
    label: "Company raised a round (Seed–Series D) in last 60 days",
    source: "SEC Form D",
    defaultWeight: 0.9,
    isGate: false,
    sortOrder: 2,
  },
  {
    key: "insider_sale",
    label: "Insider stock sale (Form 4)",
    source: "SEC Form 4",
    defaultWeight: 0.8,
    isGate: false,
    sortOrder: 3,
  },
  {
    key: "promotion",
    label: "Promoted to VP / C-suite / partner in last 6 months",
    source: "Public filings, news",
    defaultWeight: 0.8,
    isGate: false,
    sortOrder: 4,
  },
  {
    key: "job_change",
    label: "Changed companies in last 12 months (401k rollover, new equity)",
    source: "Public filings, news",
    defaultWeight: 0.7,
    isGate: false,
    sortOrder: 5,
  },
  {
    key: "company_news",
    label: "Company in the news: layoffs, restructuring, big contract",
    source: "GDELT / Google News RSS",
    defaultWeight: 0.5,
    isGate: false,
    sortOrder: 6,
  },
  {
    key: "retirement_window",
    label: "Long tenure + senior title (retirement window)",
    source: "Public filings",
    defaultWeight: 0.5,
    isGate: false,
    sortOrder: 7,
  },
  {
    key: "icp_fit",
    label: "Fits advisor ICP (title, seniority, industry, geography)",
    source: "Profile data",
    defaultWeight: 0,
    isGate: true,
    sortOrder: 8,
  },
] as const;

/**
 * Outreach cadence (Bluestone, Nov 2026): messages at 24 hours, 3 days, 5 days
 * and 14 days after the LinkedIn connection is accepted. The connection note is
 * step 0. Send windows are PLAN.md's defaults until outcome data says otherwise.
 */
export const CADENCE_STEPS = [
  { key: "connection_note", position: 0, label: "Connection note", offsetHours: 0, windowStart: "07:30", windowEnd: "09:00" },
  { key: "day_1", position: 1, label: "Message 1 (24 hours after connecting)", offsetHours: 24, windowStart: "07:30", windowEnd: "09:00" },
  { key: "day_3", position: 2, label: "Message 2 (day 3)", offsetHours: 72, windowStart: "12:00", windowEnd: "13:00" },
  { key: "day_5", position: 3, label: "Message 3 (day 5)", offsetHours: 120, windowStart: "16:30", windowEnd: "18:00" },
  { key: "day_14", position: 4, label: "Message 4 (day 14)", offsetHours: 336, windowStart: "07:30", windowEnd: "09:00" },
] as const;
