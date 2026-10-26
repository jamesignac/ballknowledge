# Implemented scope and remaining architecture work

The existing ARCHITECTURE.md remains the product specification. The public-data implementation now extends the original MVP with the following working modules.

| Capability | Implemented behavior |
| --- | --- |
| Data foundation | Validated nba_api imports, explicit archive fallback for regular seasons, content-addressed snapshots, SQL facts, Alembic migrations and persistent provider cache |
| Coverage | Four regular seasons, 2023-24 through 2026-27; three completed playoff seasons, 2023-24 through 2025-26. Counts and retrieval times are displayed from imported data |
| Stats database | 318 catalog entries, including seven explicitly unavailable external models; presets, custom columns, thresholds, percentile shading, sorting, pagination, per-game/per-36/per-75/per-100/totals and complete matching CSV exports |
| Scope and provenance | Dates, season type, team, position, eligibility and splits; guarded advanced-source samples; saved/shared table configuration and scoped player-profile links |
| Season hub | Month/day/custom-window selection, scheduled/live/final schedule states when supplied by NBA, manual schedule refresh, window standings, linked statistics and imported final-game box scores |
| Player analysis | Portraits, game logs, scoring trends, last-5/10/20, home/away and win/loss splits; career totals; original four-player comparison and advanced five-player comparison with separate seasons |
| Team analysis | Source-backed ratings and four factors, roster exploration and two-to-five team-season comparisons |
| Scoring | Strict NBA zone tables and a frequency/accuracy court schematic; public play-type volume, frequency, PPP and efficiency with explicit full-season scope |
| Impact and fit | NBA team on/off samples and differences; two-to-five-player lineups, qualification, two-player matrix and teammate pair observations; season-only matchup exploration |
| History and playoffs | Player-season rows, mathematically pooled box-score components, playoff round/series summaries and games |
| Personal workspace | Saved browser views, accessible tier assignment/dragging, persisted player rankings and ranking CSV exports |
| Operations | Combined dev/start commands, PostgreSQL/container configuration, audited daily refresh, health/timing/source logs, bounded public requests and CI checks |

Source-backed features report unavailable when NBA does not return a compatible sample. A catalog entry is not a claim that every metric exists for every player, season or window.

## Deliberate data boundaries

- DPM, ODPM, DDPM, EPM, LEBRON, BPM and VORP have no connected, independently validated model feed or implementation. NBA ratings and PIE are labeled separately.
- Individual player with/without-teammate box scores need validated substitution stints. The teammate view currently shows actual NBA two-player shared-floor ratings and labels the unavailable individual splits.
- Aggregate feeds cannot verify a per-player last-N appearance sample. Basic last-N splits work from game facts; incompatible aggregate advanced values remain unavailable. Date-window feeds remain available where supported.
- Per-75/per-100 require matching NBA on-court possession samples. Historical pooling and clutch counts do not substitute full-sample possessions for an unavailable denominator. Clutch per-game/per-36 counts use clutch games/minutes.
- NBA matchup and play-type endpoints used here are season-only. Users explicitly choose full season; custom-window values are not fabricated.
- The court uses strict NBA zones. Hybrid rim/short-midrange definitions and individual shot coordinates are separate future event-data work.
- This is four-season historical coverage, not an all-time database. Missing older years must be backfilled and validated.

## Broader architecture still to extend

The architecture also describes richer rolling-average controls, opponent-strength adjustments, custom stint-based lineup building, exact individual teammate splits, franchise-history pages, all-time scatter and player-card image exports, additional contextual filters such as draft class, team shot/play-type dashboards, and optional WNBA/AI/film/fan modules. Those are not represented as completed capabilities here.

Docker/PostgreSQL deployment validation, public hosting/TLS, external monitoring and data redistribution authorization remain launch-environment work. See [operations](operations.md) for reproducible commands and the required verification boundary.
