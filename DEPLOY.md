# Deploying House Tracker

Fully self-hosted — the app and its Postgres run together in Docker on your own server, no
external database. Two paths: **Option A** pulls the prebuilt image from GHCR (simplest);
**Option B** builds it locally. Both keep the database on your box.

## Option A — Prebuilt image from GHCR (no local build)

The `Build and publish image` GitHub Action (`.github/workflows/docker-publish.yml`) builds
and pushes two images on every push to the branch:

- `ghcr.io/nc1107/house-tracker` — the web app
- `ghcr.io/nc1107/house-tracker-tools` — migrations / seeding / ingestion jobs

Once that workflow has run at least once (check the repo's **Actions** and **Packages**
tabs), deploy on the server:

```bash
git clone https://github.com/NC1107/house-tracker.git
cd house-tracker
git checkout main
cp .env.example .env                       # defaults work out of the box

# If the GHCR packages are private, authenticate once (or make them public in Packages settings):
#   echo <GITHUB_PAT_with_read:packages> | docker login ghcr.io -u <your-username> --password-stdin

docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
# -> http://<server-ip>:3000
```

On startup a one-shot `migrate` service creates the tables and seeds the geographies
automatically, then the web app starts — so it boots clean with no manual DB steps. The
affordability calculator works immediately; price/rate charts stay empty until you ingest.

Load data (optional — needs a free FRED key in `.env`):

```bash
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run db:migrate
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run seed:geo
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:fred
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:zillow
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:redfin
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:realtor
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:redfin-metro
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:fhfa
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:census
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:fmhpi
docker compose -f docker-compose.ghcr.yml --profile tools run --rm tools npm run ingest:hud
```

`ingest:redfin`, `ingest:realtor`, `ingest:redfin-metro`, and `ingest:fhfa` need no API
key. Redfin powers the Market Heat page (skip it and Market Heat stays on its "data not
loaded" notice); the metro tracker adds per-metro heat scores; Realtor.com adds asking
prices and new listings to the Region Explorer; FHFA adds the since-1975 price index.
`ingest:census` needs a free CENSUS_API_KEY and loads per-state median incomes.

Pin a specific build with `IMAGE_TAG` in `.env` (e.g. `IMAGE_TAG=sha-abc1234`); defaults to
`latest`.

## Option B — Build locally with Docker Compose

Prereqs: Docker Engine + the Compose plugin.

```bash
git clone https://github.com/NC1107/house-tracker.git
cd house-tracker
git checkout main
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
docker compose --profile tools run --rm tools npm run ingest:redfin
docker compose --profile tools run --rm tools npm run ingest:realtor
docker compose --profile tools run --rm tools npm run ingest:redfin-metro
docker compose --profile tools run --rm tools npm run ingest:fhfa
docker compose --profile tools run --rm tools npm run ingest:census
docker compose --profile tools run --rm tools npm run ingest:fmhpi
docker compose --profile tools run --rm tools npm run ingest:hud
```

`ingest:redfin`, `ingest:realtor`, `ingest:redfin-metro`, and `ingest:fhfa` need no API
key. Redfin powers the Market Heat page (skip it and Market Heat stays on its "data not
loaded" notice); the metro tracker adds per-metro heat scores; Realtor.com adds asking
prices and new listings to the Region Explorer; FHFA adds the since-1975 price index.
`ingest:census` needs a free CENSUS_API_KEY and loads per-state median incomes.

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

**Security:** change `POSTGRES_PASSWORD` in `.env` from the default before exposing the host
to any network, and don't publish Postgres's 5432 port publicly (the compose files keep it
on the internal Docker network by default).

### Email alerts (optional)

Set `RESEND_API_KEY` (free at resend.com) and `ALERT_EMAIL` (your address) in `.env`, add
rules on the **Alerts** page, and the daily job (`npm run alerts:run`, already wired into the
ingest workflow / crontab) emails you when a rule fires. Use "Send test email" to verify.

Saved-search alerts ("a home matching my filters hits the market") check live listings on
the same schedule. Homes move fast; to check more often than daily, add a second crontab
entry running just `alerts:run` (it is cheap), e.g. every 2 hours:

```
0 */2 * * * cd /path/to/house-tracker && docker compose --profile tools run --rm tools npm run alerts:run >> /var/log/house-tracker-alerts.log 2>&1
```

### Keeping data fresh

Ingestion is a one-shot command. To refresh nightly, add a host crontab entry:

```
30 9 * * * cd /path/to/house-tracker && docker compose --profile tools run --rm tools sh -c "npm run ingest:fred && npm run ingest:zillow && npm run ingest:redfin && npm run ingest:redfin-metro && npm run ingest:realtor && npm run ingest:fhfa && npm run ingest:fmhpi && npm run alerts:run" >> /var/log/house-tracker-ingest.log 2>&1
```

(The included `.github/workflows/ingest.yml` does the same on GitHub-hosted runners if you
prefer that instead.)

This stack is fully self-hosted: the app and its Postgres both run in Docker on your box,
with no external/managed database. The database lives in the `pgdata` volume on the host.

---

Estimates are for planning only — not a lending decision.
