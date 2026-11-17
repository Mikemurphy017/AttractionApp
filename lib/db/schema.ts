/**
 * Attractio database schema (Drizzle ORM, Postgres on Railway).
 *
 * Sections:
 *   1. Auth tables (Better Auth): user, session, account, verification
 *   2. Access: advisor_assignments (VA ↔ advisor)
 *   3. The 8 MVP tables from PLAN.md: advisors, prospects, companies, signals,
 *      scores, daily_lists, messages, outcomes
 *   4. Config + compliance: signal_types, advisor_signal_weights, cadence_steps,
 *      suppressions, audit_log
 *
 * Access control is enforced in the app layer (lib/authz.ts): every query
 * that touches advisor data is scoped to the advisor IDs the user may see.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ─── 1. Auth (Better Auth) ──────────────────────────────────────────────

export const userRole = pgEnum("user_role", ["admin", "va", "advisor"]);
export type UserRole = (typeof userRole.enumValues)[number];

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("advisor"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// ─── 3a. Advisors ───────────────────────────────────────────────────────

export const advisors = pgTable("advisors", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The advisor's own login, if they have one. VAs and admins reach advisors via assignments/role. */
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  firm: text("firm"),
  niche: text("niche"),
  targetTitles: text("target_titles").array().notNull().default(sql`'{}'::text[]`),
  seniority: text("seniority").array().notNull().default(sql`'{}'::text[]`),
  industries: text("industries").array().notNull().default(sql`'{}'::text[]`),
  /** US metros or states, e.g. "Greater Boston", "TX". */
  geography: text("geography").array().notNull().default(sql`'{}'::text[]`),
  /** Minimum investable assets the advisor wants, in US dollars. */
  aumMinimum: bigint("aum_minimum", { mode: "number" }),
  complianceNotes: text("compliance_notes"),
  dailyQuota: integer("daily_quota").notNull().default(25),
  timezone: text("timezone").notNull().default("America/New_York"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

// ─── 2. Access: which VA works which advisors ───────────────────────────

export const advisorAssignments = pgTable(
  "advisor_assignments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.advisorId] })],
);

// ─── 3b. Companies, prospects, signals ──────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  domain: text("domain").unique(),
  /** SEC Central Index Key, for EDGAR-sourced companies. */
  cik: text("cik").unique(),
  industry: text("industry"),
  headcount: integer("headcount"),
  fundingStage: text("funding_stage"),
  lastRoundAmount: bigint("last_round_amount", { mode: "number" }),
  lastRoundDate: date("last_round_date"),
  ...timestamps,
});

export const emailStatus = pgEnum("email_status", ["verified", "unverified", "invalid", "unknown"]);

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    title: text("title"),
    seniority: text("seniority"),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    /** Stored normalized (lowercase, no trailing slash). Dedupe key. */
    linkedinUrl: text("linkedin_url"),
    /** Stored lowercase. Dedupe key. */
    email: text("email"),
    emailStatus: emailStatus("email_status").notNull().default("unknown"),
    location: text("location"),
    /** IANA time zone, used for send-time suggestions. */
    timezone: text("timezone"),
    country: text("country").notNull().default("US"),
    /** Where the record came from, e.g. "sec_form4", "csv_upload". */
    source: text("source"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("prospects_linkedin_url_uq").on(t.linkedinUrl),
    uniqueIndex("prospects_email_uq").on(t.email),
    index("prospects_company_id_idx").on(t.companyId),
  ],
);

/** Config table: signal types and their default weights (tunable without code). */
export const signalTypes = pgTable("signal_types", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  source: text("source").notNull(),
  defaultWeight: real("default_weight").notNull(),
  /** Signals that must pass (ICP fit) rather than add score. */
  isGate: boolean("is_gate").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** Per-advisor overrides of signal weights, edited in the ICP builder. */
export const advisorSignalWeights = pgTable(
  "advisor_signal_weights",
  {
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id, { onDelete: "cascade" }),
    signalType: text("signal_type")
      .notNull()
      .references(() => signalTypes.key, { onDelete: "cascade" }),
    weight: real("weight").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.advisorId, t.signalType] }),
    check("advisor_signal_weights_range", sql`${t.weight} >= 0 and ${t.weight} <= 1`),
  ],
);

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    type: text("type")
      .notNull()
      .references(() => signalTypes.key),
    occurredOn: date("occurred_on").notNull(),
    headline: text("headline").notNull(),
    sourceUrl: text("source_url"),
    raw: jsonb("raw"),
    strength: real("strength").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("signals_prospect_id_idx").on(t.prospectId),
    index("signals_company_id_idx").on(t.companyId),
    check("signals_target", sql`${t.prospectId} is not null or ${t.companyId} is not null`),
    check("signals_strength_range", sql`${t.strength} >= 0 and ${t.strength} <= 1`),
  ],
);

