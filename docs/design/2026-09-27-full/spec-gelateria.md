# optimo — design system spec · GELATERIA (winner)

Eye FULL review 2026-09-27 · Vogue (Coco Belmont) · Editorial / pop-editorial · light default, dark shipped.
Tokens: `tokens-gelateria.css` (every value below is a token name or an exact value from it).
Stack: React 18 + TypeScript + Vite, CSS custom properties, no Tailwind. Fonts via Google Fonts `<link>`.

## 1. Core visual language

- **The day is a menu.** Hour numerals and the day title are set in *Libre Caslon Display italic*; everything you can touch is *Karla*. The serif appears in exactly four places: day title, hour rail, free-time label, sheet title. Nowhere else.
- **Blocks are scoops.** Each timeline block is a rounded rectangle (`--r-md` 16px, or `--r-pill` when shorter than 40px) filled with the category tint (L 0.95) and set in the same hue's ink (L 0.32). A 28px circular icon chip (chip L 0.55, white or ink glyph) sits in the block's **top-right** corner.
- **Free time is a dotted connector with a duration**, centred in the timeline column between blocks, set in italic Caslon: "1 h 15 free". It is a create target.
- **Now is ink.** The now line is a 2px `--ink` rule spanning gutter and column with a small pill flag showing the time. Never red.
- **One accent — mango** (`--accent`) for FAB, Place, selected date, primary buttons and the focus ring. It never colours a block.
- Canvas is pure white in light; near-black blue-grey in dark. Depth is tint, not shadow; one soft shadow is reserved for floating things (dragged block, sheet, FAB, popover).
- Banned-defaults check: no cream, no terracotta, no all-caps eyebrows, no hairline rules (the connector is dotted, 2px dots), no middle-dot meta strings (use " · " only inside times, e.g. "14:00–15:30 · 1:30" is replaced by a two-line layout), no mono labels.

## 2. Colour

### 2.1 Neutrals (`--n-*`, warm grey H60 light / cool grey H260 dark)
| Step | Light | Dark | Role |
|---|---|---|---|
| 0 | oklch(1 0 0) | oklch(0.16 0.012 260) | canvas |
| 50 | oklch(0.985 0.005 60) | oklch(0.19 0.012 260) | panel (rail, tab bar, sheet) |
| 100 | oklch(0.97 0.008 60) | oklch(0.22 0.014 260) | surface (inputs, inbox rows, done blocks) |
| 200 | oklch(0.93 0.01 60) | oklch(0.27 0.015 260) | line, surface-hover |
| 300 | oklch(0.87 0.012 60) | oklch(0.34 0.016 260) | disabled fill |
| 400 | oklch(0.75 0.015 60) | oklch(0.46 0.018 260) | line-strong, prio-low, disabled text |
| 500 | oklch(0.62 0.018 60) | oklch(0.60 0.02 260) | ink-3 (captions ≥ 12px) |
| 600 | oklch(0.48 0.02 60) | oklch(0.72 0.02 260) | ink-2 |
| 700 | oklch(0.38 0.02 60) | oklch(0.80 0.018 260) | free-label |
| 800 | oklch(0.28 0.02 60) | oklch(0.88 0.015 260) | — |
| 900 | oklch(0.22 0.02 60) | oklch(0.93 0.01 260) | ink |
| 950 | oklch(0.16 0.015 60) | oklch(0.97 0.006 260) | — |

### 2.2 Accent (mango H75)
| Token | Light | Dark |
|---|---|---|
| `--accent` | oklch(0.55 0.19 75) · white text | oklch(0.78 0.16 75) · ink text oklch(0.20 0.02 75) |
| `--accent-hover` | oklch(0.50 0.19 75) | oklch(0.82 0.16 75) |
| `--accent-active` | oklch(0.45 0.18 75) | oklch(0.72 0.16 75) |
| `--accent-tint` / `--accent-ink` | oklch(0.95 0.045 75) / oklch(0.32 0.11 75) | oklch(0.30 0.055 75) / oklch(0.88 0.08 75) |

