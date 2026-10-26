# Production constraints

Established October 25, 2026 from the existing verification baseline, ARCHITECTURE.md and the user's public-data requirement.

| Dimension | Rule and reason | Verification |
| --- | --- | --- |
| Types | Zero TypeScript errors; preserve typed boundaries | `npm run typecheck` and production build |
| Data correctness | No duplicate appearances, impossible counts, or unreconciled scores | `npm run test:data` and import validation |
| Analytics | Ratios from totals; scoped cohorts; no invented unavailable values | `npm test` and API tests |
| Accessibility | Preserve zero WCAG A/AA axe violations in tested shipped flows | `npm run test:e2e` |
| Existing behavior | Keep existing tests meaningful; update assertions only for documented product changes | test suites and diff review |
| Source integrity | Every advanced value identifies its provider/scope; unavailable sources produce null plus a reason | metric registry and API tests |

Floor: no new suppression comments, skipped tests, fake implementations, hard-coded secrets, or weakened checks to make a change pass. Do not average percentages over games or silently substitute full-season advanced values into date-window analyses. No production readiness claim without passing the applicable checks and disclosing unverified deployment conditions.

The existing project has no measured code-coverage or performance budget. Do not invent a passing measurement or weaken a future threshold. Record measurements before adopting numeric budgets.
