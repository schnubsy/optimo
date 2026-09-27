# optimo — FINAL design-system spec (Meadow hybrid, pastel edition)

Eye FULL review 2026-09-27 · Mark's recipe (Meadow base · Nunito Sans · pill r22 + left chip · dotted rule with pill label · elapsed sweep) + amendments 1–4. Tokens: `tokens.css`. Mocks: `final.html`. Stack: React 18 + TypeScript + Vite, CSS custom properties.

## 1. Core visual language

- **Chalky pastels on a warm blush canvas.** Canvas `oklch(0.975 0.012 30)` — never pure white. Eight pastel pills (L 0.76, C 0.05–0.09) with same-hue ink text (L 0.28); each carries a dusty **chip** (L 0.55) with a **white filled glyph**. The chip is the bubble Mark asked for; the pill is the block.
- **One family.** Nunito Sans 800 (day title), 700 (titles), 600 (numerals, labels, times), 400 (body). Hour numerals 12px/600 upright, `tabular-nums`.
- **Pills.** Full width, radius `min(22px, height/2)`, min height 32px, chip at the left end.
- **The chip is the complete control** (amendment 2). No checkbox anywhere. Tap the chip → done: chip becomes a check glyph on `--done-chip`, pill fills `--done-fill`, title strikes, text `--done-ink`.
- **Free time = dotted rule + sage label pill.** A centred 2px dotted rule between pills, with the pill label "1h 15m free" at its midpoint and a "+" at the right.
- **Running = elapsed tone-sweep** (7% overlay from the left, width = elapsed %). Now line = accent coral with a time pill.
- **Floating chrome** (amendment 4). iPhone: a translucent pill tab bar and a separate round FAB float over the timeline; the timeline scrolls beneath them to the bottom of the screen. The header sits on a gradient fade with no border. Desktop: the left inbox rail stays; a floating segmented pill (Day · Week · Month) sits top-left of the timeline pane on the same fade.
- One accent, dusty coral H30, for FAB, active tab, now line, selected date, primary buttons.

## 2. Colour

### 2.1 Neutrals (warm blush H30–40)
| Step | Light | Dark | Role |
|---|---|---|---|
| 0 | oklch(0.99 0.006 30) | oklch(0.17 0.010 40) | surface (light) / deepest (dark) |
| 50 | oklch(0.975 0.012 30) | oklch(0.21 0.012 40) | **canvas** |
| 100 | oklch(0.96 0.015 30) | oklch(0.24 0.014 40) | panel (rail, sheet) |
| 200 | oklch(0.91 0.02 30) | oklch(0.32 0.016 40) | line |
| 300 | oklch(0.85 0.02 35) | oklch(0.38 0.018 40) | grabber, disabled fill |
| 400 | oklch(0.72 0.02 40) | oklch(0.48 0.02 40) | line-strong, prio-low |
| 500 | oklch(0.60 0.02 40) | oklch(0.62 0.02 40) | ink-3 (hour numerals) |
| 600 | oklch(0.50 0.025 40) | oklch(0.74 0.02 40) | ink-2 |
| 700–800 | 0.40 / 0.32 | 0.82 / 0.88 | — |
| 900 | oklch(0.27 0.02 40) | oklch(0.94 0.008 40) | ink |
Dark surface is `oklch(0.27 0.015 40)`.

### 2.2 Accent (dusty coral H30)
Light `oklch(0.55 0.14 30)` (white 4.8:1), hover 0.50, active 0.45, tint `oklch(0.93 0.035 30)` / ink `oklch(0.40 0.12 30)`. Dark `oklch(0.78 0.11 30)` with ink `oklch(0.22 0.02 30)`; tint 0.32 / ink 0.88.