### 2.3 Categories (8) — tint / ink / chip / chip-ink
Light: tint `oklch(0.95 0.045 H)`, ink `oklch(0.32 0.11 H)`, chip `oklch(0.55 0.19 H)` with white glyph — except mint (H170) and lemon (H95), whose chips are L 0.55/0.60 with an **ink glyph** `oklch(0.20 0.02 H)`. Dark: tint `oklch(0.30 0.055 H)`, ink `oklch(0.88 0.08 H)`, chip `oklch(0.78 0.16 H)` with ink glyph for all eight.

| # | Name | H | Default mapping |
|---|---|---|---|
| 1 | blueberry | 250 | work |
| 2 | grape | 300 | meetings |
| 3 | pistachio | 140 | health |
| 4 | mango | 70 | personal |
| 5 | mint | 170 | errands |
| 6 | lemon | 95 | learning |
| 7 | strawberry | 15 | family |
| 8 | fig | 340 | home |

Per-block CSS: the block sets `--cat-h`, and derives `background: oklch(var(--tint-l) var(--tint-c) var(--cat-h))`, `color: oklch(var(--tint-ink-l) var(--tint-ink-c) var(--cat-h))`; hover/drag swap in `--tint-hover-*` / `--tint-drag-*`. Categories created by the user pick one of the 8 hues; custom hues are not offered (keeps every pair verified).

### 2.4 Semantic
success H140, warning H95, danger H15, info H250 — each with `-tint` and `-ink` pairs at the same recipe. Danger is the only red on screen; it appears in destructive buttons and error text.

### 2.5 Special effects
None besides the single soft shadow. No gradients, no blur, no glow.

## 3. Typography

| Role | Family | Size | Weight | Style | Notes |
|---|---|---|---|---|---|
| Day title (desktop) | display | 32px | 400 | italic | "Saturday, 26 September" |
| Day title (mobile) | display | 24px | 400 | italic | date strip above |
| Hour numeral | display | 20px | 400 | italic | right-aligned in gutter, `tabular-nums`; 16px on mobile |
| Free-time label | display | 14px | 400 | italic | "1 h 15 free" |
| Sheet title | display | 24px | 400 | italic | editor, place picker |
| Block title | ui | 15px | 700 | — | 14px in blocks < 40px; single line, ellipsis |
| Block time line | ui | 12px | 500 | — | `tabular-nums`, "14:00–15:30", second line "1:30" only if height ≥ 56px |
| Inbox title | ui | 15px | 700 | — | |
| Inbox meta | ui | 13px | 400 | — | category name + duration |
| Body / inputs | ui | 15px | 400 | — | |
| Chips / tabs | ui | 13px | 700 | — | |
| Micro (week block, badges) | ui | 11px | 700 | — | |
| Focus timer | display | 40px | 400 | — | `tabular-nums` |

Line heights: display 1.15, titles 1.3, body 1.5. `font-variant-numeric: tabular-nums` on every time and duration. Minimum text size 11px; category ink is never used below 12px.

## 4. Spacing, layout, grid

- 4px base scale (`--sp-1` … `--sp-12`).
- Desktop ≥ 900px: two panes — inbox rail `--rail-w` 300px (panel) + timeline. Quick-add sits at the top of the timeline pane, full width. Top bar 56px: ‹ date › then Planned / Free / Done stats, then Day · Week · Month segmented control, Settings.
- Mobile < 900px: single pane; 48px top bar (‹ date ›, free/done), 44px date strip of 7 pills, quick-add pill, timeline; FAB 56px bottom-right (`--r-pill`), bottom tab bar 64px + safe-area (Day · Inbox (badge) · Week · More).
- Timeline: gutter `--gutter-w` 64px (52px mobile); hour rows 72px (66px mobile) = `--px-per-min` 1.2 (1.1); 30-min hairlines in `--line`, hour lines in `--line-strong`. Blocks are absolutely positioned; `height = duration × px-per-min − --block-gap`.
- Overlaps: side-by-side columns with 4px gutter; max 3 columns, then "+n" pill.
- All-day strip: 36px row above the timeline, blocks as pills.

## 5. Components

### 5.1 Timeline block
Structure: `article.block[data-cat-h]` → `.title` (checkbox 18px circle + text) · `.time` · `.chip` (top-right, 28px circle) · `.prio-edge` (3px bar on the left inside edge, high = danger, med = warning, low = n-400, none = hidden) · `.handle` (bottom edge, hidden until selected/hover).

