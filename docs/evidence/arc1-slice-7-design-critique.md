# arc1 slice 7 — Eye LITE critique: Switchboard fidelity + Flow review

Mode: LITE critique (no new directions). Lead: Marlowe Holm. Seat: Steel (Viktor Stahl). Flow lens: Ingrid Falk.
Baseline: `docs/design/2026-09-26-lite/direction-2-switchboard.html` + `directions.md`. Evidence: `docs/evidence/arc1-slice-{2,3,4,5}-*.png`.

**Verdict.** The build is recognisably Switchboard and mostly faithful: graphite slabs, Chivo/Chivo Mono split
held to time and counters, a status strip that counts planned/free/done/late/unplaced, dashed free rows as real
objects, a command line with a parse row, and a Place slot-picker that delivers Flow's mobile fix word for word.
Originality is clean. The problems sit at the edges. Every segmented control in Settings and the task editor has
no visible selected state (a CSS specificity bug), including the recurrence "Apply to" scope. The desktop sync
badge gets clipped off the status strip. On iPhone the Week tab is unreadable. And the parse row hides a duration
it has parsed. Five P0s, all S except the mobile week (M). Fix those and v0.1 ships as the direction promised.

## 🔴 P0 — fix before v0.1

1. **Segmented controls show no selected state: Settings.** `settings-desktop/-iphone`, `src/styles/app.css:252-253`.
   `.settings [aria-pressed='true']` (0,2,0) loses to `.settings .seg button` (0,2,1), so Theme, Snap, Busy-slot, Week
   start and Clock all look unselected. Fix: change the selector to
   `.settings .seg button[aria-pressed='true'] { border-color: var(--signal); background: var(--signal-soft); color: var(--ink); }`. **S**
2. **Same bug in the task editor, including recurrence scope.** `src/editor/sheet.css:22-24` (TaskSheet priority,
   reminder chips, "Apply to: This / This & following / All"). The user can't see which occurrence scope they're
   editing. Fix: `.sheet .seg button[aria-pressed='true'], .sheet .chips button[aria-pressed='true'] { … }`.
   Add a Playwright check that a pressed button's computed `border-color` equals `--signal`. **S**
3. **Desktop sync badge clipped off the strip.** `timeline-desktop-*`, `inbox-desktop`, `icon-sheet`: at 1280 px only a
   4 px cobalt sliver shows at x=1275. `.strip { overflow:hidden }` (app.css:11) and the views nav push `.cell.sync` out
   of view, so "Offline, 1 queued" (the state that matters) is invisible in Day view. Fix: remove the `Categories`
   key from `.views` in `Planner.tsx:301` (already reachable from Settings → Organise). Set `.strip .cell.sync { flex: none; }`
   and `.views .key { padding: 0 8px; }`. Assert in the smoke spec that `.cell.sync` right edge ≤ 1280 while offline. **S**
