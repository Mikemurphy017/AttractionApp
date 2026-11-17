@AGENTS.md

# Attractio

**Read PLAN.md before any phase of work.** This file is the short version; PLAN.md is the source of truth. Its **Decisions log** at the top overrides the rest of PLAN.md.

## Product

Attractio is a web app that delivers **25 ranked, signal-backed prospects per day** to a financial advisor. Each prospect comes with:

- a LinkedIn URL and a verified email, obtained without scraping
- a 0–100 score, a two-sentence "why now" and signal chips with source links
- a ready-to-send **TextTonality®** sequence: a connection note plus messages at 24 hours, 3 days, 5 days and 14 days after connecting, for LinkedIn and email, with suggested send times

**It researches and writes; it never sends.** An advisor or a Bluestone VA copies each approved draft and sends it by hand, then logs the outcome. Those outcomes train the prediction model.

What sets it apart:

- **Advisor-specific signals:** liquidity events such as funding rounds, M&A, IPOs and lockups, insider sales, exec job changes and retirement windows.
- **A predictive layer:** our own model learns which signal patterns come before a booked call.
- **TextTonality messaging:** pain, intrigue, subliminal call to action, written to our rules.

The MVP is single-tenant: Bluestone runs it internally for client advisors. Multi-tenant, billing, self-serve signup, sending, reply handling, CRM sync (CSV export only), phone numbers and mobile are all **out of scope**.

## Hard rules (never break these)

1. **Never send messages.** No code path may send email, LinkedIn messages, InMail or connection requests to prospects. That includes SMTP, Gmail/Outlook APIs, sequencer APIs and anything else. The app only drafts, plus copy-to-clipboard and CSV export. The one exception is internal ops alerts to Bluestone staff (Phase 6), which never go to prospects.
2. **Never scrape LinkedIn.** No scraping, no browser automation, no unofficial LinkedIn APIs, no Sales Navigator automation. Contact fields come from public data, a licensed API, or a CSV that a human exported.
3. **Never edit `/prompts/texttonality.md`.** Bluestone writes it; it's the IP. Read it at runtime only. The single exception is Phase 4, which creates it **once** with placeholder headings only, and only if it doesn't exist yet. Never change, reformat, "improve" or regenerate it after that.
4. **Every data source sits behind an adapter** in `/lib/sources`. All adapters share one interface, cache responses, log usage and credits, and support `ADAPTER_MODE=mock`. Pipeline and app code never call a provider SDK or URL directly.
5. **Every query that touches advisor data is scoped through `lib/authz.ts`.** There is no row-level security, so the app layer is the only guard. Use `requireAdvisorAccess(advisorId)` in every page and server action that reads or writes one advisor's data, and `requireAdmin()` for admin-only work.

## Roles

| Role | Sees | Notes |
|---|---|---|
| `admin` | Everything, plus `/admin` | Bluestone (Mike). Creates users and advisors, and assigns VAs. Bootstrapped from `ADMIN_EMAIL`. |
| `va` | Advisors assigned in `advisor_assignments` | A VA can work several advisors. |
| `advisor` | Only their own advisor record (`advisors.user_id`) | |

Self-signup is disabled. Accounts are created only in the Admin screen or by `pnpm db:seed`.

## Compliance guardrails (from PLAN.md)

- Messages are likely retail correspondence under FINRA and SEC marketing rules. The checker blocks guarantees, performance claims, testimonials and unsupported claims. Every approved message gets a timestamped `audit_log` record.
- Every email draft gets a CAN-SPAM opt-out footer by default.
- US prospects only. Honor deletion requests. Check `suppressions` before every daily list.
- Dedupe prospects on LinkedIn URL + email. Suppress each prospect for 180 days once it has been shown to an advisor (`daily_lists` is the history).
- Protect the IP: `/prompts/texttonality.md` and `/lib/predict` stay out of any shared builds, logs and client bundles. API keys live in environment variables only and are never committed or logged.

## Stack

- **App:** Next.js 16 (App Router, TypeScript) + Tailwind CSS 4, using pnpm.
  - Next 16 renames `middleware` to `proxy` (`/proxy.ts`).
  - `params` and `searchParams` are Promises.
  - `forbidden()` is enabled through `experimental.authInterrupts`.
  - Check `node_modules/next/dist/docs/` before using an unfamiliar Next API.
- **Hosting:** Railway, for the app, Postgres, the cron job and the Python service. **No Supabase.**
- **Database:** Postgres + Drizzle ORM.
  - The schema lives in `lib/db/schema.ts`. Migrations go in `/drizzle` and are generated with `pnpm db:generate` (never hand-edit generated SQL).
  - `db` from `lib/db` connects lazily.
- **Auth:** Better Auth (`lib/auth.ts`), email + password, with sessions stored in Postgres.
  - `lib/users.ts` creates accounts.
  - The role is stored on `user.role` and always read fresh from the DB in `getCurrentUser()`.
