# Production implementation plan

## Scope and decisions

ARCHITECTURE.md is the existing product specification. The user explicitly requested its implementation and confirmed public NBA data first, with unavailable metrics labeled. CAPABILITIES.md records the module boundaries. Existing Ballknowledge branding and design remain authoritative; referenced products inform functionality, not branding or proprietary implementation.

The current static MVP already has validated NBA snapshots, scoped basic analytics, player comparison, game logs, CSV, and browser-local saved views. Production work adds a typed FastAPI service and a relational query/cache layer. SQLite supports zero-configuration local development; the same SQLAlchemy schema and migrations support PostgreSQL for deployment. Redis and a warehouse remain optional under the architecture's scope rule.

Advanced observations use NBA endpoints with the same season, dates, team and split where supported. Counts and denominators are aggregated before ratios; provider rates are never averaged as if they were additive facts. Incompatible samples and season-only metrics in custom windows return explicit missingness. No possession, impact-model, tracking, or historical coverage is invented.

## Ordered delivery

1. Verify references and endpoint coverage; write a machine-readable metric catalog and availability contract.
2. Add the relational store, migrations, import command, API models, query engine, bounded provider cache, and health checks.
3. Connect the statistics workbench to the API: presets, custom columns, thresholds, percentiles, per-75/per-100, URL state, exports.
4. Deliver the linked season calendar, live/scheduled/final schedule states, day/month/custom windows, leaders, standings and game drilldown.
5. Deliver player/team dashboards, splits/trends, zone/scoring profiles, and up-to-five entity comparisons.
6. Deliver sourced on/off, teammate tables, lineup leaderboard/matrix and matchups; source gaps remain visible.
7. Add playoffs/history/rankings and reproducible local presets where data supports them.
8. Complete production launch scripts, containers/PostgreSQL configuration, scheduled ingestion, telemetry, CI and operational documentation.
9. Run unit, ingestion, API/integration, production build, browser and accessibility verification; perform independent finish review.

## Acceptance

- Every visible control performs the labeled action, and cross-view changes retain one scope.
- Every metric has a source/formula, normalization semantics and missingness policy.
- Basic figures reconcile with source games; trade, date, zero-attempt and missing-sample cases are tested.
- No synthetic data or fabricated proprietary metrics enter production responses.
- Public endpoints validate and bound inputs; provider requests are paced, cached, time-limited and coalesced.
- Failed refreshes preserve the last validated data; the UI distinguishes missing, stale, live and finalized data.
- Launch and checks are repeatable from the repository; secrets stay in environment variables.

## Risks

NBA endpoints may be blocked, return inconsistent cohorts, or lack an older season. Cache successful scopes and expose unavailable sources. Public availability does not establish commercial redistribution rights; the source guide records this boundary. Exact proprietary models cannot be recreated from labels or undocumented coefficients. Production deployment additionally needs the user's hosting environment and authorized data rights; local/container readiness is verifiable here.
