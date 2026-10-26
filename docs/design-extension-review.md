# Research workspace design extension review

Reviewed October 26, 2026 as an ordinary Operate extension of the incumbent **Scouting desk** system. This records the implemented research workspace; it establishes no replacement visual world or new global design rules.

`DESIGN.md` and `.impeccable/design.json` were checked and preserved. `PRODUCT.md`, `.impeccable/surface-brief.md`, and `CONSTRAINTS.md` were checked and preserved. No interface code, design tokens, source data, or bitmap assets were changed by this documentation pass.

## Evidence checked

- System and product: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surface-brief.md`, `CONSTRAINTS.md`, and `docs/implementation-status.md`.
- Implemented styling: `app/globals.css` and `app/research.css`, including palette variables, self-hosted fonts, focus treatment, panel shape, controls, table alignment, internal scrolling, and phone overrides.
- Component samples: `components/research-workspace.tsx`, `components/research-scatter.tsx`, `components/research-comparison.tsx`, `components/stats-workbench.tsx`, `components/source-explorer.tsx`, `components/player-research.tsx`, `components/research-player-profile.tsx`, `components/use-small-screen.ts`, and the methodology dialog in `components/workspace.tsx`.
- Rendered captures opened: `.impeccable/review/research-1440.png`, `research-390.png`, `zones-desktop.png`, and `onoff-desktop.png`. They show the research workspace at desktop and phone sizes, the public zone schematic, and source-backed on/off observations.
- Final correction captures opened: `.impeccable/review/scatter-mobile.png`, `matrix-desktop.png`, `methodology-top.png`, and `methodology-research.png`. The phone scatter shows readable abbreviated axes, separate provenance lines, and a chart contained within the panel. The checked matrix displays a disabled two-player size control. The dialog captures show the corrected scope and compatible-feed explanations; `methodology-top.png` is a top-section capture and `methodology-research.png` includes the lower research-feed copy.

After opening the final correction evidence, SHA-256 checks confirmed that `DESIGN.md` and `.impeccable/design.json` remained unchanged during this pass.

This is a design-system comparison, not a substitute for the independent finish review, runtime tests, or deployment validation.

## Incumbent system comparison

| Area | Implemented extension |
| --- | --- |
| Palette | Reuses warm paper, white panels, pale olive rail, forest ink, olive dividers, and court-orange actions. No replacement palette was introduced. |
| Typography | Inherits Manrope for controls, headings, descriptions, and tabular statistics. The existing shell retains Barlow Condensed for its established display uses. Scatter SVG text has a local exception noted below. |
| Surfaces and controls | Research panels extend the existing flat, bordered panel component. Native fields, compact buttons, explicit labels, disclosure controls, and visible focus remain the working vocabulary. |
| Numeric layout | Statistics use tabular numerals, aligned columns, and sticky table headings/identity cells. Table overflow stays inside dedicated containers; phone controls wrap and research tabs scroll horizontally. |
| Phone scatter | Uses a dedicated compact coordinate space through the existing small-screen hook. Its chart is fluid within the panel; axis abbreviations, compact ticks, and separate provenance lines are surface-specific implementation details. |
| Source communication | Definitions, cohort size, retrieval times, missing-value reasons, and empty states extend the established provenance pattern. No unavailable metric is promoted to a visual estimate. |

## Truthful data presentation

The implemented methodology identifies the percentile cohort, box-score retrieval time, provider-specific retrieval or availability reasons, and metric definitions. It states that CSV export includes the full filtered population and unavailable cells are never zero-filled. The scatter excludes missing paired observations and discloses a first-500 limit when applicable.

The shared methodology dialog distinguishes the original regular-season explorer from research playoff support, explains the separate full-season scope of research comparison columns, and requires matching possession samples for research per-75/per-100 counts. Compatible tracking, hustle, lineup, and on/off feeds retain their own retrieval times; unsupported samples and disconnected impact models are explicitly unavailable.

Source views distinguish NBA source totals from percentages and ratings in their source units. The zone schematic identifies strict NBA zones and aggregate attempts rather than individual shot coordinates. Matrix mode requests two-player groups and shows the lineup-size field as two players while disabling changes in that mode. These behaviors support the user's public-NBA-data-first boundary; this document does not independently validate their numerical results.

## Drift recorded without changing the system

The incumbent `DESIGN.md` already records tiny ancillary labels, uppercase navigation/game-status labels, and condensed type outside the direction contract's player-name/team-monogram restriction. Those observations remain uncanonized and were not repaired during this extension review.

The research extension also uses forest-filled active tabs and pressed compare toggles where the recorded Scope Rule describes orange selection, and its scatter SVG explicitly uses Arial rather than the recorded Manrope body family. These local differences were not converted into global tokens, blanket permissions, or new component rules. The parent implementation can assess them separately; this documentation boundary authorizes no interface repair or identity change.