| State | Visual |
|---|---|
| Default | tint bg, ink text, chip visible if height ≥ 40px; radius 16 (pill if < 40px). |
| Hover (pointer) | `--tint-hover-*`, cursor grab, handle fades in (100ms). |
| Selected | 2px ink outline inset; handle visible; keyboard focus ring `--focus-ring`. |
| Running (now inside block) | 2px ink outline inset + the now flag reads the block colour's ink; **no fill progress**. Title gets a small "now" chip in `--accent-tint`/`--accent-ink`. |
| Done | bg `--done-tint`, text `--done-ink`, title strikethrough, chip becomes a check on `--done-ink`, checkbox filled. Three cues, no opacity change in light; 0.85 opacity in dark. |
| Dragging | scale `--scale-lift` (1.02), shadow `--shadow-drag`, `--tint-drag-*`; the source slot shows a dotted ink outline ghost; gutter shows a live start-time pill. Transform-only. |
| Resizing | same as dragging without scale; a floating duration pill ("1:45") at the handle. |
| Overlap | side-by-side; each keeps full styling. |
| Short (< 25 min, < 30px) | single line, chip 18px inline before title, time hidden; hit area padded to 44px via `::before` pseudo-element. |
| Out of day bounds | 0.6 opacity + `--surface` bg. |
| Loading (sync pending) | small 6px pulsing dot in ink-3 at the chip's edge. |
| Error (sync failed) | chip ring 2px `--danger`; tooltip. |

### 5.2 Free-time connector
A vertical dotted line (`2px` dots, `--free-line`, `border-left: 2px dotted`) centred in the column, running from the previous block's bottom + 6px to the next block's top − 6px; the italic label ("1 h 15 free") sits at the vertical centre on a canvas-colour pill (`--r-pill`, 4px 10px) so it breaks the dots; a "+" button 24px (`--surface` bg, ink) at the right edge. Renders only for gaps ≥ 10 min; below 30 min the label hides and only the "+" remains. Hover/focus: pill bg → `--free-hover`, label ink → `--accent-ink`. Tap/click = create at gap start with duration = min(gap, default). Drop target during drag: pill bg `--accent-tint`, dots `--accent`.

### 5.3 Now line
2px `--now-line` from gutter left edge to column right; flag pill (`--now-flag-bg`/`--now-flag-fg`, 11px 700, `tabular-nums`) at the gutter, left aligned. Updates every 30 s; when reduced motion is off, moves with a 250ms `--ease-standard` transition on `transform`. `aria-hidden`; the current time is announced via the top bar's visually hidden live text.

### 5.4 Inbox row
Panel list, rows 56px min, `--surface` bg, `--r-md` 14px, 6px gap; 18px chip (category, small) · title 700 · meta 13px ("Personal · 0:30" → written as "Personal, 0:30") · Place pill (`--accent`, 13px 700, 32px tall, 44px hit). Hover: `--surface-hover`. Dragging: same lift as blocks. Empty state: italic Caslon "Nothing waiting." + "Add something" link. Mobile: full-height tab; swipe-right on a row = Place.

### 5.5 Quick-add
Pill field 44px (`--surface` bg, `--r-pill`), leading "+" in `--accent`, placeholder "Add a task — try 'Lunch with Sam at 1pm for 1h #personal'". On input, a parse-preview row appears beneath: chips (`--surface`, 13px) for title · time · duration · category (in its tint/ink) · priority · repeat; each chip is a 44px-tall button that opens its field. Enter commits; Esc clears. Error (unparseable time): chip in `--danger-tint`/`--danger-ink` with "didn't catch a time — inbox?".

