# optimo — design system spec · MEADOW (runner-up)

Eye FULL review 2026-09-27 · Calm (Anaya Shrestha) · Organic / Calm-tech · light default, dark shipped.
Tokens: `tokens-meadow.css`. Stack: React 18 + TypeScript + Vite, CSS custom properties. One Google Font: Nunito Sans (400/600/700/800 + italic 400).

## 1. Core visual language

- **Blocks are pills.** Every timeline item is a full-width pill (`--r-md` 22px, radius = min(22px, height/2)), tinted at L 0.94 with same-hue ink at L 0.32, a 28px circular chip at the **left** end, title beside it, time at the right end. Minimum height 32px (`--pill-min-h`).
- **Elapsed is a sweep, not a ring.** The running pill shows a left-to-right overlay (`--elapsed-overlay`, 6% black) whose width = elapsed / duration. Only the running pill has it.
- **Free time is a stem.** A 3px-dotted sage line (`--stem-line`) runs between pills at x = 14px from the column edge (aligned with the chip centre) with a small leaf-green label pill ("1h 15m free") at its midpoint and a "+" at the right.
- **Now is moss.** 2px `--accent` line with a moss time pill in the gutter.
- One family, five weights: Nunito Sans 800 for the day title, 700 for titles, 600 for chips/labels, 400 body, 400 italic for empty-state copy. Times use `tabular-nums`.
- Canvas is a warm off-white (`oklch(0.99 0.006 110)`), never pure white; surfaces are white so pills and rows lift by tone alone. One soft shadow for floating things.
- Banned-defaults check: no cream/serif/terracotta, no all-caps, no hairlines (dotted 3px), no mono labels, no identical-card grid (pills vary in height and the rail uses list rows).

## 2. Colour

### 2.1 Neutrals (`--n-*`, green-grey H110–140)
| Step | Light | Dark | Role |
|---|---|---|---|
| 0 | oklch(0.99 0.006 110) | oklch(0.17 0.012 140) | canvas |
| 50 | oklch(0.975 0.01 110) | oklch(0.20 0.013 140) | panel |
| 100 | oklch(0.955 0.012 110) | oklch(0.23 0.015 140) | surface-hover / done-tint |
| 200 | oklch(0.92 0.02 110) | oklch(0.28 0.016 140) | line |
| 300 | oklch(0.86 0.02 110) | oklch(0.35 0.018 140) | disabled fill, grabber |
| 400 | oklch(0.74 0.02 120) | oklch(0.47 0.02 140) | line-strong, prio-low |
| 500 | oklch(0.60 0.025 130) | oklch(0.60 0.022 140) | ink-3 |
| 600 | oklch(0.48 0.03 140) | oklch(0.72 0.022 140) | ink-2, done-ink |
| 700 | oklch(0.38 0.03 140) | oklch(0.80 0.02 130) | — |
| 800 | oklch(0.30 0.03 140) | oklch(0.88 0.016 120) | — |
| 900 | oklch(0.26 0.03 140) | oklch(0.93 0.01 110) | ink |
| 950 | oklch(0.18 0.02 140) | oklch(0.97 0.006 110) | — |
Surface (`--surface`) is pure white in light, n-100 in dark.

### 2.2 Accent (moss H130)
`--accent` oklch(0.52 0.13 130) (white 5.2:1) · hover 0.47 · active 0.42 · tint oklch(0.95 0.04 130) / ink oklch(0.32 0.09 130). Dark: oklch(0.80 0.14 130) with ink oklch(0.20 0.02 130); tint 0.30 / ink 0.88.

### 2.3 Categories — meadow at noon
Light: tint `oklch(0.94 0.05 H)`, ink `oklch(0.32 0.10 H)`, chip `oklch(0.52 0.13 H)` + white glyph (buttercup H90 chip is 0.58 with an ink glyph; pebble H60 is low-chroma 0.02/0.05). Dark: tint 0.30/0.055, ink 0.88/0.08, chip 0.78/0.14 + ink glyph.

| # | Name | H | Default |
|---|---|---|---|
| 1 | sky | 230 | work |
| 2 | lavender | 285 | meetings |
| 3 | grass | 135 | health |
| 4 | apricot | 50 | personal |
| 5 | pond | 190 | errands |
| 6 | buttercup | 90 | learning |
| 7 | heather | 330 | family |
| 8 | pebble | 60 | home |

Per-pill derivation is identical to Gelateria (`--cat-h` → `oklch(var(--tint-l) var(--tint-c) var(--cat-h))`).

### 2.4 Semantic
success H150 · warning H80 · danger H25 · info H230, each with tint/ink pairs. Danger only in destructive actions and errors.

