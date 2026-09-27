# Arc 2 · slice 5 — web push reminders

- **Service worker:** `src/sw.ts` via vite-plugin-pwa `injectManifest` — the same precached offline shell
  (navigate fallback, Google-Fonts runtime caches, skipWaiting/clientsClaim) plus `push` (shows push-send's payload)
  and `notificationclick` (focuses the open app and posts `optimo:open` with the day; else opens `/optimo/?date=…`).
  offline.spec (SW shell + IndexedDB offline round trip, installability) still green.
- **Client:** `src/push/{subscribe,api,PushSettings}.ts(x)` — Settings → Reminders: states unsupported /
  needs-install (iPhone Safari outside the Home Screen app) / denied / off / on; enable = permission → subscribe
  (VAPID public key) → `planner_push_subscriptions` upsert + `settings.data.tz`; test notification through the SW;
  off = unsubscribe + delete the row. The in-app scheduler stays the fallback and is quiet where push is on.
- **push-send** (`supabase/functions/push-send`, committed, not deployed): cron-secret only; `_shared/due.ts`
  (pure) = reminders due in [now, now+60 s) for plain tasks, overrides and series occurrences expanded in the user's
  zone with floating semantics (DST-safe), minus skipped / overridden / completed occurrences and
  `planner_reminder_sent`; `npm:web-push` to every live endpoint; 404/410 pruned; sends recorded once.
- **Keys:** `scripts/vapid.mjs` → VAPID pair (private + subject in gitignored `.secrets/planner.env`; public in
  `.env.production`, publishable). `scripts/secrets.mjs` prints the guarded `supabase secrets set` (5 names).
- **db/003_cron.sql** (not applied — Cowork, after secrets + deploys): refuses to run without the vault secret
  `planner_cron_secret`; schedules `planner_push_send` every minute and `planner_calendar_sync` every 15 min via
  `net.http_post` with `x-cron-secret` from `vault.decrypted_secrets`. **Lint:** every `db/*.sql` and each
  `$cron$` body parses with libpg-query (PostgreSQL 17 grammar) — `tests/unit/sql.test.ts`.

## Tests
- `tests/unit/due.test.ts` — 16: window edges, at-start, several leads, completed/deleted/no-reminder, already
  sent, series occurrence, skipped, moved (override fires at the new time), completed occurrence, floating 09:00
  across DST, deleted exception, local-vs-UTC date (Auckland), payload copy 24 h/12 h; push handler: cron secret,
  send to all + prune 410 + record once, idempotent within the minute. Deno: `deno test` incl. rrule in the Edge
  runtime. Log: `arc2-slice-5-functions.txt`.
- `tests/push.spec.ts` (desktop Chromium, real SW; headless has no FCM so `PushManager.subscribe` is stood in):
  enable → row written with keys → CDP `ServiceWorker.deliverPushMessage` → the SW shows the notification with the
  payload (`arc2-slice-5-notification.json`) → the app opens the day from the SW message → test notification →
  off removes the row.
- Gauntlet `arc2-s5-gauntlet-20260927-154036` GREEN (deno check/test covers push-send too).

## Evidence
`arc2-slice-5-reminders-desktop.png`, `arc2-slice-5-notification.json`, `arc2-slice-5-functions.txt`.