- **Jobs:** the nightly per-advisor pipeline runs on Railway cron at 2 AM Eastern, for a 6 AM delivery in the advisor's time zone.
- **AI:** the Claude API (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) writes the why-now text and the TextTonality drafts, returning JSON.
- **Prediction:** a separate Python service (scikit-learn / LightGBM) in `/lib/predict`. It returns `null` until there are 300+ outcomes, and the rule score is used until then.

## Data sources (public first)

Primary sources are public:

- **SEC EDGAR:** Form D for funding, 8-K and S-1 for M&A and IPOs, Form 4 for insider sales. These filings also name officers and directors.
- **GDELT and Google News RSS:** news signals.
- **CSV upload:** Sales Navigator exports made by a human.

Apollo is **not** the primary source.

**Open question (decide before Phase 2):** public data has no LinkedIn URLs or verified emails. The options are a CSV upload of human-exported Sales Nav lists, pattern-guessed emails checked by a paid verifier, or one licensed contact API. Scraping is never an option.

## Layout

```
app/(app)/            signed-in screens: admin, advisors, advisors/[id]/settings (Today etc. later)
app/login/            sign-in
app/api/auth/         Better Auth handler
components/           shared UI (ui.tsx, tag-input.tsx)
lib/db/               schema.ts, reference-data.ts (signal types, cadence), index.ts
lib/auth.ts           Better Auth server config;  lib/auth-client.ts for the browser
lib/authz.ts          getCurrentUser / requireUser / requireAdmin / requireAdvisorAccess
lib/users.ts          create users, reset passwords
lib/sources/          data adapters (Phase 2)
lib/predict/          Python prediction service (Phase 5), private IP
prompts/texttonality.md   TextTonality rules, owned by Bluestone (read-only)
drizzle/              generated SQL migrations
scripts/              migrate.ts, seed.ts
proxy.ts              optimistic redirect to /login when there's no session cookie
```

## Data model

- **The 8 MVP tables:** advisors, prospects, companies, signals, scores, daily_lists (one row per prospect per day, rank 1–25), messages (`original_body` is never overwritten; `body` holds human edits), and outcomes.
- **Access and auth:** user, session, account, verification, advisor_assignments.
- **Config:** `signal_types` holds the default weights; `advisor_signal_weights` holds per-advisor overrides; `cadence_steps` holds the cadence. Tune these in the DB, never in code.
- **Compliance:** suppressions, audit_log.

## Scoring (summary)

1. **Gate:** in the advisor's ICP, has a verified email, not shown in the last 180 days, not on the suppression list.
2. **Rule score:** Σ signal weight (advisor override, else the default) × recency decay (30-day half-life) × seniority multiplier.
3. **Predicted score:** from `/lib/predict`.
4. **Final score:** a blend that starts at 100% rules and shifts toward the model once there are ~300+ outcomes.
5. **Reason text:** a two-sentence why-now from Claude, with source links.

## Build phases

Each phase is one session and ends in something clickable. Don't start the next phase until the current one works with real data.

- **Phase 0, kickoff:** docs + scaffold. ✅
- **Phase 1, database, auth, advisor settings:** ✅
  - Drizzle schema for all tables; email/password login; three roles.
  - Advisor settings screen with the ICP builder and signal weights.
  - Admin dashboard: advisors, VA assignments, team management and an audit feed.
  - Sample seed: 2 advisors, 1 VA.
- **Phase 2, adapters and the daily pipeline (rules only):** public-source adapters (EDGAR, GDELT/News RSS, CSV upload) plus the chosen contact source. Nightly pipeline: ~150 candidates → signals → gate → rule score → dedupe → top N into `daily_lists`. `pipeline_runs` and credit/usage tables. Admin gets "Run now", run logs and usage.
- **Phase 3, Today and Prospect detail:** ranked cards with score, why-now, signal chips and copy buttons. Detail view. CSV export for SimplePipeline.
- **Phase 4, TextTonality engine:** load `/prompts/texttonality.md` at runtime. One Claude call generates every cadence step for LinkedIn and email as JSON. A checker pass (banned phrases, compliance, length caps, structure) regenerates once on failure. Send times come from `cadence_steps`, converted to the prospect's time zone.
- **Phase 5, Outcomes and prediction:** one-click outcome logging (connected, sent, replied, positive, booked, client). Python LightGBM service. Nightly retrain at 300+ outcomes. Blend setting and held-out accuracy in Admin.
- **Phase 6, deploy:** app, Postgres and the Python service on Railway; nightly job at 2 AM ET; error alerts by email; a daily credit-spend summary; and a smoke test that runs the pipeline in mock mode on every deploy.

## Conventions

- Before committing, run `pnpm typecheck`, `pnpm lint` and `pnpm build`.
- After changing `lib/db/schema.ts`, run `pnpm db:generate` and commit the new SQL.
- Tests and local runs use `ADAPTER_MODE=mock`. Never spend live provider credits in tests.
- Write messages in the TextTonality style only from `/prompts/texttonality.md`. Never invent house rules in code or prompts.
- Never commit real people's personal data or credentials. Seeds use `@example.com` addresses.
