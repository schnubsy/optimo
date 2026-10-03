# arc 5a · slice 1 — Family Wing is the only sign-in (B1)

**Finding (read from ~/Documents/code/press/src/family-gate.js, not edited):** the Family Wing gate is raw fetch, not
supabase-js. Its one session lives at localStorage `press:family:v1` as `{access_token, refresh_token, expires_at (ms),
email, name}`, and the grant key is the page file (`press_access_has('optimo.html')`, db/press/optimo_grant.sql).
The Family Wing door (`index.html?view=family`) has no return-to.

**Shipped**
- `src/auth/pressSession.ts`: a supabase-js `auth.storage` adapter on `storageKey: 'press:family:v1'`.
  - It converts both ways, so optimo reads the Family Wing session and writes rotated tokens back into the same record.
  - The old optimo session (`sb-eepjhpyziczrxvirczio-auth-token`) migrates into it once, so there's no bounce for Mark.
- `src/auth/session.ts`: after a session, `rpc press_access_has({page:'optimo.html'})` → `signed-in` or `no-access`. A network failure falls back to the last known answer (offline PWA).
- `src/components/Gate.tsx`:
  - Signed-out → `location.replace(https://schnubsy.github.io/press/optimo.html?return=<this URL>)`.
  - No-access → "optimo isn't switched on for you yet — ask Mark." plus "Back to the Family Wing".
  - `?stay` holds the handover page so the gauntlet's Lighthouse audits optimo, not press.
- `src-press/optimo.html` (optimo's own launcher card; vendored gate byte-identical, publish-checks green): after `FamilyGate.require('optimo.html')` it bounces to `?return` only for a same-origin `/optimo/` URL. It is published to press at close (release.js).
- Removed: `SignIn.tsx`, `signin.css`, `signinMachine.ts` + its unit test, the fake's OTP endpoints. No OTP screen is reachable.
- `src/sync/engine.ts`: a sync run landing after the browser went offline no longer paints "synced" over "offline". The offline spec exposed this race once the access check shifted first-sync timing.
- Worktree `.claude/worktrees/agent-ab8537edaafdcce5a` removed. Its only untracked content was the `node_modules` symlink, and its commit c0bd968 was already merged. Branch deleted.

**Tests**
- `tests/familywing.spec.ts` (desktop + iPhone 15):
  - signed-in → timeline (grant checked for optimo.html);
  - signed-out → launcher URL with encoded return;
  - `?stay` page;
  - no-access → ask-Mark page (axe clean, no OTP field);
  - legacy-session migration.
- `tests/press.spec.ts`: launcher return-to bounce, and a foreign return ignored.
- `tests/unit/pressSession.test.ts`: 8 cases covering the converters, adapter, migration and allowlist.
- smoke now runs signed in on the hermetic fake.

**Gauntlet** `arc5a-slice-1` 20261003-132624: GREEN (unit 365 → incl. new, Playwright all, Lighthouse desktop 100/100,
mobile 98/100). The first run, 132220, was RED on offline.spec (the race above) and planfn.spec (it read the old token key). Both were fixed and re-run green.

Screenshots: `arc5a-slice-1-no-access-desktop.png`, `arc5a-slice-1-no-access-iphone-15.png`.
