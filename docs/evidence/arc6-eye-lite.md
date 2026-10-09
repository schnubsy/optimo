# Arc 6 — Eye LITE match/delta review (2026-10-09)

Mockups: `docs/design/2026-10-09-mockups/01–10` + `mockups.md`. Build captures: `docs/evidence/arc6-eye-NN-*-{dark,light}.png`
(402×874 @3×). Measurement: CSS px = image px ÷ 3, about ±2 px. The mockups have the status bar cropped off the top
(about 822 CSS tall vs 874), so y is measured from the top and bottom-anchored elements are measured from the bottom.
06 is a 1105 px crop, so its x offset (about +21 CSS) is estimated from the ring position (±3 px).
Tag **[sheet≠image]** = the build follows `mockups.md` but the image (which wins) measures differently.

## Verdict

The structure is right. Every one of the ten states exists with the mockup's grammar, and the anchor geometry is
accurate: spine x 78 (built 77.8), ring x 362 (361.8), 56 px disc (55.5), 180 px capsule for 90 min (180), 131 px
header (131), strip discs and columns, 76×52 active tab pill, 200×43 wheel pill, 58 px peek gap. Light mode mirrors dark in all ten states and stays
legible. The real problems are in the overlays and the week view. (1) The ② time wheel does not skip the booked span
(rows after the pill read 8:15/8:30, not 9:45/10:00). (2) The duration sheet is short, floats 72 px above the bottom,
and its scrim leaves the header and a bottom strip undimmed. (3) Backdrop blur is missing, so text behind the popover
and the sheet shows through and collides with the menu text. (4) Week rail labels overflow and hide under the Monday
discs, which are 48 px against 40 in the image. (5) The collapsed peek row keeps full-screen x positions inside the
inset card. (6) The ③ capsule and stub sit about 11 px left and run through the X disc. Below that, there is one
systematic polish issue: text throughout the day spine and the wizard is about 15–20 % larger than the image (the
sheet's type sizes are overstated), so the build reads chunkier than the mockups.

## Per-mockup

| # | state | dark | light | verdict | deltas |
|---|---|---|---|---|---|
| 01 | Day empty | arc6-eye-01-…-dark | …-light | match | P1 1, 3, 4, 5, 6, 7, 8, 9, 11 |
| 02 | New task ② when | arc6-eye-02-…-dark | …-light | **delta** | **P0 1, 7**; P1 2, 15, 20, 21 |
| 03 | Duration sheet | arc6-eye-03-…-dark | …-light | **delta** | **P0 2, 3**; P1 23 |
| 04 | New task ① title | arc6-eye-04-…-dark | …-light | match | P1 2, 14, 15, 16, 17, 18, 19 |
| 05 | Time ••• menu | arc6-eye-05-…-dark | …-light | **delta** | **P0 3**; P1 2, 22 |
| 06 | New task ③ details | arc6-eye-06-…-dark | …-light | **delta** | **P0 6**; P1 15, 19, 24–27 |
| 07 | Inbox empty | arc6-eye-07-…-dark | …-light | match | P1 12, 13, 30 |
| 08 | Day with block | arc6-eye-08-…-dark | …-light | match | P1 1, 3, 4, 7, 8 |
| 09 | Day done | arc6-eye-09-…-dark | …-light | match | P1 10 (+ as 08) |
| 10 | Week overview | arc6-eye-10-…-dark | …-light | **delta** | **P0 4, 5**; P1 28, 29 |
| all | tab bar / FAB | — | — | risk | **P0 8** (on device only); P1 11 |

## P0 — fix before arc close

1. **② wheel rows ignore the duration.** The mockup shows 7:30 · 7:45 · [8:00–9:30 PM] · 9:45 · 10:00, so rows
   below the pill continue from the end time. The build shows 8:15 · 8:30 · 8:45. Fix: rows after the selected one
   start at `end + snap`, and scrolling still moves the start. `src/editor/` wheel + `wizard.css`.
2. **03 duration sheet geometry and scrim.** Sheet top: 399 built vs 349 in the image. Bottom: 72 px above the
   screen edge vs about 6. Height: 404 vs 467 (only ±2 wheel rows visible vs ±3). The scrim does not cover the editor
   header (teal stays full strength; the image darkens it), and it stops at y 809, leaving an undimmed 65 px strip
   (a white band in light mode). Fix: sheet `bottom: 6px; left/right: 8px`, height about 467; the scrim is
   `position: fixed; inset: 0` above the header. `src/editor/sheet.css`.
3. **No backdrop blur on the overlays (03, 05).** The image frosts everything behind the overlay. In the build the
   wheel text shows through crisply: "Add to Inbox" sits over "8:15 PM", "8:00–9:30 PM" ghosts behind the menu, and
   the "3" hour row lands on a ghost "Duration". Fix: `backdrop-filter` / `-webkit-backdrop-filter: blur(24px)
   saturate(1.4)` on `.popover` and `.sheet`, plus an opaque `--card` fallback under
   `@supports not (backdrop-filter: blur(1px))`. `sheet.css` / `wizard.css`.
4. **Week rail labels collide with the discs (10).** Labels are 13/700 + 9 px sup, so "11AM" is 29 px wide in a
   22 px rail, and "10A", "2PM", "11P" are cut off under the Monday column. The image reads about 10 px + 7 px sup
   ("11AM" about 19 px), with discs at **40 px** (48 built) and 12 px gaps between columns (4 built). Fix:
   `--node-size-week: 40px`; rail `b` at about 10px with a 7px sup, so labels end before x 24. `src/chrome/panel.css`, `tokens.css`.
5. **Collapsed peek row keeps full-screen x positions (10).** Image vs build: disc centre 68 vs 78, text 108 vs 119,
   ring 343 vs 362. The built ring is 20 px from the card edge instead of 39. Fix: under `.psheet[data-detent='week']`,
   shift `--sx` by −10 and the text column by −11, and set `--rx` to about 52 (ring 39 px inside the 20 px-margin
   card). Animate between detents. `panel.css`.
6. **③ header capsule is offset left (06).** Capsule left edge 16 vs about 30 (centre 58 vs about 69, the same x as
   the ② chip). Title column 112 vs about 122. The dashed stub runs through the X disc's right edge (X spans 16–60).
   Fix: capsule left = ② chip left (30), title column 122. `src/editor/wizard.css`.
7. **② duration quick-row unselected numerals are the wrong colour.** The image uses grey `--ink-3` on the tint
   (02, 05); the build uses accent coral (`--accent-on-tint`). The selected 58×44 pill is correct. Fix: unselected
   chip text `--ink-3`. `wizard.css`.
8. **Tab bar and FAB bottom inset on device (all tab screens).** The CSS sets `16px + env(safe-area-inset-bottom)`,
   which is 50 px on an iPhone. The real-device mockups put the bar about 22 px above the screen edge, sitting over
   the home-indicator zone. The capture cannot show this because its safe area is 0. Verify on device, then fix with
   `bottom: max(16px, calc(env(safe-area-inset-bottom) - 12px))` for both. `src/chrome/tabbar.css`.

## P1 — snags (one GitHub `snag` issue each)

1. [sheet≠image] Day spine type about 15–20 % large: row title 22/700 vs about 19–20/600, meta 15 vs about 13–14, gutter 14 vs about 12–13, gap sentence 17 vs about 14–15, Add Task 15 vs about 13 (tokens `--type-row-title/-meta/-body`, spine.css).
2. [sheet≠image] Wizard type about 15–20 % large: header title 28 (cap 21 px) vs about 24 (cap 17), card rows 20 vs about 17, wheel rows 20 vs about 17, popover rows 20 vs about 17, suggestion rows (wizard.css).
3. [sheet≠image] Short rows use a 72 px minimum, so disc-to-disc spacing is +16 px per row: Up→Lights out 192 vs 173 (01); capsule end→moon centre 156 vs 125 (08).
4. When "now" is before the first node, the marker adds a 40 px lead (Up centre y 218 vs 179). Overlay the marker at the panel top instead.
5. [sheet≠image] Panel side margin 7 px vs about 1 px in the image (`--panel-margin`, panel.css).
6. Sheet grabber top 12 px vs about 6 px in the image (panel.css `.psheet-grab i`).
7. [sheet≠image] Strip mini-chips are `--node` discs with coloured glyphs; the image shows category-filled discs with white glyphs (header.css `.hdr-chip`).
8. Strip and week start on Monday (Mon 5–Sun 11); mockups start on Sunday (Sun 4–Sat 10). Confirm the `week_start` setting.
9. Header sync dot at the far right is not in the mockup. Hide it when synced, or accept it.
10. Done-ring check glyph about 9 px vs 12–13 px in the image (spine.css `.ring`).
11. [sheet≠image] Tab bar left inset 16 vs about 20; FAB 58 vs about 61 with right inset 16 vs about 20.
12. Inbox tray art is 92 px wide vs 110. The glyph fills about 20/24 of its box, so scale the box to about 132 (tabbar.css `.inbox-tray`).
13. New Inbox Task pill: ⊕ 15 vs 20 px; pill 233 vs 206 wide; label reads lighter than the image's semibold.
14. Nunito Sans 600 reads lighter than SF semibold in list titles and pill labels; consider 700 for `--type-list-title` and `.inbox-new`.
15. [sheet≠image] Icon chip and ③ capsule 84 vs about 78 outer; ••• disc 32 vs about 26; ② date row 56 vs about 51 tall; ③ rows 56 vs about 52.
16. ① create-mode title underline runs to x 382 vs 339. Stop it at the ring column as in ②.
17. ① Continue is disabled on an empty title (the mockup shows it enabled). In light mode the disabled label is white on pale pink and hard to read.
18. ① Suggestions label and card sit 9–11 px low (218/240 vs 209/229).
19. List separators run to the card edges; the image insets them to the text column (x 72) and 16 px from the right (① suggestions, ③ rows card).
20. ② wheel has no drum compression on the ±2/±3 rows (the image squashes them); row pitch 32 vs about 29.
21. ② vertical drift adds up: Duration title y 608 vs 589 (+19), from the date row height and the Time section spacing.
22. 05 popover: the first-row highlight is a square band whose corners poke past the 22 px radius, and the ••• disc ghosts through at top-right.
23. 03 selected preset ("1h 30m") is in accent text; the image highlights no preset.
24. ③ the capsule's white ring is drawn over the palette disc (the image has the disc on top); the palette glyph reads as a white blob.
25. ③ the spine stub below the capsule is dashed with nothing after it; the image shows a solid stub with the next node peeking.
26. ③ Repeat chip 133×48 vs about 180×43; gap to the subtasks card 17 vs about 31.
27. ③ Notes textarea shows a resize grip (`resize: none`).
28. [sheet≠image] Week past-day blue fill is lighter and more cyan than the image (L 0.78 per the sheet vs about 0.66). The hue is decided; the lightness is not.
29. Week rail runs to 11 PM (day_end 10:30 rounded out) vs the image ending at 10 PM with the moon below. This follows the sheet; accept it or clamp.
30. Inbox title baseline y 28 vs about 33.

## Decided deviations (not deltas)

- **Glyph artwork drawn in-repo:** sofa for "movie" (image: TV), tray, spine-list, gear, four-point sparkle, the 3×2 dot grid, filled calendar, document default icon, timer, bell, palette, AI-subtask sparkle (image: flower).
- **Our copy:** bookends "Up" / "Lights out", free-time sentences ("13h 29m wide open.", "1h free — want to fit something in?"), suggestion seeds (Answer emails · Walk · Groceries · Movie night · Run), placeholders "What's next?" and "Add notes, links or a number to call…", sentence-case task titles.
- **Accessibility layer:** dark ink on coral (FAB +, Continue, Create Task, wheel pill, 1.5h chip, done check); `--ink-3` lifted to L 0.68; lighter accent text on the tint; wizard header at L 0.55, so the coral and teal headers read darker than #C67D76 / #5B7EA8.
- **Category hues unchanged:** blue reads teal (header, ring, moon glyph, week fills).
- **Nunito Sans** instead of SF Pro (this includes the duration-wheel numerals, which are not monospace) and the **12 h clock**.
- **Week rail linear at 36 px/h:** the Friday movie is a 54 px capsule vs 125 in the uneven image rail; labels are evenly spaced.
- **Collapsed sheet side margin 20 px** (aligned with the tab bar's left edge); built peek card 20→382, matching the image.
- **Light mode** is a structural mirror (warm white canvas, white panel). All ten captures have parity and are legible, apart from P0 2's white strip and P1 17.

## Slice 9b — P0 status (Code, 2026-10-09): **0 P0 open**

| P0 | fix | guard |
|---|---|---|
| 1 wheel rows below the pill | rows after the selected start read `start + duration` onward (`TimeWheel.tsx`) | `eye-p0.spec.ts` P0-1/7 |
| 2 duration sheet geometry + scrim | `.dur-wrap` is `position: fixed; inset: 0` (covers the header), sheet 6 px off the bottom, wheels ±3 rows (228 px) | P0-2/3 |
| 3 text showing through overlays | the sheet and the ••• menu are opaque `--card`; the frost moved to the scrim (blur 3 px); menu clips its rows | P0-2/3 + recaptures 03 / 05 |
| 4 week rail vs discs | `--node-size-week: 40px`; rail labels 10 px + 7 px superscript inside the 22 px gutter | P0-4/5 |
| 5 peek row positions | collapsed sheet: `--sx 61 / --tx 101 / --rx 52` (screen: disc 68, text 108, ring 343) | P0-4/5 |
| 6 ③ capsule offset | the ③ header row starts at 30 px like ② (stub clear of the X) | recapture 06 |
| 7 grey duration presets | `--ink-on-tint-muted` (the mockup grey lifted to 5.2:1 dark / 5.3:1 light, culori-tested) | P0-1/7 |
| 8 bar + FAB on device | `bottom: max(16px, env(safe-area-inset-bottom) − 12px)` → ~22 px on a home-indicator iPhone, 16 px elsewhere | Mark's on-device check (HANDOFF) |

The captures were re-taken after the fixes (`docs/evidence/arc6-eye-*-{dark,light}.png`). The P1 list above is filed
as GitHub `snag` issues (numbers in HANDOFF). Lighthouse (gauntlet, built page): see the slice-9 gauntlet JSON.
