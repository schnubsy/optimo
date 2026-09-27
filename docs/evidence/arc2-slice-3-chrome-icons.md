# Arc 2 · slice 3 — chrome + icons

Implements design-system-prompt.md §4–5 (and spec §5.5–5.8, §6).

- **iPhone:** fixed header on the fade (title "Sunday 27 Sep ›" → month, stats line that fades after 40px of user
  scroll, 7-day strip with swipe = ±week, sync dot), solid under its text; the timeline is a full-height scroller
  that runs beneath the header and the **floating pill tab bar** (Inbox · Timeline · Week · Settings; reserved
  hidden Plan column behind `RESERVED_AI_TAB`; blur over 80% canvas, opaque under reduced transparency /
  increased contrast; recedes while a pill is dragged within 80px). **FAB** opens quick-add as a bottom sheet with
  focus in the field.
- **Desktop:** inbox rail + a 72px pane header: floating segmented Day · Week · Month (roving tabindex, ← →),
  ‹ title ›, now pill, stats, quick-add pill (min 320px, parse preview floats beneath), settings gear, sync.
- **Glyphs:** `src/icons/set.ts` — 64 activity + 12 chrome, filled, 24×24, drawn in-repo (the six Eye samples
  reused as the style reference); chrome also as a 1.75px outline for inactive tabs; `LEGACY` keeps pre-arc-2
  names resolving (no rows rewritten). README licence note. Sheet: `docs/evidence/icons.png`
  (`npx tsx scripts/icon-sheet.ts`, 13 / 18 / 22px white on the salmon chip).
- **Auto-suggest:** `src/quickadd/suggest.ts` — the §6.4 map as data (65 rules, word-boundary, first hit wins;
  two specific rows moved ahead of generic ones so "Book flights" → plane and "Guitar practice" → music, and
  "date night" stays family). Quick-add previews the glyph as its first chip (tap → picker), applies the suggested
  category when no #category is given; overrides persist in `planner_settings.data.iconOverrides[titleStem]` and
  win. Editor + categories use the grouped `GlyphPicker` (44px cells, search over names + keywords).

## Tests
- unit: `suggest.test.ts` (50: 46 title cases + boundaries + override + coverage), `icons.test.ts` (79: counts,
  every glyph renders on 0 0 24 24 with no external refs, outline variant, legacy map).
- `tests/chrome.spec.ts` — iPhone: bar + FAB fixed, no overlap, ≥44px targets, header borderless; 22:00 pill
  reachable above the bar; timeline full-height; FAB → focused quick-add → add closes; tabs + arrow keys;
  contrast-more → opaque, no blur; date strip + title → month; axe light/dark with the sheet open. Desktop:
  segmented switches views (← →), no bar/FAB; glyph preview + override remembered; suggested category; editor
  picker search.
- Gauntlet `arc2-s3-gauntlet-20260927-152312` GREEN (Lighthouse desktop 100/100, mobile 98/100 with the blurred bar).

## Evidence
`icons.png`, `arc2-slice-3-iphone-{day,quickadd}-{light,dark}.png`, `arc2-slice-3-icon-sheet-desktop.png`.
