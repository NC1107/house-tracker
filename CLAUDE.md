# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal, single-user dashboard tracking US housing prices, mortgage rates, and what the owner can afford to buy, built entirely on free public data (Zillow, Redfin, Realtor.com, FRED, FHFA, Census, HUD, Freddie Mac).
Stack: Next.js 15 App Router, React 19, TypeScript strict, Tailwind, Recharts, Drizzle ORM on Postgres.
Deployed self-hosted via Docker (see `DEPLOY.md`); `next.config.mjs` uses `output: "standalone"` for that image.

## Commands

- `npm run dev` - dev server at http://localhost:3000; the affordability calculator works with no database configured
- `npm test` - run the vitest suite; single file: `npx vitest run lib/affordability.test.ts`
- `npm run test:watch` - vitest watch mode
- `npm run lint` - next lint
- `npm run build` - production build

Database and data (all require `DATABASE_URL`; copy `.env.example` to `.env`):

- `npm run db:generate` / `npm run db:migrate` - drizzle-kit migrations (schema in `db/schema.ts`, SQL in `db/migrations/`)
- `npm run seed:geo` - seed the geography spine and metric catalog (run before any ingest)
- `npm run ingest:<source>` - one script per source (`fred`, `zillow`, `redfin`, `realtor`, `redfin-metro`, `redfin-city`, `fhfa`, `census`, `fmhpi`, `hud`); `fred`, `census`, `hud` need API keys from `.env`
- `npm run alerts:run` - evaluate alert rules and email via Resend

Nightly ingestion runs in GitHub Actions (`.github/workflows/ingest.yml`), not on the web host, to avoid serverless timeouts.

## Architecture

### Data model: one table for all time series

`db/schema.ts` defines a single geography spine (`geographies`: nation → state → metro → county → city → zip, keyed by FIPS/CBSA/ZIP codes) and one long-format `metric_series` table for every time series (prices, rents, inventory, income, HPI, ...).
`metric_catalog` describes each `metric_key` (label, unit, category, source) and drives the UI.
Adding a new metric means adding a catalog row and ingesting rows into `metric_series` - no schema change.

### Ingestion pipeline

`scripts/ingest-*.ts` are thin tsx entry points; fetching/parsing lives in `lib/sources/*`, and shared helpers live in `lib/ingest.ts` (`parseCsv`, `wideToLong` for Zillow/Realtor wide CSVs, `upsertSeries` which dedupes the batch, sanity-checks value ranges, and upserts on `(geography_id, metric_key, period_date)`).
Geography resolution during ingest uses in-memory code/name indexes from `loadGeoIndex`/`loadGeoIndexByName`.

### Pure calculation engines with colocated tests

The domain logic is in pure, dependency-free modules in `lib/`, each with a colocated `*.test.ts`:
`affordability.ts` (amortization, full PITI, PMI/FHA-MIP, DTI, Conventional/QM/FHA guideline sets, reverse max-price solver - validated against authoritative amortization vectors), `rentvsbuy.ts`, `marketheat.ts`, `trends.ts`, `costofwaiting.ts`, `stateAffordability.ts`, and `alerts.ts` (rule evaluation returning a message plus a dedupe key; delivery is separate in `lib/notify.ts`).
Keep new domain logic in this pattern: pure function in `lib/`, test file next to it.

### Pages: server components that degrade gracefully

Every `app/*/page.tsx` is an async server component (`force-dynamic`); interactivity lives in `"use client"` components under `components/`.
All UI reads go through `lib/queries.ts`, whose `safe()` wrapper returns a fallback (friendly empty state) when `DATABASE_URL` is unset or the query fails - pages must never crash without a database.
Reads are wrapped in a 15-minute `unstable_cache` (`cachedQuery`), skipped outside the Next runtime so tsx scripts hit the DB directly; user-mutable data (alert rules) is intentionally not cached.

### Single-user model, no auth

The buyer profile (income, down payment, home state/cities, work address) lives in a cookie: `lib/profile.ts` reads it server-side with clamping/validation, `components/ProfileControls.tsx` writes it, `lib/profile-shared.ts` holds the shared shape.
Alert rules live in the DB owned by a single owner row keyed off `ALERT_EMAIL` (`lib/owner.ts`).

### Live listings are gray-area and must degrade

`lib/sources/redfin-live.ts` (used by `/deals`) hits Redfin's unofficial `gis-csv` endpoint with baked-in region ids - it can break or rate-limit at any time, so every caller must handle failure gracefully.

### Path alias

`@/*` maps to the repo root (both tsconfig and vitest are configured for it).
