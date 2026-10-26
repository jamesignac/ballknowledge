# ballknowledge

A working NBA analytics app with Next.js, React, TypeScript and a Python FastAPI service. Public NBA data comes first; unsupported metrics are labeled unavailable.

## Run locally

On this Windows checkout, run:

```powershell
.\dev.ps1
```

Then open **http://127.0.0.1:3000**. The script uses an installed Node.js runtime or the portable runtime in this checkout's ignored `.tools` directory.

With Node.js 22+ and Python 3.11+ installed, including Bash:

```sh
npm ci
npm run dev
```

The launcher starts both servers, initializes the local SQLite database and installs pinned Python dependencies into `.tools/data-env` if needed. Open http://127.0.0.1:3000. Stop both servers with Ctrl+C.

## Try the core workflow

1. Search for a player, or open Filters to choose a team, position, date window, and minimum sample.
2. Change the scatter axes or sort a database column to explore the same eligible players.
3. Open a player to inspect scoring trends and game logs.
4. Use the + buttons to add up to four players, then choose Compare.
5. Share the URL, save the analysis locally, or export a CSV containing its filters and provenance.

Open **Advanced research** or `/stats` for 318 metric definitions, column presets, custom columns, stat thresholds, percentile shading and per-possession views. Its tabs include five-player season comparisons, shot zones, play types, team ratings/four factors, team comparisons, lineups/matrix, on/off, matchups, playoffs and historical pooling. The original explorer and four-player comparison remain available.

The calendar links day/month windows to statistics and exposes standings and imported game boxes. Player profiles include performance splits and career totals. Player rankings persist locally and export CSV. Routes such as `/players`, `/stats`, `/season/2024-25`, `/lineups`, `/explore/history` and `/rankings/players` open the corresponding workspace directly.

## Data boundaries

**The MVP now uses real NBA Stats game logs imported through `nba_api`.** The initial import includes the current 2026-27 season plus complete 2025-26, 2024-25, and 2023-24 regular seasons, with every recorded player appearance. The app displays observed coverage and retrieval time; snapshots are not a live feed.

Three completed playoff seasons are also imported. The explorer reads the current API manifest and downloads validated, content-addressed snapshots one season at a time. The API imports those facts transactionally and caches scoped NBA aggregate feeds. Team filters respect trades, percentages use summed components and missing roster details remain unavailable. Advanced, tracking, hustle, zone, lineup and on/off values come from NBA endpoints; they are not inferred from basic box scores. These observations do not establish causal impact.

Refresh source files from Bash or PowerShell with Python 3.11+:

```sh
python scripts/sync_data.py --refresh
```

The wrapper installs pinned dependencies in an isolated workspace environment. `npm run data:sync` is equivalent; restart the API afterward to import the refreshed facts. For an audited refresh that also imports the database, run `python -m services.api.jobs.refresh` using the API environment. Existing-season corrections reach the explorer without rebuilding the frontend. Newly added seasons require a rebuild to expose their menu choices.

The original comparison retains the shared season/window. Advanced player and team comparisons select full seasons independently and state that scope explicitly. The advanced CSV includes every matching player, definitions and source retrieval times. Saved views and rankings remain browser-local; accounts are optional future work. See [implementation status](docs/implementation-status.md) for delivered capabilities and explicit data gaps.

## Verification

```sh
npm test
npm run test:data
npm run test:api
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests use isolated Google Chrome locally and start the production web/API servers. Build first. Tests cover data correctness, scopes, normalization, filters, profiles, comparisons, saved state, exports, responsive layouts and accessibility. Screenshots are written to ignored `.impeccable/review`. CI additionally defines PostgreSQL migration/integration checks.

`npm run build` creates a standalone production build; `npm start` runs it with the API. A static `out/` server no longer runs the complete app. PostgreSQL, containers, daily refresh, backup/rollback and launch requirements are documented in [operations](docs/operations.md). Docker/PostgreSQL runtime validation remains required before public production release.

## Assets and design

Player headshots come from `https://cdn.nba.com/headshots/nba/latest/260x190/{playerId}.png`. They are included for this local demonstration; confirm appropriate image rights before public distribution. Fonts are self-hosted Manrope and Barlow Condensed from Google Fonts, with their SIL Open Font License files in `public/fonts/`. The basketball mark is original SVG geometry. Fonts and imported statistics are local. Existing portraits are served locally; other player headshots load from the NBA CDN with an initials fallback.

`PRODUCT.md` records the product scope. `DESIGN.md` records the implemented visual system. `ARCHITECTURE.md` retains the broader production specification.
