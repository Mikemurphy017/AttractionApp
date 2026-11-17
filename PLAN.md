# Attractio — Build Plan

## What we're building

Attractio is a web app that delivers **25 ranked, signal-backed prospects per day** for a financial advisor, each with a LinkedIn URL, a verified email, and a ready-to-send TextTonality® sequence (opener + 2 follow-ups with ideal send times). **It researches and writes; it never sends.**

**How to use this doc with Claude Code:** export it as Markdown, save it as PLAN.md in an empty project folder, then run the phase prompts in the Build Phases section one at a time. Paste the Product Summary and Compliance sections into a CLAUDE.md so every session follows them.

**How it differs from Revnu:** Revnu finds companies and buyers, writes outreach in your voice, and also sends it, handles replies and books meetings across Gmail, Outlook and LinkedIn. We keep the research and writing, drop all sending, and add three things Revnu doesn't have:

- **Advisor-specific signals** — liquidity events (funding, acquisitions, IPO/lockup, exec job changes, retirements) rather than generic B2B intent like tech stack.
- **A predictive layer** — our own model that learns which signal patterns precede a booked call and scores prospects before the obvious signal fires.
- **TextTonality messaging** — pain, intrigue, subliminal call to action, written to our rules, not a generic "your voice" prompt.

Revnu does return a fit score (0–100), a "why we picked them" explanation and signal sources per lead; we'll match that so every prospect card shows its evidence.

## MVP scope

The MVP is single-tenant: Bluestone runs it internally for client advisors first, then it becomes a product.

| In the MVP | Not in the MVP |
|---|---|
| Advisor profiles (ICP, niche, geography, firm, compliance notes) | Sending email or LinkedIn messages |
| Nightly signal ingest + scoring | LinkedIn scraping or browser automation |
| 25 ranked prospects per advisor per day, deduped | Reply handling or inbox management |
| LinkedIn URL + verified email per prospect | Phone numbers (phase 2 — for the warm caller team) |
| TextTonality opener + 2 follow-ups + send times | Self-serve signup, billing, multi-tenant |
| Approve / edit / reject + outcome tracking | CRM sync (CSV export only for now) |
| Feedback loop that trains the prediction model | Mobile app |

## Tech stack and data sources

Use licensed data APIs for every contact field. **Never scrape LinkedIn**: it breaks LinkedIn's terms and puts the Sales Navigator accounts your clients depend on at risk.

### Stack

- **App:** Next.js (TypeScript) + Tailwind, deployed on Railway (already connected) or Vercel.
- **Database + auth:** Supabase (Postgres, row-level security, pgvector for pattern matching later).
- **Jobs:** a nightly worker (Railway cron or Inngest) that runs the pipeline per advisor.
- **AI:** Claude API for signal summarization and message writing; Python service (scikit-learn / LightGBM) for the prediction model once there's outcome data.

### Data sources (each behind its own adapter file so providers can be swapped)

| Need | Primary | Backup / free |
|---|---|---|
| People search, title, seniority, LinkedIn URL, email | Apollo API (already in your stack) | People Data Labs, Clay |
| Email verification | Apollo verification | ZeroBounce or NeverBounce |
| Funding rounds | Crunchbase API | SEC EDGAR Form D (free) |
| Exits, M&A, IPOs, insider sales | SEC EDGAR 8-K, S-1, Form 4 (free) | PitchBook (expensive, later) |
| Job changes, promotions, retirements | Apollo job-change data | Sales Nav export CSV upload |
| News cycle | NewsAPI or GDELT | Google News RSS |
| Company hiring/growth | Apollo job postings | — |

All API keys go in `.env`; budget roughly 100–150 enrichment credits per advisor per day (25 kept out of a larger candidate pool). Confirm current provider pricing before Phase 2.

## Data model

Eight tables cover the MVP; `outcomes` is the one that makes the prediction layer possible, so it ships on day one.

| Table | Key fields |
|---|---|
| advisors | name, firm, niche, target titles, seniority, industries, geography, AUM minimum, compliance notes, daily quota (default 25) |
| prospects | name, title, seniority, company, LinkedIn URL, email, email status, location, first seen |
| companies | name, domain, industry, headcount, funding stage, last round amount/date |
| signals | prospect/company id, type, date, headline, source URL, raw JSON, strength 0–1 |
| scores | prospect id, advisor id, rule score, predicted score, final score, reason text, model version |
| daily_lists | advisor id, date, 25 prospect ids, rank |
| messages | prospect id, slot (opener / FU1 / FU2), channel, body, send window, status (draft / approved / edited / rejected), editor notes |
| outcomes | prospect id, sent at, replied, positive reply, booked call, client won, date of each |

