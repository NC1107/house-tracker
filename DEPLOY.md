# Deploying House Tracker

Two supported paths. For your own server, use **Docker Compose** (below) — it runs the app
and its Postgres together and keeps the database local.

## Option A — Docker Compose (self-hosted, recommended for a server)

Prereqs: Docker Engine + the Compose plugin.

```bash
git clone https://github.com/NC1107/house-tracker.git
cd house-tracker
git checkout claude/housing-price-tracker-ul45rp
cp .env.example .env            # optional edits; defaults work out of the box

# 1) Bring up just the site (calculator works immediately; charts empty until data loads)
docker compose up -d --build web

# -> http://<server-ip>:3000
```

Load data (optional — needs a free FRED key in `.env`):

```bash
# put FRED_API_KEY=... (and CENSUS_API_KEY / HUD_TOKEN if you have them) in .env first
docker compose --profile tools run --rm tools npm run db:migrate
docker compose --profile tools run --rm tools npm run seed:geo
docker compose --profile tools run --rm tools npm run ingest:fred
docker compose --profile tools run --rm tools npm run ingest:zillow
```

Everything at once:

```bash
docker compose up -d --build          # db + web
```

Useful ops:

```bash
docker compose logs -f web            # tail logs
docker compose ps                     # status
docker compose down                   # stop (keeps the pgdata volume)
docker compose down -v                # stop and wipe the database
```

The `web` container listens on 3000; publish a different host port with `WEB_PORT` in `.env`.
Put it behind a reverse proxy (Caddy/nginx/Traefik) for TLS + a domain.

### Keeping data fresh

Ingestion is a one-shot command. To refresh nightly, add a host crontab entry:

```
30 9 * * * cd /path/to/house-tracker && docker compose --profile tools run --rm tools sh -c "npm run ingest:fred && npm run ingest:zillow" >> /var/log/house-tracker-ingest.log 2>&1
```

(The included `.github/workflows/ingest.yml` does the same on GitHub-hosted runners if you
prefer that instead.)

## Option B — Vercel (managed, no server)

Import the repo in Vercel, attach a Postgres (Vercel Postgres / Neon), set the same env
vars, and deploy. Run the migrate/seed/ingest commands once locally against that database,
or let the GitHub Action populate it. Vercel is simplest but keeps the DB off your box.

---

Estimates are for planning only — not a lending decision.
