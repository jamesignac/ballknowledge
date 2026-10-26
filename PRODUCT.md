# Ballknowledge

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js, React, TypeScript and FastAPI/Pydantic. A Python nba_api pipeline imports validated regular-season and playoff facts into SQLAlchemy storage, with local SQLite and a PostgreSQL deployment configuration. Scoped NBA feeds supply compatible advanced observations.

## Users
Basketball fans, analysts, and researchers exploring NBA player performance and comparing players in a consistent statistical context.

## Product Purpose
Move from a question about a player to a filtered population, a visual comparison, and reproducible supporting numbers.

## Positioning
One shared analysis scope links player tables, scatter plots, comparisons, profiles, and CSV exports.

## Operating Context
A desktop analysis workspace that also supports browsing and comparing players on mobile.

## Capabilities and Constraints
Prioritize player exploration and comparisons, as confirmed by the user. Include configurable basic/advanced stats, percentile cohorts, scoped scatter and profiles, player/team season comparisons, linked calendar and game boxes, public shot-zone/play-type views, lineups, on/off, matchups, historical pooling and browser-local rankings/views. Regular-season facts cover 2023-24 through 2026-27; completed playoff imports cover 2023-24 through 2025-26. The user explicitly chose public NBA data first and labeled unavailable metrics. Never substitute unsupported models, incompatible aggregate samples, or invented possession/stint data. Coverage and retrieval times stay visible. Deployment configuration is implemented; runtime production validation and optional accounts remain separate launch work.

## Brand Commitments
Name: ballknowledge. Clear, basketball-literate copy with explanations for advanced metrics.

## Evidence on Hand
ARCHITECTURE.md defines the product and MVP. No application code, API keys, licensed dataset, visual assets, or incumbent design were supplied. The original synthetic dataset has been replaced by validated NBA Stats imports. Source research and refresh instructions are in docs/data-sources.md.

## Product Principles
- Consistent filters across every representation.
- Recompute percentages from makes and attempts.
- Make sample size and data provenance visible.
- Keep exploration useful without an account.
