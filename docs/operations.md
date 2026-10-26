# Running and operating Ballknowledge

## Local development and production builds

Use Node.js 22+ and Python 3.11+. `npm ci` installs the locked frontend dependencies. `npm run dev` starts both the Python API and Next.js at http://127.0.0.1:3000. The Python launcher creates `.tools/data-env` and installs the pinned API requirements when needed. Windows users can run `./dev.ps1` instead.

For a production build, run `npm run build`, then `npm start`. The start script launches the API and the standalone Next.js server, copies its static assets, and stops both children when interrupted. `npm start -- --port 3002` chooses another web port. The API defaults to port 8000. The API origin is included when Next.js is built: rebuild after changing `API_ORIGIN`.

SQLite is the local default; no database service is required. The API applies versioned Alembic migrations and transactionally imports validated snapshots at startup. Invalid imports preserve the previously imported season. The source cache and local database live in ignored `.data-cache`.

If Windows Application Control blocks SQLAlchemy's optional compiled extension, the API launcher installs its supported pure-Python source build. It does not change Windows policy. See the [SQLAlchemy installation guide](https://docs.sqlalchemy.org/en/21/intro.html#building-the-cython-extensions).

## PostgreSQL and containers

Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` to a strong unique password. Do not commit `.env`. Run:

```sh
docker compose up --build -d
```

The stack contains PostgreSQL 18, FastAPI and Next.js. Only the web port is published, bound to localhost. PostgreSQL credentials are passed separately to SQLAlchemy, so passwords containing URL-special characters do not need manual encoding. The API and web run as unprivileged users with read-only root filesystems and explicit writable volumes.

The `postgres` volume stores database facts and caches. `snapshots` holds validated content-addressed source files; `source-cache` holds raw downloads. PostgreSQL 18 uses the [official image's `/var/lib/postgresql` volume location](https://hub.docker.com/_/postgres). Existing named snapshot volumes are preserved across image rebuilds. Import new historical snapshots into that volume explicitly; rebuilding an image does not overwrite a populated volume.

Docker and PostgreSQL are not installed in the development environment used for this implementation. Their runtime path must pass the PostgreSQL CI job and a container smoke test before a public production release. Local SQLite, migrations, HTTP contracts and browser flows are checked separately; those checks do not prove the container stack ran.

## Refresh, corrections and backfills

For an audited current-season refresh, use the isolated Python environment:

```sh
# Windows: .tools/data-env/Scripts/python.exe
# Bash on macOS/Linux: .tools/data-env/bin/python
python -m services.api.jobs.refresh --season 2026-27
```

The `python` in that command must be the environment with the API dependencies installed. A successful run publishes validated snapshots, imports the relational facts, and records its outcome in `refresh_runs`. A failed refresh retains the last good snapshot and facts. `/api/health` reports the most recent refresh status. Process interruption can leave a `running` record; investigate its timestamp before restarting a scheduler.

The chosen first-release scheduler is a single daily process, with no queue or Redis dependency:

```sh
docker compose --profile refresh up -d refresh
```

It runs immediately and every 24 hours afterward. Run only one refresh process against a snapshot volume. The current-season selection is fixed for that process; update it at season rollover. The interval can be configured through the refresh CLI, with a one-hour minimum.

The explorer fetches the current database manifest before requesting an immutable snapshot. This makes corrections available without rebuilding the frontend. Browser snapshots are reused for up to one minute when revisiting a season. An already-open analysis remains a snapshot until reloaded. Links with `window=season` expand to the newest imported season window; explicit custom dates stay fixed. Advanced feeds have their own retrieval times and can be ahead of imported finals; mismatched samples remain unavailable.

Backfill another season with `python scripts/sync_data.py --seasons 2022-23 --refresh`. For playoffs add `--season-type Playoffs --provider nba-api`. Restart the API to import the resulting manifests, then rebuild the frontend to expose newly added season choices. Existing-season corrections do not require that rebuild.

## Availability, limits and diagnostics

`GET /api/health` checks database connectivity and imported seasons. `GET /api/seasons` reports coverage; `GET /api/metrics` exposes the versioned catalog; `/api/docs` documents the HTTP contracts. Requests report duration in `Server-Timing`. API logs include request method, path, status and duration; provider logs include source, row count, duration and failure type. Query bodies, credentials and environment values are not logged.

Public analysis requests have bounded metric/filter lists, a 64 KiB body limit, pagination, an eight-analysis concurrency limit and bounded provider concurrency. NBA requests are paced, time-limited, coalesced per scope within one API process and persisted. Successful aggregate feeds are cached for one hour; schedule responses for 30 seconds; failures for one minute. `NBA_NETWORK_ENABLED=0` permits cached sources and returns explicit unavailability for uncached feeds, useful in CI and offline environments.

Use one API worker initially. Multiple workers or replicas need distributed refresh/source coordination before increasing outbound capacity. A public host additionally needs TLS, edge rate limits, backups, external health/freshness alerts and authorized data redistribution. No hosted deployment, account service or commercial data feed is included.

## Backup and rollback

Back up PostgreSQL with `pg_dump` and back up the snapshot volume alongside the dump. Rehearse restoration into a separate database. For local SQLite, stop the app before copying its database and WAL files, or use SQLite's backup API. Do not delete volumes to roll back an application release.

Keep a previous application image and its matching snapshot manifest. Restore that image for code rollback; preserve the database while investigating. Schema changes are versioned in `services/api/migrations`; destructive downgrades are not a routine rollback procedure. Raw source downloads and content-addressed files allow a validated historical snapshot to be republished if the provider corrects a season incorrectly.

## Verification

```sh
npm test
npm run typecheck
npm run test:data
npm run test:api
npm run build
npm run test:e2e
```

API tests require the API environment; install `services/api/requirements-dev.txt` to run Ruff as well. The GitHub workflow adds PostgreSQL migration/integration checks and installed Chromium. Browser tests use Google Chrome locally and run against the production build. Screenshots are saved under `.impeccable/review`. Windows trace artifacts use `%TEMP%/ballknowledge-playwright/<workspace-hash>` to avoid OneDrive file locks; other platforms use `test-results`. `PLAYWRIGHT_OUTPUT_DIR` can override that location. Trace collection remains enabled.