### 2.3 The pastel eight (original; not sampled from any reference)
| # | Name | H | C | Light pill / text / chip | Dark pill / text / chip | Default |
|---|---|---|---|---|---|---|
| 1 | slate | 250 | 0.07 | 0.76·0.070 / 0.28·0.063 / 0.55·0.091 | 0.40·0.056 / 0.93·0.042 / 0.74·0.084 | work |
| 2 | salmon | 30 | 0.09 | 0.76·0.090 / 0.28·0.081 / 0.55·0.117 | 0.40·0.072 / 0.93·0.054 / 0.74·0.108 | meetings |
| 3 | sage | 140 | 0.07 | 0.76·0.070 / 0.28·0.063 / 0.55·0.091 | 0.40·0.056 / 0.93·0.042 / 0.74·0.084 | health / fitness |
| 4 | peach | 60 | 0.09 | 0.76·0.090 / 0.28·0.081 / 0.55·0.117 | 0.40·0.072 / 0.93·0.054 / 0.74·0.108 | personal |
| 5 | powder | 220 | 0.07 | 0.76·0.070 / 0.28·0.063 / 0.55·0.091 | 0.40·0.056 / 0.93·0.042 / 0.74·0.084 | errands / transport |
| 6 | lilac | 300 | 0.07 | 0.76·0.070 / 0.28·0.063 / 0.55·0.091 | 0.40·0.056 / 0.93·0.042 / 0.74·0.084 | learning |
| 7 | rose | 355 | 0.08 | 0.76·0.080 / 0.28·0.072 / 0.55·0.104 | 0.40·0.064 / 0.93·0.048 / 0.74·0.096 | family |
| 8 | sand | 80 | 0.05 | 0.76·0.050 / 0.28·0.045 / 0.55·0.065 | 0.40·0.040 / 0.93·0.030 / 0.74·0.060 | home / chores |

**Per-hue text decision.** Every pill uses **ink text** (same hue, L 0.28 light / L 0.93 dark) — at L 0.76 no pastel can carry white text at AA (white on L 0.76 ≈ 2.1:1), and lowering fills to L ≤ 0.56 would stop them being pastel. **White lives on the chip** (L 0.55, ≥ 4.6:1 on all eight; the chroma differences move the ratio by < 0.15). In dark mode the chip brightens to L 0.74 and takes a dark glyph (≈ 7:1). Composition in CSS: the block sets `--cat-h` and `--cat-c`; pill = `oklch(var(--pill-l) calc(var(--cat-c) * var(--pill-cm)) var(--cat-h))`, text = `oklch(var(--pill-ink-l) calc(var(--cat-c) * var(--pill-ink-cm)) var(--cat-h))`, chip = `oklch(var(--chip-l) calc(var(--cat-c) * var(--chip-cm)) var(--cat-h))`.

### 2.4 Semantic · now · free · done
success H145 · warning H75 · danger H20 · info H240, each with tint/ink. Now = accent. Free rule `oklch(0.80 0.03 30)` (decorative); free label pill `oklch(0.93 0.03 140)` / `oklch(0.32 0.08 140)` ≈ 8.5:1. Done fill `oklch(0.93 0.008 40)` with `--done-ink` `oklch(0.55 0.02 40)` ≈ 4.6:1; done chip `oklch(0.72 0.01 40)` with a white check (decorative — strike + tone + label carry the state).

## 3. Typography (Nunito Sans)
| Role | Size | Weight |
|---|---|---|
| Day title desktop / mobile | 28 / 22px | 800 (date part 600 in accent) |
| Stats line | 12px | 600, ink-2 |
| Date strip weekday / number | 10 / 13px | 600 / 700 |
| Hour numeral | 12px | 600, ink-3, upright, tabular |
| Pill title / short pill | 15 / 14px | 700 |
| Pill time | 12px | 600, tabular |
| Free label | 13px | 700 |
| Inbox title / meta | 15 / 13px | 700 / 400 |
| Tab label | 10px | 700 |
| Sheet title | 24px | 800 |
| Body / inputs | 15px | 400 |
| Focus timer | 40px | 800, tabular |
Minimum 10px (tab labels only); everything else ≥ 12px.

## 4. Layout

