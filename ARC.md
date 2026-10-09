## 2026-10-09 — Arc 6: UI/UX round — spine timeline, panel sheet, 4-tab bar, task wizard

Source of truth: `docs/design/2026-10-09-mockups/` (10 mockups + `mockups.md`, the measured spec sheet). Mark's decisions
(2026-10-09): **1 A** mockups followed exactly for layout / flow / sizes / colours, glyph artwork drawn in-repo (never traced),
creative copy ours · **2** ring at the right completes, chip opens the editor · **3** wizard replaces the command-line sheet,
title field keeps the parser · **4** day bookends as anchor rows, names in Settings (defaults "Up" / "Lights out") ·
**5** desktop adopts spine, header, editor, tokens; keeps two panes + Day/Week/Month · **6** now marker kept ·
**7** header stats line dropped · **8** AI subtasks + Set Timezone built now · **9** light mode mirrors dark ·
**10** this arc runs before arc 5b.

Plan-mode answers (Mark, 2026-10-09): bookends show the ring — a per-day tick stored in settings `bookend_done`, never a task row (images 01/09 win over the sheet) · category hues unchanged, glyph/ring move to L 0.66 / C 0.10 (blue delta → P1) · slices 2/5/6 run as parallel worktree agents with per-slice CSS files.

RULE: originality (rewrites the CLAUDE.md rule + lessons 2026-09-26 / 2026-09-27 in slice 1): structure, flow, sizes and
colours may follow the 2026-10-09 mockups exactly; glyph artwork is always drawn in-repo on the 24 px grid (never traced
from any icon set), copy strings are ours (free-time phrases, bookend names, suggestion seeds), the name stays optimo.
RULE: one segment map (`src/timeline/segments.ts`, pure, unit-tested) is the only minute↔pixel conversion on the spine —
drag, drop ghost, paint ghost, now marker, rail ticks and virtualisation all read it; no second px-per-minute path.
RULE: the page-diff gate is declared "layout change" for every view this arc; the Eye LITE slice compares against the
mockups side by side instead.
RULE: `db/007_task_tz.sql` is additive (nullable column) — applied inside the order via the Supabase connector; no
destructive SQL anywhere in this arc.

=== SLICE 1 — Tokens, glyphs, originality rule ===
Status: done 3ffe2d3
Scope: palette + type + geometry tokens per `mockups.md` → Palette; new glyphs; the rule rewrite.
Files: src/styles/tokens.css, tokens-a11y.css, src/icons/set.ts (+ filled variants), src/icons/README.md, CLAUDE.md (Project rules), docs/lessons.md, docs/spec.md §6.
Implementation: dark `--canvas` → pure black, `--panel #1C1C1E`, new `--card`, `--node`, `--spine`, `--accent oklch(0.75 0.095 26)`, `--accent-tint`, category glyph/ring lightness 0.66 / C 0.10, editor-header formula (cat hue at L 0.58 C 0.08), week past-chip formula (L 0.78 C 0.08); light mode mirrored (canvas warm white, panel `--n-0`, card `--n-100`, node `--n-200`, accent as today). Type: 30/800 title, 22/700 row title, 20/600 list title, 18/600 numeral, 17 body, 15/600 meta, 13/600 weekday, 11/600 tab. Geometry tokens: `--node-size 56`, `--node-size-week 48`, `--spine-x 78`, `--gutter-right 41`, `--text-col 119`, `--ring 22`, `--min-px 2`, `--week-hour-px 36`, `--gap-cap 120`, `--tabbar-h 60`, `--fab-size 58`. Draw: ui-inbox (tray), ui-timeline (spine-list), ui-ai (four-point sparkle), ui-settings restyled, ui-grid-2x3, ui-more, ui-repeat, ui-timer, ui-bell-off, ui-palette, ui-globe, ui-clock, ui-plus-circle; 64 + filled set stays consistent in weight. Rewrite the originality rule (CLAUDE.md Project rules, lessons RULE lines, spec §6) to the RULE above.
Done: tokens compile in both themes; every new glyph renders in `IconSheet` at 24 and 13 px; `tests/design.spec.ts` asserts the dark canvas is `rgb(0,0,0)`, the panel `#1C1C1E`, and accent ≈ `#EC9792` (±4 per channel); axe clean on day + inbox in both themes; evidence `docs/evidence/arc6-slice-1-tokens.png` (dark + light swatches).

