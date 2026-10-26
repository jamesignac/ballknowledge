---
name: Ballknowledge
description: A warm, portrait-led basketball analysis workspace.
colors:
  paper: "#f6f6f2"
  surface: "#fff"
  rail: "#eeefe8"
  ink: "#24362e"
  text: "#29372f"
  muted: "#626c60"
  line: "#e5e8df"
  orange: "#c44826"
  orange-light: "#f9eee7"
  green: "#476b4c"
  orange-hover: "#a83c20"
  comparison-highlight: "#a93e20"
  primary-text: "#fff9f4"
  spotlight: "#253c32"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "53px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-1px"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-1.1px"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.35px"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "10px"
    fontWeight: 700
rounded:
  compact: "4px"
  control: "5px"
  button: "6px"
  navigation: "7px"
  field: "8px"
  dock: "10px"
  panel: "12px"
  drawer: "16px"
spacing:
  tight: "4px"
  compact: "8px"
  control: "12px"
  group: "16px"
  panel: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.button}"
    padding: "9px 12px"
  button-primary-hover:
    backgroundColor: "{colors.orange-hover}"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "9px 12px"
  button-secondary:
    backgroundColor: "{colors.orange-light}"
    textColor: "{colors.orange}"
    rounded: "{rounded.button}"
    padding: "9px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  spotlight:
    backgroundColor: "{colors.spotlight}"
    rounded: "{rounded.panel}"
    padding: "20px 22px 18px"
  comparison-toggle:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    width: "24px"
    height: "24px"
---

# Design System: Ballknowledge

## Overview

**Creative North Star: "Scouting desk"**

Warm paper, pale olive navigation, forest ink, and court-orange actions give a dense analysis workspace a familiar basketball character. Player photographs and oversize jersey numerals provide recognition; aligned tables and compact conventional controls support sustained exploration.

This records the implemented local MVP. The visual direction was selected during code-led implementation; no visual comp or aesthetic workshop was approved by the user.

**Key Characteristics:**
- Warm, flat analytical surfaces.
- Portrait-led player identity.
- Compact controls and aligned numeric columns.
- One visible scope across linked representations.

## Colors

The palette uses warm neutrals for sustained reading, forest tones for structure, and orange for actions and selection.

### Primary
- **Court Orange:** Primary actions, active tabs, comparison selection, focus, and highlighted comparison values.
- **Pale Court Orange:** Secondary actions and selected-state support. Comparison values use a darker orange highlight for readable small-screen numbers.

### Secondary
- **Forest Ink:** Brand, strong text, tooltip backgrounds, and dark player surfaces.
- **Court Green:** Supporting analytical emphasis; team colors remain data-specific rather than interface accents.

### Neutral
- **Warm Paper:** Workspace background.
- **White Surface:** Panels, fields, and data tables.
- **Pale Olive Rail:** Persistent navigation background.
- **Reading Ink / Muted Olive:** Main text and supporting explanations.
- **Olive Rule:** Quiet dividers and panel boundaries.

**The Scope Rule.** Preserve the same selection language across tables, plots, profiles, and comparisons: orange marks interaction and comparison state; team colors identify teams.

## Typography

**Display Font:** Self-hosted Barlow Condensed, sans-serif fallback (600).
**Body Font:** Self-hosted variable Manrope, sans-serif fallback (200–800).

The body family keeps controls, names, explanations, and numbers cohesive. Condensed display type gives player names, jersey numerals, and team monograms a sports-reference character. Tables use tabular numerals.

### Hierarchy
- **Display:** Spotlight surnames use the frontmatter display role; responsive overrides range from 43px to 65px, with a separate 48px treatment at the narrowest width. Profile names use 46px, then 37px and 33px.
- **Headline:** Page titles use the headline role, reducing to 29px and 27px on narrower screens.
- **Title:** Panel headings use the title role; narrower intermediate layouts use 14px, while stacked phone panels restore 16px.
- **Body:** The body role becomes 14px at wide desktop. Dense descriptions and table content use 9–12px according to context.
- **Label:** Buttons use the label role; navigation normally uses 11px at 650 weight. Compact chart ticks and axis titles use 14px in the phone SVG coordinate space.

**The Numeric Alignment Rule.** Keep statistics aligned and use tabular numerals in tables and spotlight stat groups.

## Layout

Desktop uses a fixed left rail (226px) and a matching workspace offset. Main content has 38px side padding and a 1750px maximum width. The discovery grid pairs a portrait spotlight with a wider scatter panel, using `minmax(245px, 0.88fr) minmax(0, 1.65fr)` and a 20px gap. Reused spacing values are recorded in frontmatter; they describe observed steps rather than an enforced global grid.