## 3. Typography (Nunito Sans only)
| Role | Size | Weight | Notes |
|---|---|---|---|
| Day title desktop / mobile | 30 / 22px | 800 | letter-spacing −0.01em |
| Hour numeral | 12px | 600 | gutter, `tabular-nums`, ink-2 |
| Pill title | 15px (14 in short pills) | 700 | one line, ellipsis |
| Pill time | 12px | 600 | right end, `tabular-nums` |
| Stem label | 12px | 700 | "1h 15m free" |
| Sheet title | 24px | 800 | |
| Inbox title / meta | 15 / 13px | 700 / 400 | |
| Body, inputs | 15px | 400 | |
| Chips, tabs | 13px | 600 | |
| Week block | 11px | 700 | |
| Focus timer | 40px | 800 | `tabular-nums` |
| Empty-state copy | 15px | 400 italic | |
Line heights 1.15 / 1.3 / 1.5. Minimum 11px.

## 4. Spacing, layout
4px scale. Desktop ≥ 900px: rail 300px (panel) + timeline; top bar 56px; quick-add pill 44px above the timeline. Mobile: 48px top bar, 44px date strip (pills), quick-add, timeline, FAB 56px, tab bar 64px + safe area. Gutter 56px (48px mobile); 72px per hour (66px mobile). Pills are absolutely positioned, `height = max(32px, duration × px-per-min − --pill-gap)`; pills that would overlap because of the 32px floor **stack** (the later one is pushed down) and a "+n" pill appears when three or more short items collide within 30 min; tapping expands them as a list popover. Overlap (true time overlap): side-by-side halves with 4px gutter, chip hides below 140px width.

## 5. Components

### 5.1 Timeline pill
Structure: `button.pill[data-cat-h]` → `.chip` (28px, left, absolutely centred vertically) · `.title` · `.time` · `.elapsed` (overlay) · `.handle` (bottom edge) · priority = 2px ring on the chip (`--prio-*`), never the pill.

| State | Visual |
|---|---|
| Default | tint, ink, chip; radius min(22, h/2). |
| Hover | `--tint-hover-*`; handle fades in 120ms. |
| Selected | 2px `--accent` ring at −2px offset; handle visible. |
| Running | `.elapsed` overlay from left, width = elapsed%; now line crosses it; small "now" text in ink at the right end before the time. |
| Done | `--done-tint` bg, `--done-ink`, strike, chip → check (chip bg n-400). |
| Dragging | `scale(1.015)`, `--shadow-drag`, `--tint-drag-*`; neighbours reflow 300ms; ghost = dotted `--accent` pill outline at target. |
| Resizing | height follows; floating duration pill; commit snaps 150ms. |
| Short (< 27 min) | 32px pill, chip 20px, time hidden, title 14px; hit area 44px via padded pseudo-element. |
| Out of bounds | 0.6 opacity + surface bg. |
| Sync pending / error | 6px dot on the chip edge (ink-3 pulse / `--danger` ring). |

### 5.2 Free-time stem
`border-left: 3px dotted var(--stem-line)` at x = 14px, from prev pill bottom + 8px to next top − 8px. Label pill (`--stem-label-bg` / `--stem-label-fg`, 12px 700, 24px tall, `--r-pill`) at the midpoint, offset right of the stem by 12px; "+" 24px circle at the right edge. Gaps ≥ 10 min render; < 30 min: "+" only. Hover: `--stem-hover-bg`. Drop target: stem dots → `--accent`, label bg → `--accent-tint`.

### 5.3 Now line
2px `--accent` across gutter + column, time pill (`--now-flag-bg`/`fg`, 11px 700) in the gutter; moves every 30 s with a 300ms `--ease-standard` transform.

### 5.4 Inbox row
White row, `--r-pill` when ≤ 56px tall, 20px chip, title 700, meta 13px ("Personal, 0:30"), Place button (`--accent-tint`/`--accent-ink`, 32px pill, 44px hit). Empty state: italic "Nothing waiting — enjoy the space." Mobile: full-height tab; swipe-right = Place.

### 5.5 Quick-add
White pill 44px, leading "+" in `--accent`; parse-preview row of chips beneath (each 44px hit, category chip in its tint/ink). Enter commits, Esc clears; unparseable time → chip in `--warning-tint` "no time — goes to inbox".

