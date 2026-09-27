# HANDOFF — optimo

## Current state
v0.1 baseline complete (arc 1, 2026-09-26). Public repo https://github.com/schnubsy/optimo, Pages
https://schnubsy.github.io/optimo/ deployed by `.github/workflows/pages.yml` on every push to `main`.
All specs hermetic; gauntlet GREEN (73 unit · 56 Playwright desktop + iPhone 15 with axe · Lighthouse
desktop 100/100, mobile 98/100); sentry GREEN. `db/001_planner.sql` unchanged (applied at kickoff).

## Shipped this arc
- Slices 1–7 per `docs/history.md` 2026-09-26; evidence per slice in `docs/evidence/arc1-slice-*`.
- Perf at 5 000 tasks + 200 series: day view 14.5 ms after data, inbox filter 1.2 ms, 0 long tasks while dragging.
- Design review: `docs/evidence/arc1-slice-7-design-critique.md` — 5 P0 fixed (guards in `tests/design.spec.ts`).

## Open / blockers
- Close-out manifest outcomes (this arc): push DONE · PR DONE · merge DONE · reconcile main DONE ·
  migrations N/A (none this arc) · deploy = Pages on the merge commit, ship-proofed by Code at close
  (live `<meta name="build">` == merge SHA; proof in the arc-close report) · publish N/A (not a marquee page) ·
  inbox cleanup DONE · handoff DONE (this file).
- Magic-link sign-in on the live URL needs Mark's manual step 1 (redirect URLs). Until then the live app
  shows the sign-in screen but the emailed link may not return to it.
- `tests/sync.real.spec.ts` (@real, against press) is SKIPPED until manual step 2.
- 🟡 design snags: schnubsy/optimo#1–#12 (label `snag`), none blocking.

## Exact next steps
1. Arc-2 checkpoint (decide first, then order the arc): calendar provider (Google vs iCloud CalDAV),
   web push for the installed PWA, marquee portal link card. Take it to the Council ("convene the council").
2. Fold the `snag` issues into arc 2's opening slice (all S/M).
3. Arc 3: AI planning layer (intent → plan) — command line is its front door.
Any Claude Code prompt for arc 2 carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and
`INBOX FILES: none` (ARC.md is the inbox).

## Mark's manual steps
1. Supabase dashboard (project press) → Authentication → URL Configuration: add
   `https://schnubsy.github.io/optimo/` and `http://localhost:5173/optimo/` to Redirect URLs.
   Postcondition: sign in at https://schnubsy.github.io/optimo/ with your email → the link lands back on the
   app signed in and the strip badge reads "Synced".
2. (Optional, enables the real-server sync test) Create a password user for testing in press → Authentication →
   Users, then:
   `cd /Users/mark/Documents/code/optimo && git pull --ff-only && grep -c OPTIMO_TEST_EMAIL tests/sync.real.spec.ts && printf 'OPTIMO_TEST_EMAIL=...\nOPTIMO_TEST_PASSWORD=...\n' > .env.test.local && npx playwright test tests/sync.real.spec.ts --project=desktop`
   Precondition prints `3` (a `0` means stale checkout — stop). Expected postcondition: `1 passed` (was `skipped`).