- At 1600px and above, the rail grows to 244px and main side padding to 48px.
- At 1200px and below, the rail is 200px; at 1000px and below, 180px. Main side padding reduces to 24px and then 20px.
- At 767px and below, navigation becomes a 226px drawer with a scrim; workspace offset disappears, the top bar is 58px high, main side padding is 18px, and search stacks above scope selects.
- At 590px and below, discovery panels stack. The scatter switches from a 790×350 coordinate space to a dedicated 410×300 layout, three tick intervals, and no persistent point-name labels. Its wrapper has a 245px minimum height.
- Phone comparison fits two players across the available width. Three-player and four-player tables use minimum widths of 480px and 610px, with a sticky 86px metric column and horizontal scrolling inside the table. A guide lists every selected name and offers scrolling for larger selections.
- Phone profile scoring trends show six recent games in a 350×160 coordinate space; desktop shows up to twelve in 560×160. Game logs remain separately scrollable tables.
- At 350px and below, main and top-bar side padding reduce to 12px.

Keep horizontal overflow inside table containers. The player table preserves its sticky name column, and the fixed comparison dock stays inside the viewport.

## Elevation & Depth

Panels are flat at rest: white surfaces, tonal changes, and thin olive borders carry the hierarchy. Floating utilities use restrained shadows; the native dialog uses the strongest shadow and a blurred, darkened backdrop. Exact shadow and motion values live in the sidecar.

**The Surface Rule.** Use borders and tone for ordinary panels; reserve elevation for overlays, tooltips, the comparison dock, and feedback.

## Shapes

Panels use the panel radius; fields, buttons, navigation rows, and dock use progressively smaller corners from the frontmatter. Portrait avatars are circular in tables and unclipped rectangular cutouts in spotlight and profile presentations. The profile drawer rounds its exposed left corners, reducing from 16px to 12px on mobile. Thin borders and aligned horizontal rules organize dense data.

## Components

### Buttons

Compact, explicit actions. Primary orange, white default, and pale-orange secondary variants share a 36px minimum height at desktop. Hover changes fill and border; visible keyboard focus uses a 2px orange outline with 4px offset. Disabled buttons use 0.4 opacity and a disabled cursor. Text actions use orange and underline on hover.

### Inputs / Fields

Search is a borderless field inside a white, olive-bordered toolbar. A focus-within state turns its icon orange. Scope selects retain native behavior inside compact rounded borders. Expanded filters use a pale olive surface and white fields.

### Navigation

Persistent pale olive rail, stroke SVG icons, and compact text. Active rows use pale orange with darker orange text; hover uses an olive wash. Mobile retains the same content in a sliding drawer with a dismissible scrim.

### Chips

Selected-player dock chips combine a small portrait, name where space permits, and removal control on a pale olive fill. Compact badges convey counts; use text and accessible labels alongside color.

### Cards / Containers

White panels use a thin olive border and the panel radius. Headings, chart controls, tables, and footnotes share aligned internal edges. Empty states explain the missing result and offer a relevant action.

### Player Spotlight

Deep forest surface, condensed surname, a quiet oversize jersey numeral behind a recognizable headshot, three compact stats, and profile/comparison actions. Keep the identity legible above the image; image cropping must not cover the stat row or controls.

### Linked Scatter and Comparison

Team-colored points use orange outlines when selected; dashed lines show the scoped sample average. Points support keyboard focus and profile opening. Comparison highlights the highest displayed value with the darker comparison-highlight token on a pale orange cell; the accompanying note explains that this is descriptive rather than an overall ranking.

### Profile Dialog

A native modal drawer opens from the right, with close control, player identity, comparison action, provenance, stats, trend, and game log. Native modal behavior contains focus and supports Escape. Reduced-motion preferences disable transitions and animations; the normal drawer entrance lasts 0.4s.

## Do's and Don'ts

### Do:
- **Do** preserve clear player identity through headshots, names, and jersey context.
- **Do** keep source provenance, observed coverage, freshness, and sample size visible near statistics.
- **Do** preserve linked selection states and numeric alignment across representations.
- **Do** keep phone charts readable and confine horizontal scrolling to data tables.
- **Do** retain visible keyboard focus, native dialog behavior, and reduced-motion support.

### Don't:
- **Don't** apply overlay shadows to ordinary data panels.
- **Don't** use team colors as replacements for the orange interaction state.
- **Don't** shrink the desktop scatter wholesale to produce the phone chart.

Not canonized: the build includes tiny ancillary labels and uppercase navigation/game-status labels; these are observed density choices, not a reusable prescription for new surfaces. The condensed comparison heading and league mark extend beyond the direction's player-name/team-monogram restriction; that drift is recorded rather than generalized or repaired here.
