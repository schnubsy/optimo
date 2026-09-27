# Arc 2 · slice 6 — Family Wing launcher card (press marquee)

- **optimo (source):** `src-press/optimo.html` (the card — "optimo — one timeline for the day", the app mark,
  "Open optimo" → https://schnubsy.github.io/optimo/; Meadow colours, system font stack, no network at boot),
  `src/vendor/family-gate.js` byte-identical to `press/src/family-gate.js` (blob 9eba177d), `build-press.mjs`
  (inlines gate + mark → `dist/optimo.html`, deterministic: two builds = blob b7f32089), `tools/publish-checks.mjs`
  (gate parity, dist freshness, determinism), `tools/release.js` (remit's Lane A steps: PRESS_DIR, build +
  publish-checks, spaces.json family-only gate read-only, sha256 three witnesses, git blob, pages.json entry, stages
  nothing), `db/press/optimo_grant.sql` (press_access_apps gated + Mark's grant — **Cowork applies**).
  The launcher is built by the gauntlet / release, not by `npm run build`, so optimo's Pages deploy never ships it.
- **Brand mark:** the Switchboard mark (dark + cobalt) is retired — `src/icons/brand.svg` redrawn in Meadow coral
  (a pill with its chip, a free-time dot, a second pill); PWA icons regenerated (`scripts/make-icons.ts`).
- **press (branch `arc/optimo-card`, 3d7d410, not pushed, press checkout back on main):** `spaces.json` family +=
  optimo.html; `tenants.json` entry {repo optimo, tier family, gate/vendored, release tools/release.js, build
  `node build-press.mjs`, output dist/optimo.html, deterministic}; ARC.md one-line pointer. pages.json and
  optimo.html untouched — release.js writes both at close, after the optimo merge.
- **tenants-check** (`arc2-slice-6-tenants-check.txt`): on the real branch T2/T3/T4 PASS; T1 (pages.json) is by
  design pending until release.js runs at close; T8 needs a council snag-registry row — a third repo this order
  doesn't write, so it is Mark's manual step (row in the evidence file). Against an overlay of the post-close state
  (release.js --dry's pages.json + that row) with `--rebuild`: **0 fail**, T5 rebuild == published blob.

## Tests
`tests/press.spec.ts` (desktop + iPhone): signed out → the Family Wing sign-in, no card; granted session → the card
with one link to the app, axe clean; a session without a grant → sign-in, no card. Gauntlet
`arc2-s6-gauntlet-20260927-154541` GREEN (adds "build press launcher + publish-checks").

## Evidence
`arc2-slice-6-card-{desktop,iphone-15}.png`, `arc2-slice-6-tenants-check.txt`.
