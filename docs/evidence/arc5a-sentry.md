# arc 5a (family-wing-people) — sentry (2026-10-03)

## 1. Secrets scan of the arc diff (required) — 🟢 clean
`git diff 295ca3f..HEAD` (78 files, PNGs and Lighthouse JSON excluded) was grepped for:
- Anthropic keys, JWTs (`eyJ….…`);
- `SERVICE_ROLE_KEY=` / `PLANNER_KEK=` / `CRON_SECRET=` assignments;
- AWS / GitHub tokens, PEM private keys;
- app-specific-password-shaped strings.

**0 hits.**
- No `console.*` was added in `src/**` or `supabase/**`.
- `access_token` / `refresh_token` appear only in `src/auth/pressSession.ts`, the storage adapter that converts the session record. It doesn't log, send or copy tokens anywhere but the one localStorage record.
- The test JWTs are unsigned fakes (`…sig`).
- Gauntlet secret gates were green on every slice and on the merged tree.
- GitHub secret-scanning alerts on schnubsy/optimo: 0.

## 2. Threat sketch — what arc 5a changes
- **One session for every family tool.** optimo now reads and rotates the Family Wing session (`press:family:v1`) instead of keeping its own (`sb-…-auth-token`).
  - The trust boundary is unchanged: both live on the one `schnubsy.github.io` origin, so any page there could already read either key.
  - Signing out of optimo now signs out of the Family Wing too, and the Settings copy says so.
  - A failed refresh clears the shared record, which is the same rule as press ("failed refresh → sign in").
  - The one-time migration copies optimo's old session into the shared record only when that record is empty. It never overwrites a live Family Wing session.
- **Return-to on the launcher** (`press/optimo.html?return=`).
  - An open-redirect risk is closed by an allowlist: same origin as the launcher AND path under `/optimo/` AND https (or localhost in tests). `javascript:`, foreign hosts and other paths are ignored, and the card shows instead.
  - Unit and Playwright tests cover a foreign return.
  - The bounce runs only after `FamilyGate.require('optimo.html')` resolves for a granted session.
  - The vendored gate is byte-identical (publish-checks green).
- **Access check** `press_access_has('optimo.html')`. It's a courtesy gate, like press's own; RLS stays the lock (own-row policies, unchanged on the live DB this arc).
  - Offline, it falls back to the last answer cached for that user id, defaulting to allow. A revoked person keeps the cached "no" offline, and RLS still denies data online.
- **db/006 (not applied).**
  - The family-wide policies are added but inert behind `planner_flags.family_access = false`. `planner_flags` is select-only to optimo users; writes go only through the migration channel / service role.
  - The new SECURITY DEFINER functions pin `search_path = ''`.
  - `planner_person_fill` has execute revoked from public / anon / authenticated, so it runs only as a trigger.
  - `planner_log_change` is redefined with `set search_path = public`, which narrows the arc-3 "mutable search_path" watch for that function.
  - `planner_people` is family-visible by design (B2: "everyone sees everyone"), with no anon grants.
  - 🟡 **watch for 5b:** flipping the flag makes every granted family member able to read and write every person's planner rows. That's Mark's ratified "no extra security", but it should flip only with the person-scoped client.
- **Paint a block / sync feedback / calendar roles.**
  - These are client-only UI. calendar-sync's response gains two aggregate counts (`events`, `pushed`) and nothing else; no new endpoint, auth path or secret.
  - Role changes write the same columns as before (`calendars`, `write_calendar_href`) under the existing column grants.

**Verdict: 🟢 sentry green.** No secret in the diff, the shared-session move doesn't widen the origin's trust boundary, the return-to is allowlisted, and db/006's family access ships switched off.