=== SLICE 2 — Header + date strip ===
Status: done 2ae5a87
Scope: mobile + desktop headers per `mockups.md` → 01 Header/Strip; stats line removed (decision 7).
Files: src/chrome/Header.tsx, src/styles/app.css, src/views/stats.ts (keep for Week + tests), tests/chrome.spec.ts.
Implementation: title `October 9, 2026 ›` (month+day ink, year + chevron accent; week-overview mode shows `October 2026 ›`); 32 px accent disc on the selected day; mini-chip row (12 px discs, −3 px overlap, max 4 + `+n`) from that day's items (use `useItems(days)` over the 7 strip days); `Today` button stays when off today, right-aligned; SyncBadge moves into the header's right edge at 12 px. Desktop `PaneHeader`: same title grammar, segmented control stays, stats line removed, `in inbox` count moves to the Inbox rail header.
Done: Playwright asserts the title text + the accent year, the disc on the selected day, 3 mini-chips on a seeded Friday, no `.hdr-stats` in the DOM; header height 131 px at 402 px wide; evidence `arc6-slice-2-header.png`.

=== SLICE 3 — Spine timeline ===
Status: done ddaa8b4
Scope: the day timeline becomes a spine per `mockups.md` → 01 / 08 / 09; desktop uses the same component in the main pane.
Files: NEW src/timeline/segments.ts (+ segments.test.ts), src/timeline/Timeline.tsx, Block.tsx → NodeRow.tsx, FreeGap.tsx → Gap.tsx, HourRail.tsx → Rail.tsx, NowLine.tsx, PaintLayer.tsx, usePaint.ts, paint.ts, layout.ts, virtual.ts, EventBlock.tsx, AllDayStrip.tsx, src/Planner.tsx (drop maths), src/data/types.ts + repo (settings `day_start_name`, `day_end_name`), src/views/Settings.tsx (Day section: names), src/styles/app.css, tests/timeline.spec.ts, paint*.spec.ts, perf.spec.ts.
Implementation: `buildSegments(items, events, dayStart, dayEnd, {minPx: 2, gapCap: 120})` → ordered segments `{kind: 'anchor'|'node'|'gap', from, to, y, h, compressed}` with `minToY(min)` / `yToMin(y)` piecewise-linear (compressed gaps map linearly inside their 120 px); gaps measured task-end → next start; proportional ≤ 60 min, compressed beyond; anchors from settings at the top/bottom. Rows: 56 px disc for < 30 min, capsule (56 × duration×2) for ≥ 30 min; meta `start[–end] (dur)` + ↻ when recurring; title 22/700; ring 22 px completes (`toggleComplete`), chip + title open the editor (single tap; selection state kept for keyboard users via focus). Rail: labels at node starts, every 30 min inside proportional segments when ≥ 40 px apart, two hour ticks in compressed gaps; dashed spine through compressed gaps. Gap content + copy + `Add Task` rule per the sheet (≥ 90 min → pill; pill/sentence → `draft` at gap start, len `min(default, gap)`). Now marker + running ring on today. Overlaps: concurrent tasks render as side-by-side nodes (second column at `--spine-x + 64`), events (iCloud) as outlined discs with the calendar ring. Drag: `Planner.dropMinute` and `usePaint` call `yToMin` from the day's segment map (`timelineEls` keeps a ref to it); the drop/paint ghost is positioned with `minToY`; `snap` unchanged. Virtualisation windows by segment `y`. Done pills (09) as specified. Keyboard map unchanged (↑↓ move by snap, X done, Enter edit).
Done: `segments.test.ts` covers empty day, 1-min bookends, 13.5 h gap compresses to 120 px with ticks at 1:00 / 5:00, 90-min capsule = 180 px, round-trip `yToMin(minToY(m)) == m` on 500 random minutes; Playwright: seeded 01 and 08 states match the mockup geometry (chip centre x 78 ± 2, ring centre x 362 ± 2, capsule 180 px ± 2), drag reschedules across a compressed gap to the right minute, paint on a compressed gap creates at the painted minute, ring completes → strike + filled disc; perf spec: 5k tasks day-ready ≤ 50 ms, drag p95 ≤ 20 ms; evidence `arc6-slice-3-spine-{empty,block,done}.png`.

