# Attractio

Attractio delivers 25 ranked, signal-backed prospects per day to a financial advisor. Each one comes with a LinkedIn URL, a verified email and a TextTonality® draft sequence. **It researches and writes; it never sends.**

- Product and build plan: [PLAN.md](./PLAN.md)
- Rules for contributors and AI sessions: [CLAUDE.md](./CLAUDE.md)

## Prerequisites

- **Node.js 20.9+** (22 LTS recommended)
- **pnpm 10+**: `corepack enable` installs the version pinned in `package.json`
- **Docker** (Docker Desktop, OrbStack or Colima), which the local Supabase stack runs on
- The Supabase CLI is a dev dependency, so run it as `pnpm supabase …` with no global install

## Local setup

Install dependencies:

```bash
pnpm install
```

Start the local Supabase stack (Postgres, Auth and Studio). The first run pulls Docker images and takes a few minutes:

```bash
pnpm supabase start
```

Create your local env file:

```bash
cp .env.example .env.local
```

Print the local Supabase credentials:

```bash
pnpm supabase status
```

Copy these values from that output into `.env.local`:

| `supabase status` field | `.env.local` key |
|---|---|
| API URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (older CLIs: anon key) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key (older CLIs: service_role key) | `SUPABASE_SECRET_KEY` |
| DB URL | `DATABASE_URL` |

Leave `ADAPTER_MODE=mock` until you're ready to spend real provider credits.

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000. Supabase Studio runs at http://127.0.0.1:54323.

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app with hot reload |
| `pnpm build` | Production build (run before committing) |
| `pnpm lint` | ESLint |
| `pnpm supabase start` / `stop` | Start or stop local Supabase |
| `pnpm supabase migration new <name>` | Create a new migration in `supabase/migrations` |
| `pnpm supabase db reset` | Rebuild the local DB from migrations and the seed |

## Environment variables

Every key is listed and commented in [`.env.example`](./.env.example), grouped by the phase that needs it. Phase 0 needs only the Supabase values. Real keys go in `.env.local` locally and in Railway service variables in production. Never commit them.

## Project layout

```
app/              Next.js routes
lib/env.ts        typed env access
lib/supabase/     Supabase clients (browser, server, service role) + session proxy
lib/sources/      data-provider adapters (Phase 2)
lib/predict/      Python prediction service (Phase 5)
prompts/          TextTonality rules (Phase 4; owned by Bluestone)
supabase/         Supabase config, migrations, seed
proxy.ts          refreshes the auth session on each request
```

## Build phases

0. Kickoff and scaffold ✅
1. Database, auth, advisor settings
2. Data adapters and the daily pipeline (rules only)
3. Today screen and prospect detail
4. TextTonality message engine
5. Outcomes and the prediction layer
6. Deploy to Railway

The phase prompts are in [PLAN.md → Build phases](./PLAN.md#build-phases).
