## 2026-10-02 — arc/snag-train-2026-10 (monthly snag train — Issues #15–#27)

Work order — snag train (optimo, 2026-10)

Repo: ~/Documents/code/optimo   (GitHub: schnubsy/optimo)
MAIN CHECKOUT: /Users/mark/Documents/code/optimo
INBOX FILES: none
Branch: git checkout -b arc/snag-train-2026-10
(local `main` was 1 commit ahead of `origin/main` — already pushed by the train orchestrator before this
order was written; branch from the now-synced `main`.)

STANDING RULES (verbatim)
(1) Plan mode ONCE at the start. Batch every question up front, then run every slice back-to-back with
    no further pauses. Return only at arc-complete or a genuine blocker.
(2) Session branch arc/snag-train-2026-10. `git add` by name only, never `-A`. Never `rm -rf` (use
    `rm -r`). Never remove or move a git worktree inside the order.
(3) PER-SLICE LOOP (every slice): extend the tests to cover the slice → `npm run build` clean → run
    `scripts/gauntlet.sh` (unit + Playwright desktop/iPhone-15 + axe + Lighthouse budgets) → capture
    done-proof into `docs/evidence/snag-train-2026-10-slice-<N>-<name>.<ext>` IN THE REPO → commit
    `feat: slice <N> — <summary>` → tick this slice `Status: done <sha>` in this ARC.md and commit
    (tick+commit only) → next slice, without returning.
(4) TRAIN MODE CLOSE (this run is SHADOW — `shadow_remaining > 0`): once every slice's gauntlet is
    green —
      FULL CLOSE FIRST (once, before the PR, same branch): the final `/council:handoff` — overwrite
      CLAUDE.md Current stage, prepend docs/history.md, promote docs/lessons.md, overwrite HANDOFF.md,
      tick every slice + truncate this ARC.md to zero bytes — committed on the branch → THEN
      push branch → `gh pr create --fill --base main` with `Fixes #15` … `Fixes #27` (every issue
      number, each its own `Fixes #n` line) in the body → confirm the PR is **open, not draft, checks
      green** → STOP HERE. Do not merge (merging would trigger the Pages deploy workflow on main — not
      in shadow mode). Report the PR URL and check status back to the orchestrator.
    Never claim "merged" / "published" / "live" — this run only opens the PR.
(5) If ANY gate goes 🔴 (gauntlet, sentry, or the page-diff gate below): stop at the last green slice,
    leave the branch pushed, open the PR as DRAFT, report exactly which gate and which slice failed.
(6) Never claim "deployed"/"published"/"live" from an exit code or a version bump — ship proof or it
    did not ship. (N/A this run — no publish happens in shadow mode.)

ORIENT FIRST
Read: CLAUDE.md, HANDOFF.md, this ARC.md, docs/spec.md if present. HANDOFF already names these as
"fold into arc 3's first slice" — this train run supersedes that note: these 13 issues ship as their
own train arc now, ahead of the arc-3 AI-planning checkpoint. Skim docs/lessons.md and docs/history.md
yourself if short enough; this is a single-session train arc, not an interactive arc, so skip the
separate recall sub-agent.

Each slice below cites its evidence source: `docs/evidence/arc2-slice-7-design-critique.md` (the Eye
LITE review that raised all 13). Icon slices touch `src/icons/set.ts`; re-run `scripts/icon-sheet.ts`
after any icon-sheet change so `icons.png` evidence regenerates.

