# NBA MVP data integration

This records the completed initial data migration. The subsequent public-data service and analytics expansion is tracked in [the production implementation plan](../tasks/plan.md) and [implementation status](implementation-status.md).

Replace the 39-player demonstration with all recorded NBA regular-season appearances in supported seasons. Start with 2023–24 through 2026–27, showing observed coverage rather than claiming future or unobserved games.

1. Use `nba_api` bulk player and team game logs; enrich identities with season rosters. Pace requests and cache raw results.
2. Normalize official NBA IDs, actual game-team membership, dates, shooting components, and minutes. Reconcile each game against team scores and reject duplicate or invalid records.
3. Publish validated season snapshots and a manifest atomically. Keep the last successful snapshots when retrieval fails. Support an explicit SportsDataverse NBA Stats archive fallback; never synthesize missing results.
4. Load one season at a time. Preserve consistent scope across table, scatter, profiles, comparisons, and exports; filter by the team on each game record to handle trades.
5. Add pagination for the full database, visible sample/freshness information, loading/error/retry states, and factual source descriptions. Retain existing design.
6. Test ingestion contracts, real-season coverage, trade splits, weighted percentages, load failures, and the browser workflows. Document refresh commands and alternative sources.

The original migration covered regular-season box scores and derived descriptive rates. The newer service adds public advanced feeds and playoff imports with explicit source/sample checks; it does not establish a commercial data license or a causal possession/stint model.