**iPhone (< 900px).** The timeline is the scroll container, full height; `padding-top: var(--header-h-mobile)`, `padding-bottom: var(--scroll-pad-bottom)`. Header (`position: fixed; top: 0`) = day title + stats + 7-pill date strip on `--header-fade` (canvas → transparent), no border, `pointer-events` only on its controls. Tab bar: `position: fixed; left: 16px; right: 88px; bottom: calc(16px + env(safe-area-inset-bottom)); height: 60px; border-radius: 999px; background: var(--bar-bg); backdrop-filter: var(--bar-blur); border: var(--bar-border); box-shadow: var(--shadow-bar)`. FAB: `position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); 56px` circle, accent, `--shadow-fab`. Gutter 46px; 66px per hour.

**Desktop (≥ 900px).** Rail 300px (panel) + timeline pane. Header (72px, fixed within the pane, on the fade): segmented pill Day · Week · Month (surface bg, `--shadow-bar`), ‹ day title ›, stats, quick-add pill (min 320px), settings gear. No tab bar, no FAB. Gutter 64px; 72px per hour. Justification for top-left over bottom-centre: the view switch belongs with date navigation; desktop has no thumb-reach case; a bottom floater would cover 18:00–22:00 where a day's last blocks live.

**Pill geometry.** Height `max(32px, duration × px-per-min − 4px)`. Pills under 27 min are "short": chip 22px, title 14px, time at the right end, hit area padded to 44px. Three or more short pills within 30 min collapse to a "+n" pill that expands to a list. True overlaps: side-by-side halves with a 4px gutter; chip hidden below 140px width.

## 5. Components

### 5.1 Timeline pill
`article.pill[data-cat]` with `style="--cat-h; --cat-c"` → `button.chip` · `.title` · `.time` · `.elapsed` · `.handle`.
| State | Visual |
|---|---|
| Default | pastel fill, ink text, chip 32px at left (6px inset), priority ring 2px on the chip (`--prio-*`; none = no ring) |
| Hover | `--pill-hover-l`; handle fades in 120ms |
| Selected | 2px accent ring at −2px; handle visible |
| Running | `.elapsed` overlay from left, width = elapsed %; "now" flag on the line |
| Done | fill `--done-fill`, text `--done-ink`, strike, chip `--done-chip` with check glyph; `aria-pressed="true"` on the chip |
| Dragging | `scale(1.015)`, `--shadow-drag`, `--pill-drag-l`; neighbours reflow 300ms; ghost = dotted accent outline |
| Resizing | height follows pointer; floating duration pill; commit snaps 150ms and writes `duration_min` only |
| Sync pending / error | 6px dot at the chip's edge (ink-3 pulse / `--danger` ring) |
| Out of bounds | 0.6 opacity + surface fill |
Dark: pills add `--pill-ring` (1px inset white 6%).

### 5.2 Chip as the complete control (amendment 2)
- `button.chip` 32px visual, **44×44 hit area** via `::before { inset: -6px }`; `aria-label="Mark {title} done"`; `aria-pressed` reflects done. Tap/click toggles completion with a 5-second Undo toast. Long-press (500ms) or right-click opens the category picker instead.
- Keyboard: the pill is focusable (`tabindex=0`); **X** or **Space on the chip** toggles done; **Enter** opens the editor; the chip is also in the tab order after the pill. Screen reader announces "Morning run, done" / "not done".
- Motion: check draws 180ms; pill tone 250ms; no burst. Reduced motion: instant tone.
- Priority ring stays visible in the done state at 50% alpha.

### 5.3 Free-time connector
`button.free` spanning the gap: centred `border-left: 2px dotted var(--free-line)` from top+6 to bottom−6; label pill (`--free-label-bg`/`fg`, 13px/700, 26px tall, `--r-pill`) at the midpoint; "+" 24px surface circle at the right. Gaps ≥ 10 min render; < 30 min: "+" only. Hover `--free-hover-bg`; drop target: dots → accent, label → `--accent-tint`. `aria-label="1 hour 15 free from 07:45, add task"`.

### 5.4 Now line
2px accent across gutter + column; time pill (accent / white, 10px/800) in the gutter; `transform` update every 30 s with 300ms ease; `aria-hidden`, live text in the header.

### 5.5 Header fade
Fixed; `background: var(--header-fade)`; height 112px mobile (title 22/800 + stats 12/600 + date strip) / 72px desktop; padding-bottom 22px so the fade never clips a pill's text. No border, no shadow. Date strip: 7 pills, weekday 10px + number 13px; selected number in an accent circle 24px. Swipe the strip to change week; tap the title to open month.