### 5.6 Editor sheet
Mobile: bottom sheet `--r-sheet` 28px, `--panel` bg, `--shadow-sheet`, grabber 36×5 `--n-300`; desktop: 420px side panel with the same content and `--r-lg`. Title in display italic 24px (editable inline). Fields in order: title, category (8 chips, 40px circles in chip colour with white/ink glyph, selected = 2px ink ring at 2px offset), duration (pill chips 30/45/60/90/2h + custom), start (date + time inputs, `--surface`, `--r-sm`), all-day toggle, priority (segmented pills), repeat (select), subtasks (checkbox list, 44px rows), reminders, notes. Footer: Save (`--accent`, full width, 48px) · Delete (text, `--danger`). When completing early/late, a banner in `--accent-tint` offers "Adjust to actual (1:20)?" with one button.

### 5.7 Week compact block
`--r-sm` 10px, tint/ink, 11px 700 title, one line; no chip below 36px height; 4px left inner priority edge. Today's column bg `--accent-tint` at 40% alpha. Free-time in week: dotted rule + "1:15" in 10px, gaps ≥ 45 min only. Header per day: "Sat 26" 700 + "6h30 · 3h20 free" 11px ink-2 (this is the one allowed use of a middle-dot: two numbers).

### 5.8 Tab bar / FAB
Tab bar: `--panel`, top border `--line`, 4 items, 24px icons (outline; filled when active, per §6) + 11px 700 label; active in `--accent`; inbox count badge `--accent` pill 16px. FAB 56px `--r-pill`, `--accent`, white "+", `--shadow-fab`, 16px from the right, 16px above the tab bar; press → `--scale-press`. Desktop has no FAB; quick-add is always visible.

### 5.9 Buttons, inputs, chips (shared)
Primary: `--accent` bg, `--ink-on-accent`, 44px, `--r-pill`, 15px 700; hover `--accent-hover`; active `--accent-active` + `--scale-press`; disabled `--n-300` bg / `--n-500` text; loading: label fades to 0.5 + 16px ring spinner in current colour. Secondary: `--surface` bg, ink. Tertiary: text only, `--accent-ink` on light. Inputs: `--surface`, `--r-sm`, 44px, 15px; focus `--focus-ring`; error border 2px `--danger` + message in `--danger-ink`. Chips: 32px, `--r-pill`, `--surface`; selected `--accent` / `--ink-on-accent`.

## 6. Iconography (in-repo 24px set, `src/icons/`)

- 24×24 viewBox, 20×20 live area, 2px stroke, round caps and joins, whole-pixel alignment. Two states per glyph: **outline** (default) and **filled** (active tab, done chip) — filled = solid shape with one 2px counter-cut so it doesn't blob at 18px.
- Category glyphs (≥ 40): drawn as filled-friendly silhouettes (briefcase, people, heart-pulse, cutlery, bag, book, house, leaf…). Never SF Symbols, never traced from a library.
- In a chip: glyph is 16px inside a 28px circle (12px inside 18px). Chip bg = category chip colour; glyph = white or ink per token.
- UI chrome glyphs at 20px in ink-2; active in `--accent`.
- Every icon has a `<title>` and the React component takes `aria-hidden` unless it is the only content of a button, in which case `aria-label` is required.

## 7. Motion

| Interaction | Duration | Easing | What moves |
|---|---|---|---|
| Hover / press | `--dur-instant` 100ms | ease | tone, `scale(.97)` on press |
| Check draw + done | `--dur-fast` 150ms then `--dur-base` 200ms | `--ease-decel` | check path, then tint → done-tint |
| Block appears (create) | `--dur-base` 200ms | `--ease-emph-decel` | `translateY(8px)→0`, opacity, `scale(.97)→1` |
| Neighbours reflow | `--dur-reflow` 250ms | `--ease-standard` | `transform` only |
| Drag lift | 100ms | ease | `scale(1.02)`, shadow |
| Drag settle | `--dur-settle` 480ms | `--ease-settle` (linear() spring, bounce ≈ .15) | `transform` to snapped slot |
| Resize | live, 0ms | — | height follows pointer; commit snaps with 150ms |
| Sheet open / close | 380ms / 250ms | `--ease-drawer` / `--ease-accel` | `translateY`, scrim opacity 200ms |
| Free-time label hover | 100ms | ease | tone only |
| Now line tick | 250ms | `--ease-standard` | `transform: translateY` |
| Tab switch | 150ms | `--ease-standard` | icon outline→filled cross-fade |
| Celebration on complete | 400ms | ease-out | 6 dots in the category chip colour, opacity → 0; user tap only, never on sync |

