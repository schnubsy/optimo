# Arc 2 · sentry (security pass) — 2026-09-27 — GREEN

Scope: `git diff main..arc/v0-2-meadow` (127 non-PNG files).

## Secrets scan
Patterns: Supabase secret / service-role keys, JWTs, GitHub / Anthropic / AWS tokens, PEM private keys, and the
three generated secrets by name (`PLANNER_KEK=`, `CRON_SECRET=`, `VAPID_PRIVATE_KEY=`). Hits in the diff: **0**.
The actual generated values in the gitignored `.secrets/planner.env` were grepped (fixed-string) across the whole
tree at HEAD, `dist/` and `docs/`: **0**. `.secrets/` is in `.gitignore` (`git check-ignore` confirmed).
Built bundle: one key-shaped string — the press **publishable** key (by design). `VITE_VAPID_PUBLIC_KEY` in
`.env.production` is the public half of the VAPID pair (browsers need it to subscribe) — publishable by design.

## iCloud password handling (ARC RULE)
Posted once to `calendar-connect` over HTTPS, AES-GCM-encrypted with `PLANNER_KEK` server-side, ciphertext only
in `planner_calendar_accounts.secret_enc` (column not selectable by `authenticated`, db/002); handlers never log
it; the client clears the field after connect and reads the secret-free view. Gate: `tests/calendar.spec.ts`
asserts the fixture password is absent from IndexedDB, localStorage, console and every server row; the gauntlet
greps `docs/evidence` + `dist` for it.

## Functions' trust boundaries
- `calendar-connect`: JWT required (verify_jwt + `auth.getUser`), writes only the caller's `user_id`.
- `calendar-sync`: user JWT → that user's accounts only; or `x-cron-secret` (constant, from vault via pg_cron).
- `push-send`: cron secret only; service-role reads scoped per user; 404/410 endpoints pruned.
- No new client-side secrets; no press Auth settings changed.

## Dependency audit
`npm audit --omit=dev` → **found 0 vulnerabilities**. New runtime deps: none (workbox-* are build-time, bundled
into the SW; ical.js / culori / libpg-query are dev/test; the functions pin `npm:ical.js@^2.2.1`,
`npm:web-push@^3.6.7`, `npm:rrule@^2.8.1`, `npm:@supabase/supabase-js@2` via `supabase/functions/deno.json` +
`deno.lock`).
