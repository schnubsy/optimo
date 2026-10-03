# icloud-two-way — sentry (2026-10-03)

## 1. Secrets scan of the arc diff (required) — 🟢 clean
`git diff main...HEAD` (42 files, +1887 / −101, PNGs excluded) grepped for Anthropic keys (`sk-ant-…`), JWTs
(`eyJ….…`), `SUPABASE_SERVICE_ROLE_KEY=` / `PLANNER_KEK=` / `CRON_SECRET=` assignments, AWS / GitHub tokens, PEM
private keys and app-specific-password-shaped strings. Only hit: `grant … on public.planner_calendar_links to
service_role;` in `db/005` (a role name, not a secret). No new logging in `supabase/**` (no `console.*` / `p.log`
added); no secret names in `src/**` (only the existing "app-specific password" help copy). Gauntlet secret gates green
on every slice (fixture password absent from `docs/evidence` + `dist`; no Anthropic key in dist / evidence / tracked
files). GitHub secret-scanning alerts on schnubsy/optimo: 0. Verified.

## 2. Threat sketch — what arc 4 changes
- **New capability: optimo writes to Mark's iCloud.** calendar-sync now PUTs / DELETEs objects with the stored
  app-specific password. Scope is bounded in code: writes go only to `write_calendar_href` (a calendar discovery
  reported as writable), only to objects named `optimo-<task_id>.ics` with UID `optimo-<id>@optimo`, and DELETE only
  hits `object_href`s optimo itself recorded in `planner_calendar_links`. Updates and deletes are If-Match'd on the
  etag optimo last wrote, creates are If-None-Match `*` — optimo never overwrites an object someone else changed
  (412 → the iCloud edit is applied instead). Blast radius of a bug: optimo's own objects in one calendar.
- **New data path into planner_tasks from iCloud.** An iCloud edit to an optimo object can change that task's
  title / start / length or tombstone it. Anyone with write access to the chosen calendar (e.g. family members, if
  Mark picks a shared writable calendar) can therefore edit or delete those optimo tasks. Writes are LWW upserts as
  device `calendar-sync` (auditable via `device_id`), tombstones not hard deletes (30-day purge window = recovery
  window). The picker copy now states "deleting it there deletes the task" (ARC4-P1-1). 🟡 watch: picking a shared
  calendar is Mark's informed choice; snag #56 adds confirmation copy for target changes.
- **Credentials:** unchanged — the app-specific password stays AES-GCM ciphertext (`PLANNER_KEK`) server-side; the
  new code decrypts it only inside `syncAccount` as before and never logs it (Playwright password gate still green).
- **Authorization:** calendar-sync still authenticates the caller (user JWT → only that user's accounts; or
  `x-cron-secret`). It uses the service role (as in arc 2) because the cron path has no user; every new query is
  filtered by the account's `user_id` / `account_id` (`tasksForPush`, `tasksByIds`, `links`, `writeTask` upserts carry
  `user_id`). `planner_calendar_links` RLS: select-own for `authenticated`, writes service-role only (db/005).
- **Client trigger:** the debounced client call is just the existing authenticated calendar-sync POST; no new
  endpoint, no new secret, only publishable keys in the client.
- **Pre-existing (from the arc-3 verify, unchanged here):** `planner_log_change` / `planner_merge` mutable
  search_path + SECURITY DEFINER callable via RPC — 🟡 watch, out of this arc's scope.

**Verdict: 🟢 sentry green** — no secret in the diff; the new write path is scoped to optimo-owned objects in one
user-chosen calendar with etag preconditions.
