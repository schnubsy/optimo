# HANDOFF — optimo

## Current state
v0.1 baseline + hotfix-otp (2026-09-27). Public repo https://github.com/schnubsy/optimo, Pages
https://schnubsy.github.io/optimo/ deployed by `.github/workflows/pages.yml` on every push to `main`.
Sign-in = 6-digit code from press's shared email template (email → code → `verifyOtp`). All specs hermetic;
gauntlet GREEN (81 unit · 68 Playwright desktop + iPhone 15 with axe · Lighthouse desktop 100/100, mobile 98/100).
`db/001_planner.sql` unchanged.

## Shipped this arc
- Slice 1 (29a5cef): two-step SignIn — numeric `one-time-code` field, auto-submit on the 6th digit,
  paste-friendly, wrong/expired → "That code didn't match. Try again or resend.", Resend shows the API's
  60 s cooldown, "Use a different email" back-link. `shouldCreateUser: false` (press sign-ups are off);
  `emailRedirectTo` kept so a link-style template still signs in.
- Evidence: `docs/evidence/hotfix-otp-slice-1-signin.md` + both steps dark/light, desktop/iPhone PNGs.

## Open / blockers
- Close-out manifest (this arc): push · PR · merge · reconcile main checkout — run by Code at close, proof in
  the arc-close report · migrations N/A (no DDL) · deploy = Pages on the merge commit, ship-proofed by Code at
  close (live `<meta name="build">` == merge SHA) · publish N/A (not a marquee page) · inbox cleanup N/A
  (ARC.md is committed and truncated in the PR; no INBOX FILES) · handoff DONE (this file).
- The old "add Redirect URLs in press" manual step is retired: the code flow needs no redirect, and press Auth
  settings are not changed from optimo (RULE, docs/lessons.md 2026-09-27).
- `tests/sync.real.spec.ts` (@real, against press) is SKIPPED until manual step 2.
- 🟡 design snags: schnubsy/optimo#1–#12 (label `snag`), none blocking.

## Exact next steps
1. Mark signs in on the live URL (manual step 1) and uses the app for real — his feedback orders arc 2.
2. Arc-2 checkpoint (decide first, then order the arc): calendar provider (Google vs iCloud CalDAV),
   web push for the installed PWA, marquee portal link card. Take it to the Council ("convene the council").
3. Fold the `snag` issues into arc 2's opening slice (all S/M).
4. Arc 3: AI planning layer (intent → plan) — command line is its front door.
Any Claude Code prompt for arc 2 carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and
`INBOX FILES: none` (ARC.md is the inbox).

## Mark's manual steps
1. Sign in: open https://schnubsy.github.io/optimo/ → enter your email → **Send code** → type the 6-digit code
   from the email (it submits itself on the 6th digit).
   Precondition: the page shows "Send code" (a "Send sign-in link" button means a stale cache — reload).
   Postcondition: the day view opens and the strip badge reads "Synced".
2. (Optional, enables the real-server sync test) Create a password user for testing in press → Authentication →
   Users, then:
   `cd /Users/mark/Documents/code/optimo && git pull --ff-only && grep -c OPTIMO_TEST_EMAIL tests/sync.real.spec.ts && printf 'OPTIMO_TEST_EMAIL=...\nOPTIMO_TEST_PASSWORD=...\n' > .env.test.local && npx playwright test tests/sync.real.spec.ts --project=desktop`
   Precondition prints `3` (a `0` means stale checkout — stop). Expected postcondition: `1 passed` (was `skipped`).