=== SLICE 4 — Panel sheet + week spines ===
Scope: the day panel as a two-detent sheet over the week overview per `mockups.md` → 10; desktop Week = spine columns.
Files: NEW src/chrome/PanelSheet.tsx, src/views/Week.tsx (spine columns), src/Planner.tsx, src/state/ui.ts (`panel: 'day'|'week'`), src/chrome/TabBar.tsx (glyph swap), src/styles/app.css, tests/week.spec.ts, chrome.spec.ts.
Implementation: mobile — the panel is `position: fixed` inside `.app`, detents expanded (top = header bottom) and collapsed (shows grabber + first row, ~110 px, 30 px side margins); drag on the grabber / top 56 px with `--ease-drawer` snap, velocity threshold 0.3 px/ms; tapping the active Timeline tab toggles; title grammar switches (slice 2 hook); week behind = hour rail `day_start`..`day_end` rounded out, 36 px/h, 13/700 labels with 9 px AM/PM; per-day spine 3 px gradient first→last node colour; 48 px discs / capsules; past days filled + white glyph, today/future `--node` + coloured glyph; tap a column → `date` + expand. Desktop — `Week` renders the same columns under the existing segmented control (no sheet), `W` toggles day/week as today. Drag-to-day in week keeps working via the column's own 36 px/h map (segments with `minPx: 0.6`, no compression).
Done: Playwright (iPhone 15): collapse by drag → week visible, Timeline tab glyph = grid, title `October 2026 ›`; tap Wed → date changes + panel expands; past-day chips have the filled background, future the dark one; desktop week screenshot matches the column spec; reduced-motion: detent change ≤ 160 ms; evidence `arc6-slice-4-week.png` + `-peek.png`.

=== SLICE 5 — Tab bar, FAB, Inbox screen ===
Status: done a072b4c
Scope: 4 tabs, FAB, Inbox empty state + rows per `mockups.md` → 01 Tab bar / 07.
Files: src/chrome/TabBar.tsx, Fab.tsx, src/views/Inbox.tsx, src/inbox/virtual.ts (row height), src/styles/app.css, tests/inbox.spec.ts, chrome.spec.ts.
Implementation: tabs `inbox · timeline · plan(label "AI", glyph ui-ai) · settings`; Week removed from the bar (`TabId` 'week' dropped; the view stays reachable through the sheet / desktop control); geometry + active pill per the sheet; FAB 58 px → wizard ①; inbox title 30/800, empty state + `New Inbox Task` → wizard with `inbox` preset; rows restyled to the node grammar (56 px disc, ring completes, chip/title opens the editor, Place button kept, drag kept); `in inbox` count in the rail header (desktop).
Done: exactly 4 `role=tab`; labels `Inbox Timeline AI Settings`; active tab has the dark pill + accent colour; bar 60 px tall, FAB 58 px, 16 px insets; inbox empty state renders the pill and it opens the wizard in inbox mode; axe clean; evidence `arc6-slice-5-tabbar-inbox.png`.