Every prospect is deduped on LinkedIn URL + email, and suppressed for 180 days once shown to an advisor.

## Daily pipeline

A nightly job per advisor pulls about 150 candidates, scores them, and keeps the top 25 for a 6 AM delivery in the advisor's time zone.

The advisor (or a Bluestone VA) sends approved messages by hand; logging what happens is what trains the model.

### Signal types and starting weights (stored in a config table so you can tune them without code)

| Signal | Source | Starting weight |
|---|---|---|
| Company raised a round (Seed–Series D) in last 60 days | Crunchbase / Form D | 0.9 |
| Acquisition, merger or IPO announced; lockup ending | 8-K, S-1, news | 1.0 |
| Insider stock sale (Form 4) | EDGAR | 0.8 |
| Promoted to VP / C-suite / partner in last 6 months | Apollo job changes | 0.8 |
| Changed companies in last 12 months (401k rollover, new equity) | Apollo job changes | 0.7 |
| Company in the news: layoffs, restructuring, big contract | NewsAPI / GDELT | 0.5 |
| Long tenure + senior title (retirement window) | Apollo | 0.5 |
| Fits advisor ICP (title, seniority, industry, geography) | Apollo | gate: must pass |

### Scoring

1. **Gate:** drop anyone outside the advisor's ICP, without a verified email, or already shown in the last 180 days.
2. **Rule score (day one):** sum of signal weights × recency decay (half-life 30 days) × seniority multiplier.
3. **Predicted score (proprietary layer):** a model that learns from outcomes which combinations of signals, titles, industries and timing precede a positive reply or booked call. It can rank someone high before the obvious event fires (e.g. a CFO two quarters into a company that just hired an investment bank).
4. **Final score** = blend of rule and predicted, starting 100% rules and shifting toward the model as outcome data grows (roughly 300+ logged outcomes before trusting it).
5. **Reason text:** Claude writes a two-sentence "why now" from the top signals, with source links.

Keep the model, features and weights in a private module (`/lib/predict`) — that's the IP.

## TextTonality message engine

Each prospect gets three messages built from their top signal, written to TextTonality's structure: pain, intrigue, subliminal call to action. The rules live in one private file, `/prompts/texttonality.md`, that you write and Claude Code never edits.

### What goes in texttonality.md (you fill this in; it's the IP)

- The three-part structure and what each part must and must not do.
- Slot rules: what the opener, follow-up 1 and follow-up 2 each do differently.
- Banned phrases (start with: "comparing notes", "compare notes", "I hope this finds you well", "quick call", "touch base").
- Length caps: LinkedIn opener under 300 characters (fits a connection note); email under 90 words.
- 5–10 gold-standard example sequences from real campaigns, labeled by signal type.

### How a message is generated

1. Load the advisor profile, the prospect's top 2 signals with source links, and texttonality.md.
2. Claude writes the opener, FU1 and FU2 for both LinkedIn and email in one call, returning JSON.
3. A checker pass rejects anything with a banned phrase, an unsupported claim, a guarantee or performance promise, or a missing pain/intrigue/CTA element, then regenerates once.
4. Every advisor edit is stored next to the original, so the best edits can become new examples.

### Send timing (defaults, in the prospect's local time; the model adjusts them per segment as outcomes come in)

| Message | When | Window |
|---|---|---|
| Opener | Next Tue, Wed or Thu after the list drops | 7:30–9:00 AM |
| Follow-up 1 | 3 business days after opener | 12:00–1:00 PM |
| Follow-up 2 | 7 business days after FU1 | 4:30–6:00 PM |

These are starting assumptions, not proven numbers; your Day 1/3/5/14 cadence data from SimplePipeline is a better seed if you can export it.

## UI screens

Five screens are enough for the MVP; the Today screen is where advisors spend 90% of their time.

1. **Today** — the 25 prospect cards, ranked. Each card: name, title, company, score (0–100), "why now" in two sentences, signal chips with source links, LinkedIn and email buttons (copy to clipboard), and a status dropdown.
2. **Prospect detail** — full signal timeline, the three messages in LinkedIn and email tabs with edit-in-place, suggested send time for each, and Approve / Reject (with reason) buttons.
3. **Outcomes** — one-click logging per prospect: Sent, Replied, Positive, Booked, Client. This is the training data, so make it fast.
4. **Advisor settings** — ICP builder (titles, seniority, industries, geography, signal weights), daily quota, compliance notes, time zone.
5. **Admin (Bluestone only)** — all advisors, pipeline run logs, credit usage per provider, model version and its accuracy on recent outcomes.

