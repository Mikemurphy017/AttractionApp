@AGENTS.md

# Attractio

**Read PLAN.md before any phase of work.** This file is the short version; PLAN.md is the source of truth.

## Product

Attractio is a web app that delivers **25 ranked, signal-backed prospects per day** to a financial advisor. Each prospect comes with:

- a LinkedIn URL and a verified email from licensed data providers
- a 0–100 score, a two-sentence "why now" and signal chips with source links
- a ready-to-send **TextTonality®** sequence: an opener and 2 follow-ups, for both LinkedIn and email, with suggested send times

**It researches and writes; it never sends.** An advisor or a Bluestone VA copies each approved draft and sends it by hand, then logs the outcome. Those outcomes train the prediction model.

What sets it apart:

- **Advisor-specific signals:** liquidity events such as funding rounds, M&A, IPOs and lockups, insider sales, exec job changes and retirement windows.
- **A predictive layer:** our own model learns which signal patterns come before a booked call.
- **TextTonality messaging:** pain, intrigue, subliminal call to action, written to our rules.

The MVP is single-tenant: Bluestone runs it internally for client advisors. Multi-tenant, billing, self-serve signup, sending, reply handling, CRM sync (CSV export only), phone numbers and mobile are all **out of scope**.

## Hard rules (never break these)

1. **Never send messages.** No code path may send email, LinkedIn messages, InMail or connection requests to prospects. That includes SMTP, Gmail/Outlook APIs, sequencer APIs and anything else. The app only drafts, plus copy-to-clipboard and CSV export. The one exception is internal ops alerts to Bluestone staff (Phase 6), which never go to prospects.
2. **Never scrape LinkedIn.** No scraping, no browser automation, no unofficial LinkedIn APIs, no Sales Navigator automation. Every contact field comes from a licensed API (Apollo, PDL, Clay and so on) or from a CSV that a human exported.
3. **Never edit `/prompts/texttonality.md`.** Bluestone writes it; it's the IP. Read it at runtime only. The single exception is Phase 4, which creates it **once** with placeholder headings only, and only if it doesn't exist yet. Never change, reformat, "improve" or regenerate it after that.
4. **Every data provider sits behind an adapter** in `/lib/sources`. All adapters share one interface, cache responses, log credit usage, and support `ADAPTER_MODE=mock`. Pipeline and app code never call a provider SDK or URL directly.

## Compliance guardrails (from PLAN.md)

- Messages are likely retail correspondence under FINRA and SEC marketing rules. The checker blocks guarantees, performance claims, testimonials and unsupported claims. Every approved message gets a timestamped audit record.
- Every email draft gets a CAN-SPAM opt-out footer by default.
- US prospects only. Store only work data from licensed providers. Honor deletion requests. Check the suppression list before every daily list.
- Dedupe prospects on LinkedIn URL + email. Suppress each prospect for 180 days once it has been shown to an advisor.
- Protect the IP: `/prompts/texttonality.md` and `/lib/predict` stay out of any shared builds, logs and client bundles. API keys live in environment variables only and are never committed or logged.

## Stack

- **App:** Next.js 16 (App Router, TypeScript) + Tailwind CSS 4, using pnpm. Next 16 renames `middleware` to `proxy` (`/proxy.ts`), and `cacheComponents` is on. Check `node_modules/next/dist/docs/` before using an unfamiliar Next API.
- **Database and auth:** Supabase (Postgres, row-level security, pgvector later). Migrations go in `/supabase/migrations`. Clients:
  - `lib/supabase/server.ts`: `createClient()` acts as the user, so RLS applies. `createAdminClient()` uses the service role and is for trusted server jobs only.
  - `lib/supabase/client.ts`: the browser client.
- **Jobs:** the nightly per-advisor pipeline runs on Railway cron (Inngest is the fallback), at 2 AM Eastern, for a 6 AM delivery in the advisor's time zone.
- **AI:** the Claude API (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) writes the why-now text and the TextTonality drafts, returning JSON.
- **Prediction:** a separate Python service (scikit-learn / LightGBM) in `/lib/predict`. It returns `null` until there are 300+ outcomes, and the rule score is used until then.
- **Deploy:** Railway.

## Layout

```
app/                  Next.js routes (Today, Prospect, Outcomes, Settings, Admin)
lib/env.ts            typed env access; full key list in .env.example
lib/supabase/         Supabase clients + session proxy helper
lib/sources/          data-provider adapters (Phase 2)
lib/predict/          Python prediction service (Phase 5), private IP
prompts/texttonality.md   TextTonality rules, owned by Bluestone (read-only)
supabase/             config + migrations + seed
proxy.ts              refreshes the Supabase session
```

## Data model (8 tables)

advisors, prospects, companies, signals, scores, daily_lists, messages, outcomes. Field lists are in PLAN.md → Data model. Signal weights live in a **config table**, not in code. `outcomes` ships on day one.

## Scoring (summary)

1. **Gate:** in the advisor's ICP, has a verified email, not shown in the last 180 days, not on the suppression list.
2. **Rule score:** Σ signal weight × recency decay (30-day half-life) × seniority multiplier.
3. **Predicted score:** from `/lib/predict`.
4. **Final score:** a blend that starts at 100% rules and shifts toward the model once there are ~300+ outcomes.
5. **Reason text:** a two-sentence why-now from Claude, with source links.

## Build phases

Each phase is one session and ends in something clickable. Don't start the next phase until the current one works with real data.

- **Phase 0, kickoff:** CLAUDE.md, Next.js + TS + Tailwind + Supabase scaffold, `.env.example`, README. ✅
- **Phase 1, database, auth, advisor settings:** migrations for all 8 tables with RLS (advisors see only their own data; admin sees all). Login. Advisor settings screen with the ICP builder. Seed two advisors: one targeting tech execs with equity comp, one targeting business owners near exit.
- **Phase 2, adapters and the daily pipeline (rules only):** adapters for Apollo, SEC EDGAR (Form D, 8-K, S-1, Form 4), Crunchbase and NewsAPI. Nightly pipeline: ~150 candidates → signals → gate → rule score → dedupe → top 25 into `daily_lists`. Admin gets a "Run now" button.
- **Phase 3, Today and Prospect detail:** ranked cards with score, why-now, signal chips and copy buttons. Detail view. CSV export for SimplePipeline.
- **Phase 4, TextTonality engine:** load `/prompts/texttonality.md` at runtime. One Claude call generates opener, FU1 and FU2 for LinkedIn and email as JSON. A checker pass (banned phrases, compliance, length caps, structure) regenerates once on failure. Default send times are converted to the prospect's time zone. Original and edited versions are both stored.
- **Phase 5, Outcomes and prediction:** one-click outcome logging. Python LightGBM service in `/lib/predict`. Nightly retrain at 300+ outcomes. Blend setting and held-out accuracy in Admin.
- **Phase 6, deploy:** app and Python service on Railway, nightly job at 2 AM ET, error alerts by email, a daily credit-spend summary, and a smoke test that runs the pipeline in mock mode on every deploy.

## Conventions

- Run `pnpm lint` and `pnpm build` before you commit.
- Tests and local runs use `ADAPTER_MODE=mock`. Never spend live provider credits in tests.
- Write messages in the TextTonality style only from `/prompts/texttonality.md`. Never invent house rules in code or prompts.