=== SLICE 1 — now-pill hides the hour numeral (Fixes #15) === Status: done 838ec66
Scope: `src/timeline/HourRail.tsx` (or app.css). A2-P1-1, 🟡 P1.
Implementation: hour label `opacity:0` when `|now − hour| < 12min`, OR `.now-flag{box-shadow:0 0 0 4px
  var(--canvas)}` so the flag cleanly masks the numeral. Either is acceptable — pick the one that
  matches the existing component structure.
Done-criteria: Day view desktop + iPhone-15 evidence shows the hour numeral never visible under the
  now-pill within a 12-minute window of the hour.

=== SLICE 2 — Week/Timeline tab glyphs misread (Fixes #16) === Status: done cad9419
Scope: `src/icons/set.ts`. A2-P1-2, 🟡 P1.
Implementation: ui-week → a rounded calendar frame, solid header band, 3 column counter-cuts joined by
  the band (not three loose capsules). ui-timeline → two offset stacked pills with a small left chip,
  echoing the brand mark. Keep the 1.75px outline variants.
Done-criteria: regenerated `icons.png` (desktop) shows both glyphs legible and distinct from each other
  and from the note/message-card misread noted in the issue.

=== SLICE 3 — activity glyphs illegible at 13px (Fixes #17) === Status: done 69623d0
Scope: `src/icons/set.ts` + `scripts/icon-sheet.ts`. A2-P1-3, 🟡 P1.
Implementation: food-plate → widen the plate disc to 16px, taper knife blade + fork tines so they stop
  reading as bars/letters. care-mirror → rectangular/oval mirror on a short stand (not a lollipop,
  distinct silhouette from errand-pin). handshake → two interlocking cuffs, one counter-cut.
  heart-people → drop the small heart, two figures with one counter-cut.
Done-criteria: re-run `scripts/icon-sheet.ts`; regenerated `icons.png` at 13px shows none of the four
  glyphs reading as text or blobbing into an unrelated shape.

=== SLICE 4 — calendar events need their own glyph + ring colour (Fixes #18) === Status: done a98c299
Scope: `src/icons/set.ts`, `EventBlock.tsx`. A2-P1-4, 🟡 P1.
Implementation: add `ui-calendar` chrome glyph (calendar frame, one date-cell counter-cut). iCloud event
  chip uses it instead of the week/III glyph. Ring colour = the iCloud calendar's own colour if
  provided, else `--line-strong` — never the powder category hue.
Done-criteria: Timeline evidence (desktop + iPhone-15) shows iCloud events with the new glyph and a ring
  that never matches a category colour.

=== SLICE 5 — event details on iPhone should be a bottom sheet (Fixes #19) === Status: done 817dddc
Scope: event-details component; reuse `.sheet` from `src/editor/sheet.css`. A2-P1-5, 🟡 P1.
Implementation: below 900px, render event details as a read-only bottom sheet with close button +
  grabber; Esc / scrim-tap closes it. Desktop keeps the popover.
Done-criteria: iPhone-15 evidence shows the sheet with scrim, no longer covering neighbouring pills;
  desktop popover behaviour unchanged.

=== SLICE 6 — settings group labels straddle the card edge on iPhone (Fixes #20) === Status: done ba16a41
Scope: app.css:292 area; `src/views/Settings.tsx`. A2-P1-6, 🟡 P1.
Implementation: `.settings legend{float:left;width:100%}` applied inside the mobile `.page` wrapper too,
  OR render the group label as an `<h3>` inside the card with `aria-labelledby` on the fieldset.
Done-criteria: iPhone-15 Settings evidence shows "Reminders"/"Organise"/"Data" fully inside their cards,
  matching desktop placement.

=== SLICE 7 — settings last row sits under the tab bar (Fixes #21) === Status: done f0bfa2a
Scope: app.css:330 area; the Settings scroll container. A2-P1-7, 🟡 P1.
Implementation: add the Settings scroller to the `.is-mobile` list that gets
  `padding-bottom:var(--scroll-pad-bottom)`.
Done-criteria: iPhone-15 Settings evidence shows the build-number row fully clear of the floating tab
  bar.

=== SLICE 8 — Week view edges: sliver on iPhone, flush right on desktop (Fixes #22) === Status: done 5687c39
Scope: `src/views/Week.tsx` + app.css. A2-P1-8, 🟡 P1.
Implementation: day scroller — `scroll-snap-type:x mandatory; scroll-padding-inline-start:var(--gutter)`;
  columns `scroll-snap-align:start`. Desktop `.wbody{padding-right:var(--sp-4)}`.
Done-criteria: iPhone-15 Week evidence shows no stray sliver of the adjacent day after a snap scroll;
  desktop Week evidence shows the Sun column clear of the window edge.

=== SLICE 9 — quick-add parse chips below the 44px target (Fixes #23) === Status: done ea84308
Scope: app.css, quick-add sheet. A2-P1-9, 🟡 P1.
Implementation: `.qa-sheet .parse button{min-height:44px}`, or keep visual size and pad the hit area
  with `::before{content:'';position:absolute;inset:-8px}` (matching the existing pill-chip pattern).
Done-criteria: iPhone-15 quick-add evidence + a Playwright/axe hit-target assertion ≥44px for parse
  chips and the glyph chip.

=== SLICE 10 — evidence gap: post-chrome captures (Fixes #24) ===
Scope: the evidence-capture spec/script used by the design-review process (follow whatever slice 7 of
  arc-2 used to generate `docs/evidence/arc2-slice-*` captures).
Implementation: extend the capture list with `{week,inbox,month,editor}-iphone-15-{light,dark}` and
  `day-desktop-dark`, captured against the current (post-slice-1-through-9) build.
Done-criteria: all listed captures present under `docs/evidence/snag-train-2026-10-slice-10-*` for both
  light and dark where specified.

=== SLICE 11 — launcher card: rounded type + dark variant (Fixes #25) ===
Scope: `src-press/optimo.html`. A2-P1-11, 🟡 P1.
Implementation: heading `font-family:ui-rounded,"SF Pro Rounded","Nunito Sans",system-ui,sans-serif;
  font-weight:800` (no network font load). Add `@media (prefers-color-scheme:dark)` using the dark
  Meadow canvas/surface/accent values from `tokens.css`.
Done-criteria: launcher-card evidence (desktop + iPhone-15, light + dark) shows the rounded heading face
  and a working dark variant.

=== SLICE 12 — brand mark: move off the red-squircle/toggle register (Fixes #26) ===
Scope: `src/icons/brand.svg`, `scripts/make-icons.ts`. A2-P1-12, 🟡 P1. Originality concern: too close to
  Structured.app's icon register — treat as higher priority than its P1 label suggests.
Implementation: invert the ground — blush canvas `oklch(0.975 0.012 30)` squircle, coral pill carrying a
  white-glyph chip, plus the sage free-time dot. Chip reads as a glyph bubble (inner counter-cut), not
  an iOS toggle knob. Regenerate PWA icons via `scripts/make-icons.ts`.
Done-criteria: brand-mark evidence no longer reads as a toggle switch or as the same register as
  Structured's icon; regenerated PWA icon set committed.

=== SLICE 13 — elapsed sweep should have a flat trailing edge (Fixes #27) ===
Scope: app.css `.pill .elapsed`. A2-P1-13, 🟡 P1.
Implementation: `.pill .elapsed{border-radius:inherit;border-start-end-radius:0;
  border-end-end-radius:0}`.
Done-criteria: running-pill evidence (Day view, desktop + iPhone-15) shows a flat-edged tone-sweep, not
  a nested rounded block.

=== SLICE 14 — design review (standard UI slice, Eye LITE) ===
Scope: Eye LITE critique over this arc's own evidence (slices 1–13), including a specific originality
  check on slice 12's reworked brand mark. Only P0 findings are actioned as a fix within this slice;
  new P1/P2 findings get filed as new snag Issues, not fixed here.
Done-criteria: critique run and recorded in docs/evidence/; zero unresolved P0s.

=== SLICE 15 — performance budget (standard UI slice) ===
Scope: `scripts/gauntlet.sh`'s existing Lighthouse budget step (desktop + iPhone-15) — confirm it still
  meets the baseline recorded in HANDOFF (100/100, 98/100) after 13 UI-touching slices.
Done-criteria: Lighthouse evidence captured; no regression vs. the recorded baseline, or a documented,
  justified exception.

=== PRE-PR GATE — page-diff ===
optimo ships via GitHub Pages (not press's release.js), so there is no single static "built file" vs.
"live page" pair the way press-native dashboards have. Apply the gate per-view instead: for each view
touched by slices 1–13 (Day, Week, Settings, quick-add, the launcher card), diff the arc's own
docs/evidence screenshot against the equivalent CURRENT-LIVE screenshot you capture from
`https://schnubsy.github.io/optimo/` (and `https://schnubsy.github.io/press/optimo.html` for slice 11)
at both viewports (1280×800, 390×844) using `node ~/Documents/code/press/tools/page-diff.mjs` if it
accepts two image/URL inputs directly, else compute the pixel-diff percentage by hand with the same 2%
threshold. 🔴 if > 2% on a view NOT listed as an intentional UI change above — but every slice here IS a
deliberate visual change (icon redraws, sheet behaviour, spacing), so treat all 13 as "layout change"
pre-justified; only flag a 🔴 if a view you did NOT touch also changed.

RETURN POINTS: arc-complete (PR open, checks green, awaiting-merge) per rule (4) above, or a genuine
blocker per rule (5). Report back: branch name, PR URL, check status, which gates were green, any
originality concern that remains on the brand mark (slice 12) after the Eye LITE pass.