=== SLICE 6 — Wizard ① + ② and the duration sheet ===
Status: done 7870679
Scope: the create flow per `mockups.md` → 04 / 02 / 05 / 03; replaces the FAB command-line sheet (the desktop header command line stays).
Files: NEW src/editor/Wizard.tsx, StepTitle.tsx, StepWhen.tsx, TimeWheel.tsx, DurationSheet.tsx, MoreMenu.tsx, suggestions.ts (+ test), src/quickadd/QuickAdd.tsx (parser reuse, sheet mode removed), src/state/ui.ts (`wizard` state: step, draft, mode 'timeline'|'inbox'), src/data/types.ts + repo (settings `duration_presets`), src/editor/sheet.css, tests/wizard.spec.ts.
Implementation: full-screen sheet, coloured header formula, X, 84 px icon chip with white ring, title field = parser input (parse preview chips under it; a parsed time/duration/category pre-fills ②); Suggestions from `suggestions.ts` (last 60 days: distinct titles → mode start, median duration, category; seed set when empty); Continue floats above the keyboard. ②: date row (native date input styled as the row), Time section with ••• → MoreMenu (Change Day → date picker; Set Timezone → slice 7's picker; Change to All-Day; Add to Inbox → mode inbox, skips time; Time Picker → native time input), 15-min wheel with the accent start–end pill, Duration quick row from `duration_presets`, ••• → DurationSheet (hours/min wheels, editable presets with ×, Reset). Continue → ③ (slice 7). Esc / X closes with a discard confirmation only when the title is non-empty.
Done: Playwright: FAB → ① → type `Movie night at 8pm for 1.5h` → ② shows `8:00–9:30 PM`, duration `1.5h` selected → Continue → ③ → Create → a capsule appears 8:00–9:30; tap a suggestion fills all four fields; `Add to Inbox` lands the task in the inbox; presets edit persists across reload; wheel is keyboard-operable; axe clean; evidence `arc6-slice-6-wizard-{1,2,duration}.png`.

=== SLICE 7 — Details step ③ / edit screen + Set Timezone ===
Status: done 66221a0 (db/007 applied: optimo_007_task_tz 20261009181817)
Scope: `mockups.md` → 06; edit mode replaces TaskSheet; per-task timezone.
Files: NEW src/editor/StepDetails.tsx, AlertSheet.tsx, RepeatSheet.tsx, TimezonePicker.tsx, NEW db/007_task_tz.sql, src/data/db.ts (Dexie v4: `tz`), types.ts, repo.ts, src/sync/engine.ts (column), src/lib/time.ts (`tz` display conversion), src/editor/TaskSheet.tsx (removed; `editingId` opens ③), src/timeline/items.ts, docs/spec.md §2.1 + §5.1, tests/wizard.spec.ts, sync.spec.ts.
Implementation: header capsule on a spine stub + palette button (category/colour picker sheet, same chips as today); rows card date / time (→ ②) / alert (AlertSheet = existing lead chips; right value = first lead or `No alerts`); Repeat chip → RepeatSheet (existing options + this/following/all scope for occurrences); subtasks card with the sparkle button (wired in slice 8); notes; Create / Save; Delete row + Complete on the ring in edit mode. Timezone: `planner_tasks.tz text null` (007, additive, applied via the connector inside the order, hash recorded in evidence); a task with `tz` keeps its wall-clock in that zone and displays converted to the device zone with a small globe glyph after the meta; picker = `Intl.supportedValuesOf('timeZone')` filtered by search, device zone first.
Done: migration applied (list_migrations shows `optimo_007_task_tz`; `tz` column present; max(version) unchanged); Dexie upgrade keeps 5k seeded tasks; sync round-trips `tz` between two contexts; editing an existing task opens ③ pre-filled; a task set to `Europe/London 9:00` shows `3:00 AM` in `America/Chicago` with the globe; axe clean; evidence `arc6-slice-7-details.png` + `arc6-db007-apply.md`.

=== SLICE 8 — AI subtasks ===
Scope: the sparkle button generates subtasks through `plan-day`.
Files: supabase/functions/plan-day/index.ts + _shared (new `mode: 'subtasks'`), src/plan/api.ts, src/editor/StepDetails.tsx, tests/planfn.spec.ts, wizard.spec.ts, docs/spec.md §3.
Implementation: `subtasks` mode: title + notes + duration → 3–7 subtasks via one strict tool (`submit_subtasks`, `tool_choice: auto`, Haiku), no web search, counts against the 30/day limit, intent never logged; client: sparkle → spinner in the button → proposed rows appear ticked-off-able with `Keep all` / `Discard`; offline / not connected → the existing not-connected copy. Deploy `plan-day` inside the order via the connector with ezbr ship proof (before/after hash recorded).
Done: deno test covers the mode; Playwright with the plan fake: sparkle → 4 rows → Keep all → saved on the task; limit and offline states; ship proof in `arc6-slice-8-plan-day-deploy.md`.

=== SLICE 9 — Eye LITE vs mockups + Lighthouse ===
Scope: standard UI-arc close.
Implementation: capture every mocked state at 402×874 (dark) + light; the Eye LITE critique compares each capture to its mockup number and lists deltas as P0 (geometry / colour / flow off) or P1 (polish); P0 → fix slice 9b; P1 → `snag` Issues. Lighthouse perf ≥ 85 / a11y ≥ 90 on day + inbox (target: hold 100 / 98). page-diff gate: declared layout change for all views.
Done: `docs/evidence/arc6-eye-lite.md` with a per-mockup table (match / delta), 0 P0 open; Lighthouse JSON in evidence.
