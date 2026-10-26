# Production capability map

This map implements the user's request to extend ARCHITECTURE.md using the publicly observable Hoopology regular-season and Databallr statistics workflows. Public NBA data first; unavailable/proprietary metrics remain explicitly unavailable, as confirmed by the user.

| Module | Responsibility | Depends on |
| --- | --- | --- |
| metric-catalog | Versioned definitions, units, denominators, direction, provider mapping, and coverage | — |
| data-platform | Relational facts, validated imports, provider cache, scheduled refresh, provenance | metric-catalog |
| analytics-api | Shared scope, population, normalization, percentiles, availability, CSV, and health | data-platform |
| stats-workbench | Column presets/customization, thresholds, heatmaps, scatter, leaders, comparison | analytics-api |
| season-hub | Month calendar, day/month/range selection, standings, schedule states, box-score drilldown | analytics-api, stats-workbench |
| entity-dashboards | Player/team dashboards, splits, trends, scoring profiles, career and comparisons | analytics-api |
| impact-fit | Provider-backed on/off, teammate splits, lineups, pair matrix, matchups | analytics-api |
| postseason-history | Playoff series/bracket exploration and historical season comparisons | analytics-api, entity-dashboards |
| release-operations | Repeatable launch, database migration, CI, health, logs, refresh, backup/rollback guide | all public production modules |

Build order: catalog → data platform/API → stats workbench/season hub → dashboards/impact/history → release verification.

WNBA, AI assistance, film licensing, and fan mini-games remain the architecture's explicitly optional later modules. No commercial data subscription, cloud deployment, account provider, or payment is authorized or required by this implementation.