**Export:** CSV of the day's list with messages, formatted for SimplePipeline import.

## Compliance and guardrails

Your buyers are regulated, so compliance is a selling point, not an afterthought; have a securities attorney review this list before launch (this isn't legal advice).

- **Advisor communications rules:** messages advisors send are likely retail correspondence under FINRA and SEC marketing rules. The checker blocks guarantees, performance claims and testimonials, and every approved message gets a timestamped audit record the advisor can hand to their compliance team.
- **Wirehouse advisors** (Merrill, Wells Fargo, RBC, LPL) usually must send through firm-approved, archived channels. The app only drafts; it never sends, which keeps it out of that problem.
- **Email law:** cold email must follow CAN-SPAM (accurate sender, physical address, working opt-out). Add an opt-out footer to every email draft by default.
- **Personal data:** US prospects only in the MVP (avoids GDPR). Store only work data from licensed providers, honor deletion requests, and keep a suppression list checked before every daily list.
- **No LinkedIn automation or scraping, ever** — drafts are copied and sent by a person.
- **Protect the IP:** private repo, texttonality.md and `/lib/predict` excluded from any shared builds, API keys in environment variables only.

## Build phases

Six phases, each one a single Claude Code session ending in something you can click; don't start the next until the current one works with real data.

### Phase 0 — Kickoff (paste first)

Read PLAN.md fully. We're building Attractio, the app it describes. Before writing code, create CLAUDE.md summarizing the product, the stack, the hard rules (never send messages, never scrape LinkedIn, never edit /prompts/texttonality.md, all data providers behind adapters), and the six phases. Then scaffold a Next.js + TypeScript + Tailwind app with Supabase, a .env.example listing every key we'll need, and a README with local setup steps. Ask me any questions before you start building.

### Phase 1 — Database, auth, advisor settings

Implement the Data model section of PLAN.md as Supabase migrations with row-level security (advisors see only their own data; admin sees all). Build login and the Advisor settings screen with the ICP builder. Seed two sample advisors: one targeting tech executives with equity comp, one targeting business owners near exit.

### Phase 2 — Data adapters and the daily pipeline (rules only)

Build adapters in /lib/sources for Apollo (people search, enrichment, email verification, job changes), SEC EDGAR (Form D, 8-K, S-1, Form 4), Crunchbase (funding), and NewsAPI. Each adapter has the same interface, caches responses, logs credit usage, and has a mock mode for tests. Then build the nightly pipeline from the Daily pipeline section: pull ~150 candidates per advisor, attach signals, apply the gate, compute the rule score with weights from a config table, dedupe, and save the top 25 to daily_lists. Add a manual "Run now" button in Admin. Show me a run for one sample advisor.

### Phase 3 — Today screen and prospect detail

Build the Today and Prospect detail screens from the UI screens section. Each card shows the score, a two-sentence "why now" written by Claude from the top signals with source links, and copy buttons for LinkedIn URL and email. Add the CSV export formatted for SimplePipeline import.

### Phase 4 — TextTonality message engine

Build the message engine from the TextTonality section. Load /prompts/texttonality.md at runtime (I'll fill it in; create it with placeholder headings only). Generate opener, FU1 and FU2 for LinkedIn and email in one Claude API call returning JSON, then run the checker pass for banned phrases, compliance issues, length caps and missing structure, regenerating once on failure. Add suggested send times per the defaults table, converted to the prospect's time zone. Store original and edited versions of every message.

### Phase 5 — Outcomes and the prediction layer

Build the Outcomes screen with one-click logging. Then build /lib/predict as a separate Python service: feature extraction from signals, titles, industries, company stage and timing; a LightGBM model predicting positive reply and booked call; nightly retraining once there are 300+ outcomes; and a blend setting in Admin that shifts from rule score to predicted score. Show model accuracy on held-out recent outcomes in Admin. Until there's enough data, the service returns null and the rule score is used.

### Phase 6 — Deploy

Deploy the app and the Python service to Railway with the nightly job scheduled at 2 AM Eastern. Add error alerts to my email, a daily credit-spend summary, and a smoke test that runs the pipeline in mock mode on every deploy.
