# House Tracker

A personal dashboard to monitor US housing prices, mortgage rates, and **what we can
afford to buy** — drillable from national → state → metro → county → ZIP, built entirely
on free public data.

## Status

Phase 1 foundation:

- **Bank-grade affordability engine** (`lib/affordability.ts`) — amortization, full PITI,
  PMI/FHA-MIP, front/back-end DTI, Conventional / QM / FHA guideline sets, conforming-limit
  (jumbo) flag, and a reverse max-price solver. Validated in `lib/affordability.test.ts`
  against authoritative amortization vectors. Run `npm test`.
- **Working affordability calculator UI** (`/affordability`) — no database required.
- **Data model** (`db/schema.ts`) — unified `metric_series` for all time series + a
  geography spine, mortgage rates, users, watchlist, and a generic alert-rule engine.
- **Ingestion** (`scripts/`, `lib/sources/`) — FRED (rates, Case-Shiller) and Zillow
  (ZHVI, ZORI) with a wide→long normalizer; scheduled via GitHub Actions.
- **Dashboard pages** — Overview, Region Explorer, Affordability, Alerts (planned surface).

See `PLAN` in the session for the full roadmap (rent-vs-buy, market heat, deal signals,
choropleth, notifications, and deferred Phase 2 listing search via RentCast).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 — affordability calculator works immediately

npm test             # run the affordability validation suite
```

### With data (optional)

1. Copy `.env.example` → `.env` and set `DATABASE_URL` (a local Postgres) plus free API keys
   (`FRED_API_KEY`, `CENSUS_API_KEY`, `HUD_TOKEN`).
2. Create tables and load data:

```bash
npm run db:migrate
npm run seed:geo      # nation + states + metric catalog
npm run ingest:fred    # mortgage rates, Case-Shiller, housing starts (needs FRED_API_KEY)
npm run ingest:zillow  # ZHVI, ZORI (no key)
npm run ingest:redfin  # market heat: inventory, DOM, price cuts, sale-to-list (no key)
npm run ingest:realtor # asking prices, new listings, pending ratio (no key)
```

## Data sources (all free)

Zillow Research (ZHVI/ZORI), Redfin Data Center, Realtor.com research, FRED (Case-Shiller,
mortgage rates), US Census ACS (income), HUD (ZIP crosswalk, FMR). Live for-sale listings
are a deferred Phase 2 (RentCast). Estimates are for planning only — not a lending decision.