// ─── 3c. Scoring and daily lists ────────────────────────────────────────

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id, { onDelete: "cascade" }),
    runDate: date("run_date").notNull(),
    ruleScore: real("rule_score").notNull(),
    predictedScore: real("predicted_score"),
    finalScore: real("final_score").notNull(),
    reasonText: text("reason_text"),
    modelVersion: text("model_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scores_advisor_prospect_run_uq").on(t.advisorId, t.prospectId, t.runDate)],
);

export const listItemStatus = pgEnum("list_item_status", [
  "new",
  "reviewing",
  "approved",
  "sent",
  "skipped",
]);

/** One row per prospect per advisor per day; rank 1–25. Also the 180-day "already shown" history. */
export const dailyLists = pgTable(
  "daily_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id, { onDelete: "cascade" }),
    listDate: date("list_date").notNull(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    status: listItemStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_lists_advisor_date_prospect_uq").on(t.advisorId, t.listDate, t.prospectId),
    uniqueIndex("daily_lists_advisor_date_rank_uq").on(t.advisorId, t.listDate, t.rank),
    index("daily_lists_advisor_prospect_idx").on(t.advisorId, t.prospectId),
  ],
);

// ─── 3d. Messages and cadence ───────────────────────────────────────────

/**
 * Config table: the outreach cadence. Offsets are measured from the moment the
 * LinkedIn connection is accepted. Editable without code.
 */
export const cadenceSteps = pgTable("cadence_steps", {
  key: text("key").primaryKey(),
  position: integer("position").notNull().unique(),
  label: text("label").notNull(),
  offsetHours: integer("offset_hours").notNull(),
  /** Local-time send window in the prospect's time zone. */
  windowStart: time("window_start").notNull(),
  windowEnd: time("window_end").notNull(),
});

export const messageChannel = pgEnum("message_channel", ["linkedin", "email"]);
export const messageStatus = pgEnum("message_status", ["draft", "approved", "edited", "rejected"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id, { onDelete: "cascade" }),
    slot: text("slot")
      .notNull()
      .references(() => cadenceSteps.key),
    channel: messageChannel("channel").notNull(),
    /** What the engine generated. Never overwritten. */
    originalBody: text("original_body").notNull(),
    /** Current text, after any human edits. */
    body: text("body").notNull(),
    subject: text("subject"),
    sendWindowStart: timestamp("send_window_start", { withTimezone: true }),
    sendWindowEnd: timestamp("send_window_end", { withTimezone: true }),
    status: messageStatus("status").notNull().default("draft"),
    editorNotes: text("editor_notes"),
    rejectReason: text("reject_reason"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("messages_advisor_prospect_slot_channel_uq").on(
      t.advisorId,
      t.prospectId,
      t.slot,
      t.channel,
    ),
  ],
);

// ─── 3e. Outcomes (training data for the prediction layer) ──────────────

export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    advisorId: uuid("advisor_id")
      .notNull()
      .references(() => advisors.id, { onDelete: "cascade" }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    positiveReplyAt: timestamp("positive_reply_at", { withTimezone: true }),
    bookedCallAt: timestamp("booked_call_at", { withTimezone: true }),
    clientWonAt: timestamp("client_won_at", { withTimezone: true }),
    loggedBy: text("logged_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("outcomes_advisor_prospect_uq").on(t.advisorId, t.prospectId)],
);

// ─── 4. Compliance ──────────────────────────────────────────────────────

/** Checked before every daily list. Deletion requests and opt-outs land here. */
export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    reason: text("reason").notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("suppressions_email_idx").on(t.email),
    index("suppressions_linkedin_url_idx").on(t.linkedinUrl),
    check("suppressions_target", sql`${t.email} is not null or ${t.linkedinUrl} is not null`),
  ],
);

/** Append-only. Approved messages and admin actions; advisors can hand this to compliance. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId)],
);