Reduced motion (`prefers-reduced-motion: reduce`): all transforms drop (`--scale-*` = 1, `--lift-y` 0, reflow 0ms), tone/opacity changes remain at ≤ 160ms, the celebration is replaced by the chip flip, the sheet dissolves (opacity) instead of sliding. Interruptible drag uses a JS spring (dnd-kit + a small spring util), not `linear()`.

## 8. Dark mode transformations

Canvas → oklch(0.16 0.012 260); tints go to L 0.30 / C 0.055 with ink at L 0.88; chips brighten to L 0.78 and take dark glyphs; accent becomes oklch(0.78 0.16 75) with dark text; now line becomes near-white; done blocks use 0.85 opacity in addition to tone; shadows go to black at 0.6–0.7 alpha; every block gets a 1px inset ring `oklch(1 0 0 / 0.06)` so tints separate from the canvas (survey: dark tints collapse without it). Theme is set by `data-theme` on `<html>` (system / light / dark from Settings, persisted).

## 9. Data visualisation
Day-summary bars (Planned / Free / Done) use `--accent`, `--free-line`, `--success` at 8px height, `--r-pill`. Month view dot density: 6px dots in category chip colours, max 4 per day then a "+n" in ink-2. Charts (later arcs) use the 8 chip colours in order 1→8; never tints for data.

## 10. Imagery
None. Empty states use italic Caslon copy and a single 40px category chip, no illustrations.

## 11. Microcopy & voice
Plain, short, warm, never exclamatory. Success: "Placed at 13:00." Error: "Couldn't sync — will retry." Empty inbox: "Nothing waiting." Empty day: "A clear day. Add something, or leave it." Loading: skeleton pills in `--surface`, no spinner text. Confirmation only for delete of a series ("Delete all 12?"). Undo toast (5 s) for complete / move / resize / delete: "Moved to 14:00 — Undo".

## 12. Accessibility

| Pair | Light | Dark |
|---|---|---|
| ink on canvas | oklch 0.22 on 1.0 ≈ 16.6:1 | 0.93 on 0.16 ≈ 15:1 |
| ink-2 on canvas | 0.48 ≈ 6.5:1 | 0.72 ≈ 6.6:1 |
| ink-3 on canvas | 0.62 ≈ 4.6:1 (≥ 12px only) | 0.60 ≈ 4.5:1 |
| category ink on tint (all 8) | 0.32 on 0.95 ≈ 10–11:1 | 0.88 on 0.30 ≈ 9.2–9.6:1 |
| white on chip L 0.55 (H 15/70/250/300/340) | ≥ 4.5:1 | — |
| ink glyph on mint/lemon chip | ≈ 7:1 | — |
| dark chips L 0.78 + ink 0.20 | — | ≈ 8–9.6:1 |
| white on accent 0.55 | 4.6:1 | ink 0.20 on 0.78 ≈ 9:1 |
| free-line vs canvas | 0.75 ≈ 3:1 (non-text) | 0.46 ≈ 3.2:1 |
| free label ink-700 | ≈ 8:1 | ≈ 9:1 |

Verify at build with `scripts/gauntlet.sh` (axe) and a vitest contrast check over the token file (culori `wcagContrast`).
Keyboard: N new · / focus quick-add · arrows move selection · Shift+↑/↓ nudge 5 min · Alt+↑/↓ resize 5 min · X done · Enter edit · Delete delete · I inbox · W week · Esc close. Screen reader: each block is a `button` with label "Write the migration plan, Work, 14:00 to 15:30, 1 hour 30, high priority"; free-time connectors are buttons "1 hour 15 free from 07:45, add task"; the now line is aria-hidden with a live region in the header. Focus ring: 3px accent at 45% alpha, never removed. Targets ≥ 44px everywhere (short blocks via padded pseudo-element). Colour is never the only cue: category = hue + glyph + name in meta; done = check + strike + tone; task vs event (arc 2) = events get a 1.5px ink outline and no checkbox.

**Essence.** A bright counter of scoops with an italic menu in the margin — editorial confidence applied to a to-do list, without a single pixel of Structured.