### 5.6 Editor sheet
Bottom sheet `--r-sheet` 28px, `--panel`, `--shadow-sheet`, grabber 36×5 n-300; desktop 420px side panel. Title 24px 800 editable. Fields: title · category (8 chips 40px, selected = 2px ink ring) · duration (pill chips) · start (date/time inputs, white, `--r-sm`) · all-day · priority (segmented pills) · repeat · subtasks (44px rows, circle checkboxes) · reminders · notes. Save = `--accent` 48px pill; Delete = text `--danger`. "Adjust to actual (1:20)?" banner in `--accent-tint` on early/late completion.

### 5.7 Week compact block
`--r-pill`, tint/ink, 11px 700, 6px chip dot at left; today column `--accent-tint` at 40%; stems in week for gaps ≥ 45 min.

### 5.8 Tab bar / FAB
Panel bg, 4 tabs, 24px icons outline→filled, labels 11px 600, active `--accent`; inbox badge `--accent` pill. FAB 56px `--accent`, white "+", `--shadow-fab`.

### 5.9 Buttons / inputs / chips
Primary `--accent` pill 44px 15px 700; hover/active tokens; disabled n-300/n-500; loading = 16px ring. Secondary white + line; tertiary text `--accent-ink`. Inputs white, `--r-sm`, focus `--focus-ring`; error 2px `--danger` + `--danger-ink` text. Chips 32px pills.

## 6. Iconography
Same in-repo 24px set rules as the winner (2px stroke, round caps, outline + filled). In Meadow the chip glyph is 16px inside 28px (12 inside 20); chrome glyphs 20px ink-2. Filled variant is used for the active tab and the done chip.

## 7. Motion (slow ease, no bounce)
| Interaction | Duration | Easing | Moves |
|---|---|---|---|
| Hover / press | 120ms | ease | tone; press `scale(.98)` |
| Check + done | 180ms + 250ms | `--ease-decel` | check path, tone |
| Pill appears | 250ms | `--ease-emph-decel` | `translateY(6px)→0`, opacity |
| Reflow | 300ms | `--ease-standard` | transform |
| Drag lift | 120ms | ease | `scale(1.015)`, shadow |
| Drag settle | 350ms | `--ease-emph-decel` (no overshoot) | transform |
| Sheet open / close | 400 / 260ms | `--ease-drawer` / `--ease-accel` | translateY; scrim 200ms |
| Elapsed sweep | continuous | linear | width, updated every 30 s with a 300ms transition |
| Now line | 300ms | standard | transform |
| Celebration | none | — | Calm declines the burst; the chip flip is the reward |
Reduced motion: transforms off, reflow 0ms, tone transitions ≤ 160ms, sheet dissolves, elapsed sweep updates without transition.

## 8. Dark mode
Canvas oklch(0.17 0.012 140); tints 0.30/0.055 with ink 0.88; chips 0.78/0.14 with dark glyphs; accent 0.80/0.14 with dark text; elapsed overlay becomes 7% white; pills get a 1px inset ring `oklch(1 0 0 / 0.06)`; shadows black 0.6–0.7.

## 9. Data visualisation
Summary bars use `--accent` (planned), `--stem-line` (free), `--success` (done), 8px pills. Month dots in chip colours, max 4 + "+n".

## 10. Imagery
None; empty states are italic copy + one 40px chip.

## 11. Microcopy & voice
Gentle, short, no exclamation marks. "Placed at 13:00." · "Couldn't sync — will retry." · "Nothing waiting — enjoy the space." · "A clear day." · Undo toast 5 s for every mutating action. No confirmation dialogs except series delete.

## 12. Accessibility
| Pair | Light | Dark |
|---|---|---|
| ink on canvas | 0.26 on 0.99 ≈ 13.5:1 | 0.93 on 0.17 ≈ 14:1 |
| ink-2 | ≈ 6.5:1 | ≈ 6.6:1 |
| category ink on tint (8) | 0.32 on 0.94 ≈ 10:1 | 0.88 on 0.30 ≈ 9.3:1 |
| white on chip 0.52 (7 hues) | ≈ 5:1 | — |
| ink on buttercup chip 0.58 | ≈ 6.5:1 | — |
| dark chips 0.78 + ink 0.20 | — | ≈ 8.5:1 |
| white on accent 0.52 | 5.2:1 | ink on 0.80 ≈ 9.5:1 |
| stem line vs canvas | 0.78 ≈ 3:1 | 0.48 ≈ 3.3:1 |
| stem label | ≈ 9:1 | ≈ 9:1 |
Keyboard map, screen-reader labels and focus ring identical to the winner's spec §12. Colour never the only cue: hue + glyph + name; done = check + strike + tone; running = overlay + "now" text + line.

**Essence.** A stack of warm stones in a stream — soft, bright, unhurried, and nothing borrowed.
