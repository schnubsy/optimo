# UI/UX round 2026-10-09 — mockup spec sheet

Ten dark-mode iPhone mockups (`01`–`10-*.jpeg`, 1206 px wide = 402 CSS px at 3×; **CSS px = image px ÷ 3**).
Measured here with ±2 px tolerance; **where a value matters, open the image and measure — the image wins over this
sheet.** Light mode mirrors the dark design (decision 9). Decision 1 = **A**: layout, flow, sizes, spacing and colours
follow the mockups exactly; **glyph artwork is drawn in-repo (never traced) and creative copy is ours** (free-time
phrases, bookend names, suggestions seed).

## Palette (dark; light = mirror)
| Token | Dark value (measured) | Use |
|---|---|---|
| `--canvas` | `#000` → `oklch(0 0 0)` | outer canvas: header, strip, behind the panel |
| `--panel` | `#1C1C1E` → `oklch(0.21 0.004 285)` | the timeline panel, inbox/editor body |
| `--card` (new) | `#2C2C2E` → `oklch(0.27 0.004 285)` | editor row cards, wheel background, suggestion list |
| `--node` (new) | `#373839` → `oklch(0.32 0.003 285)` | chip / capsule fill, "Add Task" pill fill, tab-bar fill |
| `--spine` (new) | `#3D3D3D` → `oklch(0.34 0 0)` | spine line (3 px), dashes |
| `--ink` | `#FFF` | titles |
| `--ink-3` | `#6A6A6C` → `oklch(0.52 0.003 285)` | gutter times, meta line, free-time sentence, weekday labels |
| `--accent` | `#EC9792` → `oklch(0.75 0.095 26)` | year, selected day disc, active tab, FAB, duration in gap copy, Continue/Create |
| `--accent-tint` | `#524040` → `oklch(0.37 0.03 25)` | duration preset row, "New Inbox Task" pill fill |
| category blue (cat-5 powder) | `#6C97CE` → `oklch(0.66 0.10 255)` | glyph + ring colour sample; **all 8 category hues move to L 0.66 / C 0.10 for glyph+ring in dark** |
| editor header | category colour at **L 0.58, C 0.08** (`#5B7EA8` blue, `#C67D76` coral) | full-bleed header of the editor in the task's colour |
| week past-day chip fill | category colour at L 0.78 / C 0.08 (`#D29C9A`) with white glyph | week overview, days before today |

