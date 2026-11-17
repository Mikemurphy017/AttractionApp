# Attractio

Attractio delivers 25 ranked, signal-backed prospects per day to a financial advisor. Each one comes with a LinkedIn URL, a verified email and a TextTonality® draft sequence. **It researches and writes; it never sends.**

- Product and build plan: [PLAN.md](./PLAN.md). Its Decisions log at the top overrides the rest.
- Rules for contributors and AI sessions: [CLAUDE.md](./CLAUDE.md)

## Prerequisites

- **Node.js 20.9+** (22 LTS recommended)
- **pnpm 10+**: `corepack enable` installs the version pinned in `package.json`
- **PostgreSQL 15+** running locally. Any of these works: Postgres.app, `brew install postgresql@16`, or Docker (`docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`).

## Local setup

Install dependencies:

```bash
pnpm install
```

Create a database and a user (adjust the names if you like):

```bash
psql postgres -c "create user attractio with password 'attractio' createdb;" -c "create database attractio owner attractio;"
```

Create your local env file:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set:

- `DATABASE_URL`: the default matches the database above
- `BETTER_AUTH_SECRET`: generate one with `openssl rand -base64 32`
- `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD`: your admin login
- `SEED_PASSWORD`: shared password for the sample logins (8+ characters)

Apply migrations:

```bash
pnpm db:migrate
```

Seed reference data, your admin account and the sample advisors:

```bash
pnpm db:seed:sample
```

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000 and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

### Sample logins (created by `db:seed:sample`, all using `SEED_PASSWORD`)

| Login | Role | Sees |
|---|---|---|
| `dana.advisor@example.com` | Advisor | Dana Whitfield, who targets tech execs with equity comp |
| `marcus.advisor@example.com` | Advisor | Marcus Reyes, who targets business owners near exit |
| `va@example.com` | VA | Both advisors |

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app with hot reload |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Checks to run before committing |
| `pnpm db:generate` | Generate a SQL migration after editing `lib/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Reference data + admin account (safe to re-run; also used in production) |
| `pnpm db:seed:sample` | The above plus sample advisors and a VA (local/staging only) |
| `pnpm db:studio` | Browse the database in Drizzle Studio |

## Users and roles

Self-signup is off. The admin creates every login on the **Admin** screen (`/admin`):

- **Admin** sees everything: advisors, VA assignments, team, and the audit log.
- **VA** sees only the advisors the admin assigns to them. A VA can have several advisors.
- **Advisor** sees only their own settings and lists.

## Deploying to Railway (summary; full setup is Phase 6)

1. Add a **Postgres** service and the app service from this repo.
2. App variables:
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`, both set to the Railway domain
   - `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD`
3. Pre-deploy command: `pnpm db:migrate && pnpm db:seed`. Never use `--sample` in production.
4. Start command: `pnpm start`.

## Environment variables

Every key is listed and commented in [`.env.example`](./.env.example), grouped by the phase that needs it. Real keys go in `.env.local` locally and in Railway variables in production. Never commit them.

## Build phases

0. Kickoff and scaffold ✅
1. Database, auth, advisor settings, admin dashboard ✅
2. Data adapters and the daily pipeline (rules only)
3. Today screen and prospect detail
4. TextTonality message engine
5. Outcomes and the prediction layer
6. Deploy to Railway
