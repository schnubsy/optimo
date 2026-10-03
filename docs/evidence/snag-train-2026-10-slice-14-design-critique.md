# Snag train 2026-10 · slice 14: Eye design critique (LITE)

**Scope.** This reviews the snag-train evidence for slices 1–13 (`docs/evidence/snag-train-2026-10-slice-*.png`). Each slice closes one snag from `arc2-slice-7-design-critique.md` (A2-P1-1 … A2-P1-13 = schnubsy/optimo#15–#27). Each is judged against that snag's done-criteria and the ratified FINAL design (`docs/design/2026-09-27-final/spec.md`, `src/styles/tokens.css`). It is a critique only. No new directions are proposed, and no ratified decision is re-opened. Code was read where a capture alone was ambiguous: `EventBlock.tsx`, `PushSettings.tsx`, `CalendarSettings.tsx`, `app.css`, `sheet.css`, `brand.svg`, `make-icons.ts`, `build-press.mjs`.
**Accepted as intended (not findings):** sharp text under the floating tab bar in the Playwright-WebKit iPhone captures. This was A2-P0-3, closed as a headless-compositing artefact, and the computed `backdrop-filter` is asserted in `review2.spec.ts`. Also accepted: data differences between fixtures (iCloud events appear only in the slice-4/5 fixture).
**Severity:** 🔴 P0 = must fix this slice (a real defect or regression, or an originality breach) · 🟡 P1 / P2 = new GitHub issue labelled `snag` (do not fix here) · 🟢 = fine. Size S = under half a day, M = around a day.

**Verdict.** Eleven of the thirteen snags are resolved as specified, and the visual language holds in both themes. Two fixes fall short in the arc's own evidence:
- **#19:** the new mobile event sheet renders *beneath* the floating tab bar and FAB. It is trapped in the event's stacking context.
- **#20:** the `<legend>` → `<h3>` fix missed the two Settings groups rendered by other components, Reminders and Calendars. "Reminders" still straddles its card edge in the slice-7 capture.

Both are one-file fixes. The brand mark has left the red-squircle register, so no originality concern against Structured remains. Its chip still has a toggle-knob reading, which goes to a P1.

---

## Per-slice verdicts

| Slice | Snag | Evidence | Verdict |
|---|---|---|---|
| 1 | #15 now pill vs hour numeral (A2-P1-1) | `slice-1-day-{desktop,iphone-15}.png`, `slice-10-day-desktop-dark.png` | 🟢 Resolved. At 15:04 the "15:00" numeral is gone and the flag reads cleanly. At 16:12 (12 min out) the numeral returns with no collision. |
| 2 | #16 ui-week / ui-timeline misread (A2-P1-2) | `slice-2-icons.png`, `slice-2-tabbar-iphone-15.png` | 🟢 Resolved. ui-week is now a calendar frame with a solid header band joining three columns, so it no longer reads "000". ui-timeline is a chip dot plus two offset pills, echoing the block. The outline variants read at 22px. |
| 3 | #17 activity glyph legibility (A2-P1-3) | `slice-3-icons.png` | 🟢 Resolved. food-plate is now a plate with a cutlery counter-cut (no "IOI"). care-mirror is an oval on a stand, clearly distinct from errand-pin. family-heart-people is two figures. Residual: handshake (ST-P2-3). |
| 4 | #18 iCloud chip glyph + ring (A2-P1-4) | `slice-4-timeline-{desktop,iphone-15}.png` | 🟢 Resolved. New `ui-calendar` glyph (frame with a date-cell cut). Ring = `--evt-color` with a `--line-strong` fallback (`app.css:414`). The blue in the capture is the fixture calendar's own colour, which is allowed. |
| 5 | #19 event details on iPhone (A2-P1-5) | `slice-5-event-sheet-iphone-15.png` | 🔴 **Not resolved: ST-P0-1.** The sheet and scrim exist, but the tab bar and FAB paint over the sheet. The scrim does not dim them. "Dentist check-up · 10:30–11:15 · Harbour St Dental" is overprinted by Inbox / Timeline, and the close button is unreachable. |
| 6 | #20 Settings group labels straddle the card (A2-P1-6) | `slice-6-settings-iphone-15.png`, `slice-7-settings-bottom-iphone-15.png` | 🔴 **Partly resolved: ST-P0-2.** Theme / Day starts / Organise / Data now sit inside their cards. "Reminders" still sits on the card's top edge, and so will "Calendars" when present. |
| 7 | #21 Settings bottom scroll pad (A2-P1-7) | `slice-7-settings-bottom-iphone-15.png` | 🟢 Resolved. "build 39ea9d5" clears the floating bar with room to spare. `.page` now scrolls. |
| 8 | #22 Week edges (A2-P1-8) | `slice-8-week-{iphone-15,desktop}.png` | 🟢 Resolved. iPhone snaps cleanly to a whole day (Thu 1), with no sliver. The desktop body has its right pad. Residual: the header row is unpadded (ST-P2-4). |
| 9 | #23 quick-add 44px targets (A2-P1-9) | `slice-9-quickadd-iphone-15.png` | 🟢 Resolved for the only interactive control, the glyph chip (about 43–44pt). The parse chips are non-interactive confirmations at about 28pt, still short of the §5.10 visual height (ST-P2-2). |
| 10 | #24 evidence gap (A2-P1-10) | `slice-10-*` (9 captures) | 🟢 Resolved. Week / Inbox / Month / editor on iPhone in light and dark, plus desktop day dark, are all present. Two captures look raced (ST-P1-3), and the inbox capture surfaced ST-P1-1. |
| 11 | #25 launcher card font + dark (A2-P1-11) | `slice-11-launcher-card-*-{light,dark}.png` | 🟢 Resolved. The dark variant uses the Meadow dark canvas / surface / accent, and the heading stack is `ui-rounded, "SF Pro Rounded", …` at 800. Note 1: headless engines fall back to the grotesk, so the rounded face needs an on-device check. Note 2: these captures predate slice 12 and still show the **retired** mark (see the brand section). |
| 12 | #26 brand mark originality (A2-P1-12) | `slice-12-brand-mark.png`, `src/icons/brand.svg`, `public/icons/*` | 🟢 Originality resolved, but the chip identity is not fully landed (ST-P1-2). See the dedicated section. |
| 13 | #27 elapsed sweep trailing edge (A2-P1-13) | `slice-13-running-pill-{desktop,iphone-15}.png` | 🟢 Resolved. The sweep keeps the pill's rounded start and ends in a flat vertical edge at elapsed % (14:30 of 14:00–15:30 = ⅓, measured). It reads as progress, not a nested block. Residual: the now line through the title (ST-P2-1). |

---

## 🔴 P0: fix this slice

| ID | Finding | Evidence | Fix | Size |
|---|---|---|---|---|
| **ST-P0-1** | **The mobile event-details sheet renders under the floating tab bar and FAB.** `.sheet-wrap` (fixed, z 40) is rendered *inside* `.evt`, which is `position: absolute; z-index: 25` (`app.css:408–409`). That creates a stacking context, so the sheet's z-index only competes inside it. At root level the whole thing sits at 25, below `.tabbar` / `.fab` (30, `app.css:345,357`) and above `.hdr` (20), which is why the header dims and the bar does not. The details text is overprinted, and the bar intercepts taps meant for the sheet. #19's done-criteria (a dismissible sheet that isn't covered) fails. | `snag-train-2026-10-slice-5-event-sheet-iphone-15.png` | `src/timeline/EventBlock.tsx`: `import { createPortal } from 'react-dom'` and wrap the mobile branch, `{open && mobile && createPortal(<div className="sheet-wrap" …>…</div>, document.body)}`. React synthetic events still bubble to `.evt`'s `stopPropagation`, so tap-through is unchanged. Add a Playwright check (iPhone 15): with the sheet open, `document.elementFromPoint(centre of .tabbar)` must be inside `.sheet-wrap`. Re-shoot `slice-5-event-sheet-iphone-15.png`. | S |
| **ST-P0-2** | **The "Reminders" (and "Calendars") group labels still straddle the card edge on iPhone.** Slice 6 converted the groups in `Settings.tsx` to `<h3>` + `aria-labelledby`. The Reminders and Calendars fieldsets are rendered by `PushSettings.tsx:34` and `CalendarSettings.tsx:55`, and both still use `<legend>`. WebKit places that over the border box (the reason the slice-6 fix exists). #20's done-criteria fails in the arc's own capture. | `snag-train-2026-10-slice-7-settings-bottom-iphone-15.png` ("Reminders" sits on the card's top edge) | `src/push/PushSettings.tsx`: `<fieldset className="set-row" aria-labelledby="set-reminders-label" …>` + `<h3 id="set-reminders-label">Reminders</h3>` (drop the `<legend>`). `src/calendar/CalendarSettings.tsx`: `aria-labelledby="set-calendars-label"` + `<h3 id="set-calendars-label">Calendars</h3>`. The CSS at `app.css:302` already styles `.settings h3`. Extend the #20 test to assert there is no `legend` under `.settings`, and that every `.set-row > h3` top is ≥ its card's top + 8px on iPhone 15. | S |

## 🟡 P1 / P2: new snags (GitHub issues, label `snag`)

| ID | Finding | Evidence | Fix | Size |
|---|---|---|---|---|
| **ST-P1-1** | Inbox (iPhone): the rail footer hint ("Drag onto the board, or **Place**: … Drag a block here to unschedule.") sits under the floating tab bar. Its copy is also desktop-only: mobile uses swipe-right = Place (spec §5.9). | `slice-10-inbox-iphone-15-{light,dark}.png` | `app.css`: `.is-mobile .backlog .ft { display: none; }`. Mobile Place is the row's pill plus swipe, so nothing is lost. | S |
| **ST-P1-2** | Brand mark: the chip still reads as a toggle knob. It is a white disc, larger than the pill's height, sitting at the end of a coral track. Its outer edge also vanishes on the blush ground (white on `#fff4f2` ≈ 1.07:1), so small sizes show a "bitten" capsule with a floating dot. | `slice-12-brand-mark.png`, `public/icons/maskable-512.png`, `apple-touch-icon.png` | `src/icons/brand.svg`: move the chip *inside* the top pill, the way the product's block does it. Use a darker coral chip disc (`#8f3a2e`, r = 3.2, inset 1.5 from the pill's left end, fully within the pill height) with a single white glyph counter-cut, e.g. a 2-unit tick. Drop the white disc. Leave a 1.5-unit gap between the two pills (currently they touch at y = 20). Keep the blush ground and the sage dot. Re-run `scripts/make-icons.ts` and `npm run build:press`. | S |
| **ST-P1-3** | Evidence race: Month (light) shows no category dots on Fri 2, while Month (dark) shows 4 dots + "+6" on the same data. The editor's Category row is empty in both themes, though §5.11 calls for 8 category chips. Either the captures fire before `useCategories()` / the month live query resolve, or the row really flashes empty on open (40px layout shift). | `slice-10-month-iphone-15-light.png` vs `-dark.png`; `slice-10-editor-iphone-15-{light,dark}.png` | Capture spec: wait for `[data-testid=sheet-category] button` and `.mday.today .dots i` before each shot. If the flash is real, pass Planner's already-resolved `cats` into `TaskSheet` instead of a fresh `useCategories()` (`src/editor/TaskSheet.tsx:119`). | S |
| **ST-P2-1** | The now line (z 6) strikes through the running pill's title when now crosses the text row ("Write the migration plan" at 14:30). | `slice-13-running-pill-iphone-15.png`, `-desktop.png` | `app.css`: `.pill .title, .pill .meta { text-shadow: 0 0 2px var(--pill-bg), 0 0 2px var(--pill-bg); }` so the line breaks around glyphs. Or stop the line at the pill edges when a running pill spans it, since the flat sweep edge already marks now inside the pill. | S |
| **ST-P2-2** | Quick-add parse-preview chips are about 28pt tall. Spec §5.10 says 44px. They are non-interactive, so this is visual only. The bottom chip row also sat on the viewport edge in the capture (possibly mid `sheet-up` animation). | `slice-9-quickadd-iphone-15.png` | `app.css`: `.qa-sheet .parse > span { min-height: 44px; display: inline-flex; align-items: center; }`. Or amend spec §5.10 to 32px for non-interactive chips. Re-shoot after `animationend`. | S |
| **ST-P2-3** | `meeting-handshake` (redrawn) reads as a bow tie or sunglasses at 13/18px: two lobes and a band, with nothing hand-like. | `slice-3-icons.png` | `src/icons/set.ts`: tilt the clasp 20° and replace the band with one diagonal finger counter-cut across the join (§6.1 one counter-cut). Re-run `scripts/icon-sheet.ts`. | S |
| **ST-P2-4** | Week (desktop): the body has its new right pad but the day-header row doesn't, so "Sun 4 · 16h00 free" runs to about 10px from the window edge, past the grid. | `slice-8-week-desktop.png` | `app.css`: `.is-desktop .whead { padding-right: var(--sp-4); }` | S |
| **ST-P2-5** | Month (iPhone): the "Oct 2026" title starts at the 8pt month padding while the header above uses the 16pt gutter. The ‹ › buttons are surface on blush with no edge and almost disappear in light. | `slice-10-month-iphone-15-light.png` | `app.css`: `.is-mobile .mhead { padding-inline: var(--sp-2); }` (8 + 8 = 16pt) and `.mhead .nav { box-shadow: inset 0 0 0 1px var(--line); }` | S |
| **ST-P2-6** | Toasts (z 60) sit on top of open bottom sheets and cover their close control ("iCloud calendar connected." over the event sheet's ×). | `slice-5-event-sheet-iphone-15.png` | `app.css`: `.toast-wrap { z-index: 35; }` (above the bar at 30, under sheets at 40). Toasts raised *by* a sheet action fire after it closes, per the Undo pattern. | S |

## 🟢 Fine / praise

- **ST-G-1 Pill system intact across all 13 slices.** In light: pastel fills, same-hue ink titles, dusty chips with white glyphs. In dark: L 0.40 pills, bright chips with dark glyphs, the inset ring. No regressions from the train.
- **ST-G-2 Elapsed tone-sweep now matches spec §1 exactly.** It has a flat trailing edge and an accurate width. Together with the now flag, it is the clearest "you are here" in the app.
- **ST-G-3 Chrome glyphs finally read.** Calendar-frame Week, block-echo Timeline, and the new `ui-calendar` stop the "pause / III" confusion everywhere (tab bar, event chip, icon sheet).
- **ST-G-4 iCloud events are unmistakably foreign.** Outlined pill, calendar chip, ring in the calendar's own colour with a `--line-strong` fallback. Nothing borrows a category hue.
- **ST-G-5 Settings is now a proper grouped list** (§5.13). Labels sit inside the panel cards for Theme / Day bounds / Organise / Data, and the page scrolls clear of the floating bar.
- **ST-G-6 Week on iPhone snaps a whole day** under the hour rail, with today's column in accent-tint and the "plan · free" headers intact.
- **ST-G-7 Dark theme coverage.** Desktop day, week, inbox, month and editor all hold the Meadow dark palette: today ring, month dots with the done ring, and the coral FAB in dark with dark "+".
- **ST-G-8 Launcher card** now speaks optimo: an 800 rounded-stack heading, coral em-dash accent, Meadow dark variant, quiet "Family Wing" footer.
- **ST-G-9 Originality overall holds.** Pill-with-chip blocks, no vertical spine, no circular progress, tone-sweep running state, dusty-coral accent, own tab set, own glyphs, and a brand mark off the red squircle.

---

## Brand-mark originality (slice 12)

**What shipped.** `src/icons/brand.svg` (= `public/favicon.svg`, rasterised to `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`):
- full-bleed blush ground `#fff4f2`;
- two stacked coral `#b54c3d` capsules, the top one 21×9 and the lower one 17×7 offset right, touching at y = 20;
- a white disc (r 5.5) with a coral centre dot (r 2), sitting on the top capsule's left end;
- a sage `#547f4b` dot top-right.

`make-icons.ts` pads every variant on the same blush, so the OS mask edge never shows a coral ring.

**Red/pink squircle register (vs Structured): resolved.** On the home screen the icon is now a pale blush tile with coral marks. It is not a saturated red/pink squircle with a white mark. The ground, figure and value structure are inverted from the old mark. There is no shared colour scheme, silhouette or motif with Structured's icon.

**iOS toggle reading: weakened, not gone.** At 192–512px a white round knob at the end of a coral track still reads as a switch in the "off" position. The counter-cut dot makes it a ring knob, not a glyph bubble. At 32–60px the white disc dissolves into the blush (≈ 1.07:1), leaving a capsule with a bite. The mark also drifts from the product's own block language, where the chip is a *darker* disc *inside* the pill carrying a *white glyph*. This is an identity and legibility issue, not an originality breach: a generic UI-control resemblance, not another planner's property. It is filed as **ST-P1-2**, with the exact redraw.

**Close-out action (not a snag).** The launcher card inlines `brand.svg` at build (`build-press.mjs`), and the gauntlet builds it. But the slice-11 captures predate slice 12 and show the **retired** coral-squircle toggle mark. The published `press/optimo.html` carries it until republished. At arc close:
1. Run `npm run release:press` through the normal press channel.
2. Re-shoot `snag-train-2026-10-slice-11-launcher-card-*` so the evidence of record shows the new mark.
3. Confirm the live launcher's favicon and card image match `src/icons/brand.svg`.

**One-line verdict:** no originality concern remains against Structured. The red-squircle register is gone. A faint toggle-knob reading persists in the chip and goes to ST-P1-2, which is not a P0.

---

## Resolution (Code, slice 14)

| ID | Outcome | Guard |
|---|---|---|
| ST-P0-1 | Fixed — the mobile event sheet is portalled (`createPortal`) to the `.app` root, so it is no longer trapped inside `.evt`'s z-25 stacking context under the tab bar + FAB (z 30). The `.app` root rather than `<body>` keeps the `.is-mobile` sheet styles (grabber, bottom anchoring). Slice-5 capture re-shot. | `tests/snagtrain.spec.ts` ST-P0-1 — `elementFromPoint(centre of .tabbar)` lands inside `.sheet-wrap`; the Close button is reachable and closes it. |
| ST-P0-2 | Fixed — `PushSettings.tsx` + `CalendarSettings.tsx` use `<h3 id>` + `aria-labelledby` like the rest of Settings; no `<legend>` left under `.settings`. Slice-6/7 captures re-shot. | ST-P0-2 — zero `.settings legend`; the Reminders/Calendars groups keep their accessible names; each h3 top ≥ card top + 8px. |
| ST-P1-1…ST-P2-6 | Filed as `snag` issues schnubsy/optimo#29 (ST-P1-1) … #37 (ST-P2-6), in table order — not fixed in this slice. | — |
