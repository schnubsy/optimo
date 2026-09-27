# arc1 · slice 4 — inbox, quick-add NLP, categories / icons / priority (2026-09-26)

## Gauntlet (`scripts/gauntlet.sh arc1-s4`, 20260926-195738) — GREEN
- 🟢 unit (vitest) — 57 tests (parse.test: **28 cases** incl. "Lunch with Sam at 1pm" → today 13:00 and
  "Gym every weekday for 1h #health !!" → Gym · weekday RRULE · 60 min · health · P2)
- 🟢 build (vite)
- 🟢 playwright smoke + axe (desktop, iPhone 15) — 34 passed, 14 skipped (desktop-only / evidence-only / @real)
- 🟢 lighthouse desktop perf=100 a11y=100 · mobile perf=98 a11y=100

## inbox.spec.ts — desktop + iPhone 15
- quick-add shows the parse row (title · when · category · priority) before commit; Enter captures to the inbox (0:20, P2)
- "Coffee with Sam at 1pm" → preview 13:00–13:30 → block at 780 min
- Tab (desktop) opens the parsed fields in the editor (title / 09:00 / 15 min)
- **Place**: picker lists real free rows that fit, earliest first; choosing it schedules exactly at the shown time (both devices)
- desktop: drag inbox row → timeline 17:00 (drop ghost visible while held) → scheduled; drag block → inbox rail → unscheduled
- mobile path: unschedule via the editor's "On the timeline" toggle
- desktop: drag a row onto another → fractional sort_key reorder
- categories page (8 seeded, fixed ids, field_ts=1 so real edits always win) and icon sheet: axe clean; **57 original glyphs** (≥ 40)

## Screenshots
`arc1-slice-4-inbox-{desktop,iphone-15}.png` (command line mid-parse), `arc1-slice-4-place-iphone-15.png` (Place sheet),
`arc1-slice-4-icon-sheet.png` (full in-repo glyph set).