## 01 · Day (empty)
- **Header (canvas, 131 px tall + safe-area):** title `October 9, 2026 ›` — 30 px / 800, month+day `--ink`, year + `›` `--accent`; left pad 24. Tap → month view.
- **Strip:** 7 columns; weekday 13 px / 600 `--ink-3`; numeral 18 px / 600 `--ink`; selected day = **32 px accent disc**, numeral white; under each day a row of **12 px mini-chips** (that day's task glyphs on a `--node` disc, overlapping −3 px, max 4 then `+n`). Swipe = ±7 days (exists).
- **Panel:** `--panel`, top radius 28, 7 px side margins, grabber 45×5 `--spine` at 12 px; the panel is a **bottom sheet with two detents** (expanded = day, collapsed = week overview behind, see 10).
- **Gutter:** times 15 px / 600 `--ink-3`, right-aligned, right edge at x = 41; shown at every node start and at compressed-gap ticks.
- **Spine:** x = 78 (centre), 3 px, `--spine`; **solid** through proportional segments, **dashed 10/8** through compressed gaps.
- **Node row (short task):** 56 px `--node` disc centred on the spine, glyph 26 px in the category colour; text column from x = 119: meta `9:00 AM ↻` 15 px / 600 `--ink-3` (↻ = repeats, 14 px), title 22 px / 700 `--ink`, 2 px apart, block vertically centred on the chip; **complete ring** at x = 362 (centre), 22 px, 2 px stroke in the category colour. Row height = max(72, duration × 2 px/min).
- **Free gap:** the gap is **task-end → next task-start**. Proportional at **2 px/min** when ≤ 60 min (solid spine); longer gaps **compress to 120 px of spine (dashed)** with two intermediate hour ticks at ≈⅓ and ⅔ (rounded to the hour) in the gutter. Gap content, left at x = 119, vertically centred: a 20 px timer glyph + sentence 17 px / 400 `--ink-3` with the duration **17 px / 700 `--accent`** (`13h 29m`); for gaps ≥ 90 min an **"Add Task" pill** below (height 28, pad 0 14, `--node` fill, ⊕ 16 px + label 15 px / 700 in `--accent`) → new-task wizard pre-filled with the gap start and `min(default, gap)`. Shorter gaps show the sentence only; tapping it does the same.
- **Copy (ours, rotating by gap length, seeded by date so it doesn't flicker):** long gaps: `Room to make something of **13h 29m**.` · `**10h 59m** wide open.` · `A clear run of **4h 20m**.` — short gaps: `**1h** free — want to fit something in?` · `**45m** between things.` Never Structured's lines.
- **Bookends (decision 4):** `settings.day_start` / `day_end` render as two **anchor rows** on the spine with `rest-alarm` (coral) / `rest-moon` (blue) glyphs and the ↻ mark; names from new settings `day_start_name` / `day_end_name`, defaults **"Up"** and **"Lights out"**; tap → opens Settings → Day. Not tasks; not completable; not synced as tasks.
- **Now marker (decision 6):** a 10 px accent disc on the spine with a 2 px accent hairline to the right edge, only on today; the running task's chip gets a 2 px accent ring.
- **Tab bar:** floating pill `--node` at 80 % + blur, **60 px tall**, left 16 → right 112 (width = viewport − 128 − 16), bottom inset 16 + safe-area; 4 tabs **Inbox · Timeline · AI · Settings**: glyph 24 px + label 11 px / 600, `--ink`; active = **darker pill behind it** (`oklch(0.18 0 0)`, 76×52, radius pill) with glyph + label `--accent`. Keyboard ←/→ as today.
- **FAB:** **58 px** accent disc, right 16, same baseline as the bar, `+` 28 px in `--ink-on-accent`.
- **Glyph subjects to draw** (24 px grid, in-repo): tray (inbox), **spine-list** (timeline: a dot over a short dash + two lines), **four-point sparkle** (AI), gear, `ui-grid-2x3` (week mode), `ui-more` (•••), `ui-repeat`, `ui-timer`, `ui-bell-off`, `ui-palette`, `ui-globe`, `ui-clock`, `ui-plus-circle`. Reuse `rest-alarm`, `rest-moon`, `work-monitor` (TV), `errand-cart`, `fitness-run`, `meeting-phone`.

## 08 / 09 · Day with a block · done state
- **Long task (≥ 30 min)** = a **capsule** on the spine: width 56, height = duration × 2 px/min (90 min → 180), radius 28, `--node` fill, glyph centred; meta `8:00–9:30 PM (1 hr, 30 min)`; gutter shows ticks every 30 min inside the capsule and the proportional gap when ≥ 40 px apart (`8:00 · 9:00 · 9:30 · 10:00 · 10:30`).
- Drag the capsule / disc = reschedule (snap kept); the drop ghost and the paint ghost render in the **same segment space** (see slice 3's `segments.ts`).
- **Done (09):** ring becomes a **filled accent disc with a 12 px white check**; title `line-through`, `--ink-3`; chip keeps its glyph (dimmed to 60 %).
- Strip mini-chips update live (Fri shows alarm · TV · moon).

## 10 · Week overview (panel collapsed)
- Title becomes `October 2026 ›`; strip keeps the selected disc, mini-chips hidden.
- Hour rail 9 AM → 10 PM (= `day_start`..`day_end`, rounded out to the hour) at **36 px/h**, labels 13 px / 700 `--ink-3` with a 9 px superscript AM/PM.
- Per day: a **3 px spine** from the first node to the last with a **vertical gradient first-node colour → last-node colour**; nodes are 48 px discs (or 48-wide capsules at 36 px/h). **Past days:** disc filled in the category colour, white glyph. **Today + future:** `--node` disc, coloured glyph. Tap a column → that day + expand the panel.
- The **day panel peeks** at the bottom (collapsed detent = grabber + first row, ~110 px, 30 px side margins); drag up or tap the Timeline tab to expand. **Timeline tab glyph swaps to `ui-grid-2x3`** while collapsed; tapping the active Timeline tab toggles the detent; `W` toggles on desktop.
- Desktop (decision 5): no sheet — Day/Week/Month segmented control stays; Week = these spine columns at 36 px/h; Day = the spine timeline in the main pane with the inbox rail.

## 04 · New task ① — title + suggestions
- Full-screen sheet; **header 200 px in the task colour at L 0.58** (default = accent hue until a category is set); **X** 44 px translucent disc (white 15 %) at 24/24; **icon chip** 84 px `--node` disc with a 4 px white ring, glyph 36 px in the category colour, at left 32, vertically centred in the header; title field right of it: 28 px / 700 white, placeholder white 55 %, **1 px underline** white 60 %, autofocus; the ring at the right is hidden in create mode.
- The title field **keeps the plain-English parser** (decision 3): `Lunch at 1pm for 1h #personal` fills category/icon/time/duration and the parse preview chips sit under the field.
- **Suggestions** (label 17 px / 600 `--ink-3`, left 24): a `--card` list, rows 72 px, 24 px coloured glyph at left 24 (no disc), meta `10:00–10:15 AM (15 min)` 15 px `--ink-3`, title 20 px / 600 `--ink`; source = distinct titles from the last 60 days with their most common start and duration, else a seed set of ours (`Answer emails · 15 min`, `Walk · 30 min`, `Groceries · 1 h`, `Movie night · 1 h 30 min`, `Run · 1 h`). Tap → fills title, glyph, category, time, duration.
- **Continue** 56 px accent pill, 22 px / 600 `--ink-on-accent`, floats above the keyboard (`keyboardInset`, exists).

## 02 / 05 / 03 · New task ② — when
- Header as ①, now showing meta `8:00–9:30 PM (1 hr, 30 min)` above the title and the **complete ring** at right.
- **Date row card** (`--card`, 56 px, radius 22): calendar glyph `--accent` left 24, `Fri, Oct 9, 2026` 20 px `--ink`, right `Today ›` `--ink-3`. Tap → date picker.
- **Time** section: title 22 px / 700, **•••** 32 px `--node` disc at right → popover (05): `Change Day · Set Timezone` ÷ `Change to All-Day · Add to Inbox` ÷ `Time Picker ›` — rows 48 px, glyph `--accent`, text 20 px; popover `--card` at 92 % + blur, radius 22, hairline separators.
- **Time wheel** (`--card`, radius 22, 260 px tall): 15-min steps (settings.snap), 20 px `--ink-3` fading out ±3 rows, the **selected row is a 240×48 accent pill** reading `8:00–9:30 PM` 20 px / 700 `--ink-on-accent`; wheel scroll-snaps; ArrowUp/Down works.
- **Duration** section: `•••` → **Duration sheet (03)**: bottom sheet over the editor, `Duration` 24 px / 700 + X 44; two wheels `N hours` · `N min` in `--font-time` tabular; **Presets** (editable chips with ×, `Reset` restores `1m 15m 30m 45m 1h 1h 30m`), stored in `settings.duration_presets`.
- **Duration quick row:** a `--accent-tint` pill 52 px tall holding the presets as chips (`1 · 15 · 30 · 45 · 1h · 1.5h`, 17 px / 700); selected = accent pill 64×44.
- **Continue** → ③. `Add to Inbox` skips ③'s time rows.

## 06 · New task ③ — details (also the edit screen)
- Header in the task colour: the chip is a **capsule on a spine stub** (56 wide, height = duration × 2 px/min, min 56, max 160) with a **palette button** (40 px translucent disc, `ui-palette`) at its bottom-left → category/colour picker; meta + title + ring as ②.
- Rows card: `Fri, Oct 9, 2026 … Today ›` · `8:00–9:30 PM … 1 hr, 30 min ›` (→ ②) · `🔕 1 Alert … At start ›` (alert sheet: the existing lead-time chips; the right value summarises the first lead; 0 alerts → `No alerts`).
- **Repeat** chip (48 px, `--node`, ↻ + `Repeat`) → the existing repeat options as a sheet; when set the chip reads the rule (`Every weekday`).
- **Subtasks card:** `☐ Add Subtask` row (checkbox square 24 px, 2 px `--ink-3`) + **sparkle button** at right → AI subtasks (slice 8); existing subtask rows above it.
- **Notes** textarea, placeholder `Add notes, meeting links or phone numbers…`.
- **Create Task** / **Save** 56 px accent pill. Edit mode = this screen with `Delete` as a text-danger row under notes and `Complete` on the ring.

## 07 · Inbox
- Title `Inbox` 30 px / 800 at 24/24; empty state: 110 px accent tray glyph at 42 % height, below it a **`New Inbox Task` pill** (56 px, `--accent-tint` fill, ⊕ 20 px + 22 px / 600 `--accent`) → wizard with `Add to Inbox` preset.
- Rows (not mocked — same grammar as the day rows without the spine): 56 px disc, title 20 px, meta = duration · category, ring completes, drag to the timeline / Place as today.
