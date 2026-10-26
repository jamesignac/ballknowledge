# NBA data sources and refresh guide

Evaluated October 25–26, 2026. The app uses **NBA Stats via `nba_api`**, validated snapshots and a local analytics API. Basic facts remain available from imported data; advanced observations depend on the scoped NBA feed or its cache. Synthetic records are never mixed into real seasons.

| Method | Coverage and practical limits | Decision |
| --- | --- | --- |
| [`nba_api`](https://github.com/swar/nba_api) | Community Python client for NBA.com endpoints. Bulk player game logs, team game logs, season rosters, schedules, and additional statistical endpoints. Reachability varies by network; the library is not a contractual data service. | Primary ingestion provider. Verified from this machine. |
| [SportsDataverse NBA Stats archives](https://github.com/sportsdataverse/hoopR-nba-stats-data) | Public season files derived from NBA Stats, retaining NBA IDs. Historical box scores, schedules, and rosters. Archive availability and freshness must be checked per asset. | Implemented fallback. Independently normalized and validated for 2024–25; same 569-player/1,230-game/26,306-appearance coverage as the direct import. |
| [NBA live CDN through `nba_api`](https://github.com/swar/nba_api/tree/master/docs/nba_api/live/endpoints) | Scoreboards, live box scores, and play-by-play. Useful for current game state; it is a different data contract from completed season statistics. | Future live scoreboard; not substituted for historical coverage. |
| [SportsDataverse ESPN/hoopR archives](https://github.com/sportsdataverse/hoopR-nba-data) | Bulk ESPN schedules, player/team box scores, and other datasets. ESPN entity IDs need an audited crosswalk to NBA IDs. | Researched secondary recovery option; not connected or silently combined. |
| [BALLDONTLIE](https://docs.balldontlie.io/#account-tiers) | API key required. Free access includes players, teams, and games; player game statistics require a paid tier. Documented pagination and limits. | Possible managed provider later; no account or subscription created. |

The `nba_api` code license does not establish rights to the underlying NBA data or imagery. This local MVP does not assert a commercial redistribution license.

## What is loaded

The regular-season snapshot set after the October 26 refresh includes:

| Season | Recorded players | Completed regular-season games | Player appearances |
| --- | ---: | ---: | ---: |
| 2026–27 | 400 | 43 | 969 |
| 2025–26 | 582 | 1,230 | 26,651 |
| 2024–25 | 569 | 1,230 | 26,306 |
| 2023–24 | 572 | 1,230 | 26,401 |

Counts describe the initial import, not permanently current values. Consult `public/data/manifest.json` and the app's coverage line after refreshing. Only players with recorded appearances enter the statistical population; inactive roster members are not assigned zero-game performances. The current season is partial. Regular-season completeness means 1,230 reconciled completed games; it does not imply tracking, playoffs, or possession-level coverage.

## Refresh

Requires Python 3.11+ for the application environment and network access. From Bash or PowerShell:

```sh
python scripts/sync_data.py --refresh
```

The wrapper creates an isolated `.tools/data-env` environment and installs the pinned `nba_api` dependency. With Node available, `npm run data:sync` invokes the same fresh import. To choose seasons or providers explicitly:

```sh
python scripts/sync_data.py --refresh --seasons 2026-27 2025-26
python scripts/sync_data.py --provider nba-api --seasons 2024-25
python scripts/sync_data.py --provider archive --seasons 2024-25
```

Without `--refresh`, raw responses in `.data-cache/raw` are reused for reproducible offline transforms. These raw files are ignored by Git. Provider `auto` tries NBA Stats, then the archive on network or validation failure. Explicit `nba-api` never switches providers. Source identity is embedded in every successful snapshot and CSV.

Restart the API after a raw sync so it imports the changed manifest. The audited refresh command imports immediately; see [operations](operations.md). Newly added season choices require a frontend rebuild:

```sh
npm run build
```

Snapshots use content-addressed filenames. The manifest changes only after successful validation; failed seasons keep their previous snapshot and the command exits nonzero. Old content-addressed files remain available to already-open clients. A daily scheduler and durable refresh history are implemented; the explorer obtains the current imported manifest through the API.

## Contracts and checks

- Primary endpoints: [`PlayerGameLogs`](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playergamelogs.md), [`LeagueGameLog`](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguegamelog.md), [`CommonTeamRoster`](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/commonteamroster.md), [`ScheduleLeagueV2`](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/scheduleleaguev2.md).
- Player/game IDs remain official NBA IDs, including leading zeroes in game IDs.
- Duplicate player-game pairs, negative/nonfinite statistics, impossible shooting counts, missing games, and score disagreements fail ingestion.
- Player points must equal `2 × FGM + FG3M + FTM`; all player points on each team must equal its recorded final score.
- Neutral-site games sometimes label both participants `@`; official schedule assignments resolve home/away. No winner-based or row-order guesses.
- `MIN_SEC` supplies exact seconds when available. Counting rates use summed minutes; shooting percentages use summed makes/attempts.
- Team filters select appearances for that team within the window. Multi-team windows display `MULTI`. G/F/C filters include hybrid roster positions; missing positions remain unavailable.
- Season roster snapshots may omit players waived or traded before the roster was retrieved. Identity/game statistics still load; unavailable jersey, position, height, and age are null, not invented. Portraits are current CDN assets, not historical-season portraits.
- Browser snapshots are validated, fetched on demand one season at a time, and cached in memory. Failures show a retry state; they never fall back to synthetic values.
- Exports include provider URLs, retrieval time, observed date coverage, completeness, analysis filters, normalization, and player IDs.

## Advanced and playoff coverage

The shared catalog in `packages/analytics-contracts/metrics.json` contains 318 definitions, with explicit source, field, unit, direction and version metadata. Connected NBA families include Advanced/Scoring/Misc player tables, hustle, tracking groups, defending shots, clutch and strict shot locations. Separate views use NBA lineup, team on/off, team ratings/four-factor, career, season matchup and public play-type endpoints. Live checks covered 24 aggregate source families plus career and schedule endpoints from this machine; availability elsewhere can differ.

Advanced samples must match the selected player-game sample before normalization. Per-75/per-100 require actual matching NBA possessions. Clutch count normalization uses clutch games/minutes; clutch possession normalization remains unavailable. Per-player last-N aggregate feeds, individual with/without-teammate box scores and disconnected impact models are labeled unavailable. Season-only matchup/play-type feeds require an explicit full-season selection. See [NBA’s glossary](https://www.nba.com/stats/help/glossary) and the [nba_api endpoint documentation](https://github.com/swar/nba_api/tree/master/docs/nba_api/stats/endpoints) for provider definitions.

Playoff snapshots cover 2023-24 (82 games), 2024-25 (84 games) and 2025-26 (85 games). Official `004` playoff IDs are validated separately from `002` regular-season IDs. The 2026-27 playoffs have not occurred and are not populated with substitutes.

The app now uses a FastAPI relational service, persistent provider cache and scheduled refresh. Exact remaining architecture work and deployment verification are recorded in [implementation status](implementation-status.md).
