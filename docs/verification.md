# Local verification record

Verified October 26, 2026 against the working tree, with Node.js 22.23.4, Python 3.14.2, SQLite and isolated Google Chrome.

| Check | Result |
| --- | --- |
| TypeScript | `npm run typecheck`: zero errors |
| Analytics unit tests | `npm test`: 9 passed |
| Python ingestion, contract and API integration tests | Isolated API Python, `unittest discover -s tests -p 'test_*.py'`: 27 passed |
| Python static checks | Ruff E4/E7/E9/F on the new API, catalog generator, launch/test wrappers and API tests: passed |
| Production build | `npm run build`: passed, standalone Next.js routes and API/snapshot rewrites |
| Browser regressions | `npm run test:e2e`: all 18 passed, including the original 10 tests and 8 research/finish regressions |
| Automated accessibility | Zero WCAG A/AA axe violations in tested desktop/mobile explorer, comparison, profiles and research flows; live source captures also reported zero |
| Production npm dependencies | `npm audit --omit=dev`: zero reported vulnerabilities at verification time |
| NBA integration | Real responses verified for 24 aggregate source families, career and schedule endpoints |
| Scheduled refresh | One real current-season run completed and was persisted in `refresh_runs`; refreshed coverage: 400 players, 43 finalized games, 969 appearances |
| Runtime health | `/api/health` reported `ok`, seven imported season/type datasets, SQLite and a completed latest refresh |

The browser checks cover full-population tables, trade/date scopes, summed percentages, normalization, filters, shared state, scoped playoff profiles, separate comparison seasons, complete CSV exports, calendar links/game boxes, playoff series, pooled history, persisted rankings, load failures, mobile layouts, keyboard interaction and PNG exports. The phone scatter regression checks both chart width and every point's bounds and validates the exported 1600 × 1448 PNG.

The initial independent Impeccable review returned `fix` for phone chart overflow, contradictory methodology copy and the matrix size control. One correction batch addressed all three. Its verdict pass scored all three resolved and returned `ship` for that fix list. The documenter checked the final evidence and preserved the incumbent design tokens; see [design extension review](design-extension-review.md).

No tests were skipped or replaced with lower assertions. Current NBA advanced coverage remains source-dependent; unavailable feeds and unsupported samples are not zero-filled. The successful source smoke checks describe this machine and time, not an upstream service-level guarantee.

## Not verified here

Docker/PostgreSQL runtime and the remote GitHub Actions run were not executed: Docker and PostgreSQL are not installed in this environment. The workflow defines PostgreSQL-backed migration/integration checks, but its presence is not evidence they passed. Public hosting, TLS, external alerts, backup restoration and redistribution rights are also not established by local tests.

The complete architecture includes additional modules that are explicitly tracked in [implementation status](implementation-status.md). This local verification record does not claim those unimplemented modules are complete.