### 5.6 Floating tab bar (iPhone)
Pill, 60px, blur 20px + saturate 1.4 over `--bar-bg` (80% canvas), `--bar-border`, `--shadow-bar`. Four tabs, each ≥ 60px wide × 60px tall: **Inbox** (count badge, accent pill 8px/700) · **Timeline** · **Week** · **Settings**. Icon 22px filled (active) / outlined (inactive) from the chrome set; label 10px/700; active colour accent, inactive ink-2 (both ≥ 4.5:1 on the bar's worst-case background — verified against a pill scrolled beneath at L 0.76: ink-2 0.50 vs 0.80-blend ≈ 4.6:1). **Reserved slot:** the bar's layout is a 5-column grid; column 4 is hidden (`display:none`) until the AI arc — when enabled it inserts **Plan** between Week and Settings with the same metrics; nothing else changes. Fallbacks: `prefers-reduced-transparency` / `prefers-contrast: more` → opaque `--bar-bg-opaque`, no blur.

### 5.7 FAB
56px accent circle, white "+" 28px/600, `--shadow-fab`, 16px from right/bottom + safe area, press `scale(.98)`. Opens quick-add as a bottom sheet with the keyboard up. On desktop there is no FAB.

### 5.8 Desktop segmented control
Floating pill, surface bg, 3px padding, `--shadow-bar`; items 34px tall, 12px/700; active = accent fill + white. Keyboard: ← → cycle; roving tabindex.

### 5.9 Inbox
Desktop rail rows: `--surface`, `--r-pill`, 48px, 26px chip (the chip here is **not** a complete control — tap opens the editor; completing from the inbox is a swipe or the editor), title 700, meta 13px, Place pill (`--accent-tint`/`--accent-ink`, 44px hit). Mobile: full-height tab under the same header fade; swipe-right = Place.

### 5.10 Quick-add
Pill 44px surface, leading "+" accent, parse-preview chips (44px) beneath. Auto-suggests an icon from the title (§6.4) and shows it as the first chip; tapping it opens the glyph picker.

### 5.11 Editor sheet
`--r-sheet` 28px, panel, `--shadow-sheet`, grabber 36×5 n-300; fields: title (24/800) · category (8 chips 40px in chip colour with the category's glyph) · icon (grid of glyphs, 44px cells, search) · duration chips · start · all-day · priority · repeat · subtasks · reminders · notes; Save = accent pill 48px; Delete = text danger. Completing early/late: "Adjust to actual (1:20)?" banner in accent-tint.

### 5.12 Week
Compact pills `--r-pill`, 11px/700, 16px chip at left; today's column `--accent-tint` at 40%; free rules for gaps ≥ 45 min. Header per day: "Sat 26" + "6h30 · 3h20 free".

### 5.13 Settings
Grouped list on panel cards (`--r-lg`), 48px rows, Nunito 15/400, values in ink-2; theme (system/light/dark), day bounds, default duration, snap, push-down, week start, 12/24h, reminders, focus length, export/import.

## 6. Iconography (amendment 3) — the optimo glyph set

### 6.1 Drawing rules
- Canvas 24×24, live area 20×20 (2px padding), keylines: 20 square / 22×18 landscape / 18×22 portrait / 20 circle. Whole-pixel alignment.
- **Filled silhouettes**, corner radius 2px on every outer corner, 1px on inner corners; strokes (where a line is needed inside a silhouette) are 2px with round caps.
- Exactly **one counter-cut** per glyph (a 1.5–2px negative-space detail: the laptop screen, the mug handle hole, the house door) so the shape reads at 13px inside a 22px chip. Never two.
- Optical centring: measure the silhouette's bounding box, centre it, then nudge asymmetric shapes (people, running figure) 0.5px toward the heavier side.
- Weight matches Nunito 700 at the same size. A glyph must survive at 13px white on the L 0.55 chip and at 22px on the tab bar.
- Familiar metaphors; no text inside glyphs; no arrows for activities.
- Two variants per chrome glyph (outline for inactive tabs at 1.75px stroke; filled for active). Activity glyphs are filled only.
- Original drawings in `src/icons/*.tsx` exporting `<svg viewBox="0 0 24 24" fill="currentColor">`. Never traced from SF Symbols, Material, Structured or any library; license note in `src/icons/README.md`.

### 6.2 Activity glyph list (64) — `group-name`
- **work (6):** work-laptop · work-monitor · work-document · work-briefcase · work-chart · work-inbox-tray
- **meetings (5):** meeting-people · meeting-video · meeting-phone · meeting-presentation · meeting-handshake
- **health/fitness (7):** fitness-dumbbell · fitness-run · fitness-yoga · fitness-bike · fitness-swim · fitness-heart · health-pill
- **food/drink (6):** food-coffee · food-plate · food-bowl · food-water · food-apple · food-wine
- **home/chores (6):** home-house · home-broom · home-laundry · home-tools · home-plant · home-trash
- **family (4):** family-heart-people · family-child · family-gift · family-cake
- **errands/transport (6):** errand-bag · errand-cart · errand-car · errand-bus · errand-package · errand-pin
- **learning (5):** learn-book · learn-graduation · learn-pencil · learn-code · learn-language
- **rest/sleep (4):** rest-bed · rest-moon · rest-sofa · rest-alarm
- **personal care (4):** care-shower · care-toothbrush · care-scissors · care-mirror
- **finance (3):** finance-wallet · finance-bank · finance-receipt
- **travel (3):** travel-plane · travel-suitcase · travel-train
- **pets (2):** pet-paw · pet-bone
- **creative (3):** creative-music · creative-camera · creative-palette
Plus **chrome (12):** ui-inbox · ui-timeline · ui-week · ui-settings · ui-plan (reserved) · ui-plus · ui-check · ui-chevron-left · ui-chevron-right · ui-close · ui-drag-handle · ui-search.

### 6.3 Chip rendering
Glyph 18px inside the 32px chip (13px inside 22px; 15px inside the 26px inbox chip; 22px on the tab bar). Colour `--chip-glyph-color` (white light / dark ink dark). The done state swaps the glyph for `ui-check`.

### 6.4 Keyword → icon auto-suggest (quick-add, `src/icons/suggest.ts`; lowercase, word-boundary match, first hit wins; category suggestion in brackets)
```
run|jog|5k|marathon → fitness-run [health]        gym|weights|lift|workout → fitness-dumbbell [health]
yoga|pilates|stretch → fitness-yoga [health]      bike|cycle|ride|peloton → fitness-bike [health]
swim|pool|laps → fitness-swim [health]            walk|hike|steps → fitness-run [health]
doctor|dentist|clinic|checkup → health-pill [health]  meds|vitamins|pill → health-pill [health]
coffee|espresso|latte|tea → food-coffee [personal] breakfast|lunch|dinner|brunch → food-plate [personal]
cook|meal prep|recipe → food-bowl [home]          water|hydrate → food-water [health]
snack|fruit → food-apple [personal]               drinks|wine|beer|bar|happy hour → food-wine [personal]
standup|stand-up|sync|huddle → meeting-people [meetings] 1:1|one-on-one|1-1|check-in → meeting-people [meetings]
meeting|meet with → meeting-people [meetings]     zoom|teams|call|video → meeting-video [meetings]
phone|ring|dial → meeting-phone [meetings]        present|presentation|demo|pitch → meeting-presentation [meetings]
interview|negotiat → meeting-handshake [meetings] email|inbox|reply|mail → work-inbox-tray [work]
deep work|focus|write|draft|doc|report|spec → work-document [work]  code|coding|pr|pull request|review|deploy|bug → learn-code [work]
plan|planning|roadmap|forecast|budget|analysis → work-chart [work]  laptop|slides|deck → work-laptop [work]
office|commute in → work-briefcase [work]         clean|tidy|vacuum|dishes → home-broom [home]
laundry|wash|fold → home-laundry [home]           fix|repair|assemble|drill|ikea → home-tools [home]
water plants|garden|plants|mow → home-plant [home] trash|bins|recycling → home-trash [home]
groceries|grocery|shopping|shop|store|costco|target → errand-cart [errands]  pick up|pickup|drop off|collect → errand-bag [errands]
car|oil change|registration|dmv|gas → errand-car [errands]  bus|transit → errand-bus [errands]
package|amazon|return|post office|ship → errand-package [errands]  errand|appointment|visit → errand-pin [errands]
read|book|chapter|kindle → learn-book [learning]  study|course|class|lecture|exam → learn-graduation [learning]
notes|journal|homework|practice → learn-pencil [learning]  learn|tutorial|lesson|duolingo|spanish|french → learn-language [learning]
sleep|bed|nap → rest-bed [rest]                   wind down|night|evening routine → rest-moon [rest]
relax|tv|movie|netflix|chill → rest-sofa [rest]   wake|alarm|morning routine|rise → rest-alarm [rest]
shower|bath → care-shower [personal care]         teeth|brush|floss → care-toothbrush [personal care]
haircut|barber|salon|nails → care-scissors [personal care]  skincare|makeup|get ready → care-mirror [personal care]
pay|bills|rent|mortgage → finance-receipt [finance]  bank|transfer|invoice|taxes|ynab → finance-bank [finance]
wallet|expenses|receipts|cash → finance-wallet [finance]  flight|fly|airport|book flights → travel-plane [travel]
pack|packing|hotel|trip|vacation → travel-suitcase [travel]  train|amtrak|station → travel-train [travel]
dog|cat|vet|pet → pet-paw [pets]                  feed|treat|kibble → pet-bone [pets]
guitar|piano|music|band|sing|practice guitar → creative-music [creative]  photo|camera|shoot|edit photos → creative-camera [creative]
paint|draw|sketch|design|art → creative-palette [creative]  kids|school run|daycare|soccer|noah → family-child [family]
family|mom|dad|parents|wife|husband|date night → family-heart-people [family]  birthday|party|cake → family-cake [family]
gift|present for|wrap → family-gift [family]      (no match) → category's default glyph; category default falls back to work-document
```
The map is data (`Array<[RegExp, iconName, categorySlug]>`); user overrides (choosing a different icon for a title) are learned into `planner_settings.data.iconOverrides[titleStem]`.

## 7. Motion
| Interaction | Duration | Easing | Moves |
|---|---|---|---|
| Hover / press | 120ms | ease | tone; press `scale(.98)` |
| Chip complete | 180ms check draw + 250ms tone | `--ease-decel` | glyph cross-fade, pill tone |
| Pill appears | 250ms | `--ease-emph-decel` | `translateY(6px)→0`, opacity |
| Reflow | 300ms | `--ease-standard` | transform |
| Drag lift / settle | 120ms / 350ms | ease / `--ease-emph-decel` | scale, shadow / transform, no overshoot |
| Resize commit | 150ms | standard | height snap |
| Sheet open / close | 400 / 260ms | `--ease-drawer` / `--ease-accel` | translateY; scrim 200ms |
| Tab switch | 200ms | standard | icon outline→filled cross-fade; content dissolve |
| Header fade on scroll | continuous | — | stats line collapses (opacity) after 40px scroll; title stays |
| Tab bar on drag | 200ms | standard | bar drops 8px + 0.6 opacity while a pill is dragged near it, so the drop target beneath is visible |
| Elapsed sweep | every 30 s | linear 300ms | width |
| Now line | 300ms | standard | transform |
Reduced motion: transforms off, reflow 0ms, tone ≤ 160ms, sheet dissolves, tab bar does not drop (it becomes opaque instead).

## 8. Dark mode
Canvas warm charcoal `oklch(0.21 0.012 40)`; pills L 0.40 (0.8C) with pale text L 0.93; chips L 0.74 with dark glyph; accent `oklch(0.78 0.11 30)` with dark text; bars 78% canvas + blur; pills gain the 1px inset ring; header fade uses the dark canvas; shadows black 0.6–0.8.

## 9. Data visualisation
Summary bars: accent (planned) / `--free-line` (free) / success (done), 8px pills. Month dots and charts use the **chip** colours (L 0.55 light / 0.74 dark) in order 1→8; never pill fills for data.

## 10. Imagery
None. Empty states: one 40px chip with the relevant glyph + a line of copy.

## 11. Microcopy
Short, warm, no exclamation marks. "Placed at 13:00." · "Couldn't sync — will retry." · "Nothing waiting — enjoy the space." · "A clear day." · Undo toast 5 s for complete / move / resize / delete. Confirm only for series delete.

## 12. Accessibility

| Pair | Light | Dark |
|---|---|---|
| ink on canvas | 0.27 on 0.975 ≈ 12.5:1 | 0.94 on 0.21 ≈ 13:1 |
| ink-2 on canvas | 0.50 ≈ 5.6:1 | 0.74 ≈ 6.4:1 |
| ink-3 (hour numerals 12px/600) | 0.60 ≈ 4.5:1 | 0.62 ≈ 4.6:1 |
| pill text on pill (all 8) | 0.28 on 0.76 ≈ 8.1–8.9:1 | 0.93 on 0.40 ≈ 7.3–7.7:1 |
| white glyph on chip (all 8) | on 0.55 ≈ 4.6–4.8:1 | — |
| dark glyph 0.22 on chip 0.74 | — | ≈ 6.8–7.2:1 |
| white on accent | 0.55 → 4.8:1 | ink 0.22 on 0.78 ≈ 8.4:1 |
| accent-ink on accent-tint | 0.40 on 0.93 ≈ 7:1 | 0.88 on 0.32 ≈ 8:1 |
| free label | 0.32 on 0.93 ≈ 8.5:1 | 0.88 on 0.32 ≈ 8:1 |
| done text on done fill | 0.55 on 0.93 ≈ 4.6:1 | 0.62 on 0.27 ≈ 5.4:1 |
| tab label (active accent / inactive ink-2) over bar | ≥ 4.6:1 worst case | ≥ 5:1 |
| free rule (decorative) | 0.80 vs canvas ≈ 2.6:1 | 0.45 vs 0.21 ≈ 2.8:1 |
Ratios computed from OKLCH lightness (Y ≈ L³) and verified against the tint/ink recipe in `bright-ui-guidance.md`; the build asserts them with `culori` in `tests/unit/contrast.test.ts`.
Keyboard map: N new · / quick-add · ↑↓ select · Shift+↑↓ nudge 5 min · Alt+↑↓ resize 5 min · X done · Enter edit · Delete · I inbox · W week · Esc. Targets ≥ 44px: chip (padded), free label, Place, tabs (60px), FAB (56px). Colour never the only cue: category = hue + glyph + name; done = check glyph + strike + tone + `aria-pressed`; running = sweep + now line + "now" text in the accessible name. Bars fall back to opaque under reduced-transparency / increase-contrast; blur never sits over text that must be read (the header fade is solid where text sits).

## 13. Originality statement — this design vs Structured
optimo's block is a **full-width pastel pill with the icon chip inside its left end and the title on the pill**; Structured's is a coloured circle on a vertical spine with the title beside it on white. optimo's free time is a **dotted rule with a duration pill and a "+"**, not a dashed spine with prompt copy. There is **no circular progress fill** — the running state is a horizontal tone-sweep across the pill. The now indicator is a line with a time pill. The week view is compact pills, not icon stacks. The glyph set is drawn in-repo to the rules in §6 (filled, 2px radius, single counter-cut), not Structured's library; the keyword map is original. The palette is an original OKLCH set (slate 250 · salmon 30 · sage 140 · peach 60 · powder 220 · lilac 300 · rose 355 · sand 80, L 0.76 / chips 0.55) on a blush canvas — the pastel *register* Mark asked for, no sampled values. The floating pill tab bar + separate FAB and the faded header are generic iOS-era chrome (Apple Liquid Glass, Google, many apps) and are implemented with our own metrics, tab set (Inbox · Timeline · Week · Settings) and an unused reserved slot; the accent is dusty coral, not Structured's pink, and no Structured naming, copy or illustrations appear.

**Essence.** Soft chalk pills on blush paper, a white glyph in every bubble, and the day flowing under floating glass to the bottom of the screen.