4. **Mobile Week is illegible.** `week-iphone-15`: seven ~45 px columns clip titles mid-glyph ("Stretc", "Morniı",
   "Standı"). `.wblk .wt` is `display:flex`, so its `text-overflow: ellipsis` never fires (app.css:213). Fix: in
   `Week.tsx`, wrap the title in `<span className="tt">` with `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
   On `.week.m`, show a 3-day window: put `.whead` and `.wgrid` in one horizontal scroller with
   `grid-template-columns: 32px repeat(7, calc((100vw - 42px) / 3))`, `scroll-snap-type: x mandatory`, a sticky rail,
   and initial scroll to today − 1. **M**
5. **Parse row hides a parsed duration.** `inbox-desktop`, `inbox-iphone-15`: "Gym every weekday for 1h #health !!" previews
   as "today, all day · Health · P2 · every weekday". The 1h is parsed and stored but not shown. This breaks the
   Flow fix "the parse row shows every field before Enter", and duration drives Place. Fix: in `QuickAdd.tsx:106`,
   render the duration chip when `parsed.duration != null`, whatever `dateOnly` is (e.g. "all day · 1h00"). **S**

## 🟡 P1 — next

- **Late is counted, never located.** Strip reads "Late 8/10", but no block on the board is marked late, so slippage is
  a number without a place. Fix: `Block.tsx` adds `late` when `end < now && !done`. Style
  `.blk.late .tm b::after { content: ' late'; font-family: var(--font-mono); }` plus
  `.blk.late { border-right: var(--border-active) solid var(--line-strong); }`. That's a text cue, not colour alone. **M**
- **Priority shown as an unlabeled inner rule.** `.blk.pri-3/.pri-2` (app.css:45-46) draws a 2 px ink/white line inside
  the category stripe on P1 blocks. It reads as a double stripe or a rendering glitch and isn't in the direction.
  Fix: delete both rules. Priority already appears in `.sub` ("Work, P1"). For `.tiny` blocks, append "P1" to `.tm`. **S**
- **Inbox category label truncated.** "Perso", "Erran" (`.irow-main` 58 px column, app.css:136). Fix: use the mock's
  short codes (Pers, Err, Work, Learn, Meet, Fam, Hlth, Home) from a `short` field. Or show the icon only, with the name in
  `.sr-only`, and give `.ic-cat span { text-overflow: ellipsis; overflow: hidden; }`. **S**
- **Week desktop: free time disappears, and the header is ambiguous.** "8h15 / 8h00 free" doesn't say which figure is
  planned. The grid shows no free slots, which drops the direction's core idea one view out. Fix: label as
  "8h15 plan · 8h00 free". Render dashed `.free` rows ≥ 30 min inside `.wcol` (FreeRow, compact, no label). **M**
- **Cobalt spent on "Synced".** The signal is reserved for now, running and held. `base.css:33` makes the resting
  state cobalt. Fix: `.sync-synced i { background: var(--ink-3); }` and `.sync-pending i { background: var(--ink); }`.
  That makes the state that needs attention the brighter one. **S**
- **Mobile chrome eats ~165 pt before the board.** The strip wraps to two rows, and the empty-state syntax hint wraps
  to two lines (`timeline-iphone-*`). The mock budgeted 138 pt. Fix: `.cmd.compact .parse .muted { display: none; }`, shown
  only under `.cmd:focus-within`. Drop "Unplaced" from the mobile strip (the Inbox tab already shows the count) so the
  strip fits one 40 px row. **S**
- **Hour lines run through free rows.** The 08:00/12:00 lines cross the dashed boxes and their labels. Fix:
  `.free { background: var(--bg); }` (already z-index 1 above `.rail`). **S**
- **Native rounded checkboxes in Focus and the editor.** On iOS, `accent-color` gives rounded blue boxes
  (`focus-iphone-15`), which clash with the square slab checkbox. Fix: `.focus .fsubs input, .sheet .chkrow input { appearance: none; width: 20px; height: 20px;
  border: 1.5px solid var(--ink-2); border-radius: var(--r); }`, with `:checked { background: var(--ink) url(check.svg) center/12px no-repeat; }`. **S**
- **Focus hero shows elapsed time.** The big "0:01" is elapsed, while the useful figure ("89:58 left") is secondary. The
  running slab in the direction speaks in time left. Fix: swap them in `Focus.tsx` (hero = left, sub = elapsed of total). Also
  baseline-align the ✓ in `Complete` (`.primary .ic { vertical-align: -2px; }`). **S**
- **Place sheet: the list jumps behind the dim.** `place-iphone-15` shows an empty ~110 pt band above the Inbox header
  while the sheet is open. The sheet header also drops priority (mock: "0:30, P1"). Fix: when the pane has only one child, set
  `.is-mobile .pane { grid-template-rows: minmax(0, 1fr); }` and check the band is gone. Render `{dur}, P{n}` in `.sheet-hd`. **S**
- **Month header arrows are split.** `.mhead h2 { min-width: 10ch }` strands the next arrow mid-row (`month-*`). Fix: group
  ‹ › together after the title: `.mhead { justify-content: flex-start } .mhead h2 { order: -1; min-width: 0; margin-right: auto; }`. **S**
- **Settings time fields ignore the 24 h clock.** The native `type=time` shows "06:00 AM / 10:00 PM" while Clock is 24 h.
  Fix: use a mono `<select>` of 15-min steps formatted with `fmtClock(…, clock24)`. **M**

## 🟢 Works / faithful

- **Tokens and type.** Graphite surfaces, desaturated category stripes, cobalt signal, 2 px radius, no soft shadows. Chivo
  900 for the date and headings. Chivo Mono only in the gutter, durations, counters and the command line. Both themes hold parity.
- **Status strip.** Date nav, cobalt LED "Now", Planned/Free/Done/Late/Unplaced in mono, and D/W/M keys with `kbd` caps,
  as in the mock.
- **Free time as an object.** Dashed `free h:mm +` rows are real targets (`cursor: copy`, cobalt on hover/focus), and the
  totals match the strip. This is the direction's thesis, and it's delivered.
- **Selected slab and resize (Flow fix).** Cobalt border plus a full-width 8 px handle band. The hit area extends above
  and below (app.css:73-76). The live duration tag is there. Tap-to-select works on iPhone.
- **Command line (Flow fix).** `>` prompt, "parsed:" row with name, time, category, priority and recurrence, and
  Enter/Tab/Esc hints. The empty state teaches the syntax. The cobalt focus rule marks "held".
- **Place slot-picker (Flow fix).** Built from real free slots, earliest highlighted, a cross-day fallback
  ("06:00 Sun 27"), and "Pick a time or another day". 44 px rows. Exactly as reviewed.
- **Done state.** Ink-filled square check. Fill and stripe drop to ink-3. Strikethrough. The day reads at a glance.
- **Undo, 5 s.** The toast has an Undo button and the hard offset shadow (`--shadow-grab`), with no confirm dialogs.
  The toast sits above the tab bar on mobile.
- **Keyboard map.** The footer lists N, X, arrows, Shift+arrows, Enter, / and ←/→. Flow cross-cut 6 is met.
- **Overlaps.** Colliding blocks split into side-by-side lanes ("1:1 with Dana" / "Review pull request"), with no hidden overlap.
- **Mobile tabs.** Board / Inbox (with live count) / Week / More. Tabs are 56 px, and the active tab gets a cobalt top rule.
- **Month.** Square category dots, hollow when done, "+5" overflow, today underlined in cobalt. Quiet and on-system.
- **Focus.** Stark black title, one cobalt progress bar, subtasks and +5 min / Stop.
- **Originality.** The 57 in-repo glyphs use square caps and mitred joins on a 24 grid. No rounded icon bubbles, pastel
  pill blocks or connector-line timeline. Nothing resembles Structured.app or another planner.

---

## Resolution (Code, 2026-09-26) — zero open P0

| P0 | fix | guard |
|---|---|---|
| 1 Settings segmented controls had no selected state (specificity) | `.settings .seg button[aria-pressed='true']` (+ 1 px inset signal) | design.spec P0-1: computed border = `--signal` |
| 2 Editor priority / reminder / scope chips had no selected state | `.sheet .seg button[aria-pressed='true'], .sheet .chips button[aria-pressed='true']` | design.spec P0-2 |
| 3 Sync badge clipped off the desktop strip | Categories key removed from the strip (Settings → Organise), `.cell.sync { flex: none }`, keys 8 px | design.spec P0-3: badge right edge ≤ 1280 in day/week/month/settings while offline |
| 4 Mobile week unreadable | 3-day scroll-snap window (header + sticky rail in one scroller, opens on yesterday), `.tt` ellipsis span, mobile week bar with ‹ › | design.spec P0-4: columns ≥ 100 px, ellipsis, today fully on screen |
| 5 Parse row hid a parsed duration | duration chip whenever `parsed.duration != null` | design.spec P0-5 |

Also taken from P1 #4 (one word): week header now reads "8h15 planned · 8h00 free".
🟡 P1 items filed as GitHub issues labelled `snag`: schnubsy/optimo#1 – #12.
After-fix screenshots: `arc1-slice-7-{week,settings,editor}-{desktop,iphone-15}.png`.
