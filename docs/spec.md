# optimo — functional + technical spec

_v0.1 target: a fluid, offline-capable daily planner (web PWA) with feature parity to the
Structured.app category. All code, UI, copy, icons and naming are original. Single user (Mark)._

## 1. Product

**One-liner.** A visual day planner: everything you intend to do sits on one timeline, unscheduled
work waits in an inbox, and the day is built by dragging blocks into place. Later arcs add calendar
sync and an AI layer that turns a few paragraphs of intent into a scheduled day.

**Platform order.** Web first (responsive PWA, desktop + iPhone Safari installable). iOS and
Apple Watch native clients later — the data/sync contract (§5) is the shared surface; nothing in the
web client is load-bearing for them.

**Non-goals for v0.1.** Multi-user, sharing, push notifications, calendar sync, AI planning
(arcs 2–3), widgets, Watch.

## 2. Functional requirements — v0.1 (arc 1)

### 2.1 Task
Fields: `title`, `notes` (markdown-lite), `category` (color + icon), `priority` (none / low /
med / high), `start_at` (null ⇒ unscheduled — see *Place* below), `duration_min` (default from settings, 30), `all_day`,
`subtasks[]` (title, done), `reminders[]` (offset minutes before start — see *Reminders* below),
`completed_at`, recurrence (§2.5), `tz` (arc 6, below), `plan_date` / `someday` / `estimated` (arc 7, below).

**Place (arc 7, `db/008_inbox_first.sql`) — derived, never stored twice.** `plan_date date null` (the day an untimed
task is planned for), `someday bool` (parked, no day), `estimated bool` (false = no estimate yet; `duration_min` still
holds the default used when painting). The place (`taskKind`, `src/data/place.ts`; local index `_kind`) is:
`start_at` set ⇒ scheduled (`sched`, or `series` / `override` for recurrence rows); else `someday` ⇒ **Someday**; else
`plan_date` set ⇒ **planned** ("to place" on that day); else ⇒ **Inbox**. Moving between places clears what no longer
applies (a time clears day + Someday; Someday clears the day; a day clears Someday; unscheduling without naming a day
goes to the inbox), and the client stamps `start_at` + `plan_date` + `someday` together in `field_ts`, so one place
decision wins as a unit. A field-level mix from an older client is still resolved by the order above (no CHECK — it
could reject a legitimate merge). Series / override rows never carry a day or Someday. Capture (`captureToInbox`) is
untimed with `estimated = false` and `duration_min = settings.default_duration`; an explicit duration (setEstimate, a
resize, the editor) sets `estimated = true`. "To place" trays: a day's planned items, priority then sort_key; today's
tray also takes unfinished items planned for an earlier day (overdue roll-forward — they show on today only; a past
day keeps just its finished ones). Plan-day (AI) reads only timed tasks of the day; planned / Someday items are not
sent until the tray's "Fit with AI" (arc 7 slice 9).

**Time zone (arc 6, `db/007_task_tz.sql`).** Optional IANA zone (`planner_tasks.tz text null`), set from the create /
edit sheet (② ••• → Set Timezone; the picker lists `Intl.supportedValuesOf('timeZone')`, device zone first; picking
the device zone clears it). `start_at` stays the UTC instant; `tz` is the zone the wall-clock time was chosen in, so
the editor shows and edits it there (`isoAtZone` / `zonedParts`, `src/lib/time.ts`) while the timeline converts to
the device zone and marks the row with a globe. All-day and inbox tasks never carry a zone. Absent = the viewer's zone.

**Editor (arc 6).** Create = the wizard ① title (plain-English parser) + suggestions → ② when (date, 15-min wheel,
duration presets `settings.duration_presets`) → ③ details; edit = ③ of the same sheet (Save, Delete, the header ring
completes). Day bookends (`settings.day_start_name` / `day_end_name`, default "Up" / "Lights out") are anchor rows,
ticked per day in `settings.bookend_done` — never tasks.

**Reminders (arc 2).** Web push on the installed PWA (iPhone Home Screen app, iOS 16.4+) and desktop browsers:
Settings → Reminders asks permission, subscribes with the VAPID public key (`VITE_VAPID_PUBLIC_KEY`) and writes a
`planner_push_subscriptions` row (+ `settings.data.tz`). `push-send` (pg_cron every minute, `x-cron-secret`) finds
reminders due in [now, now+60 s) — plain tasks, per-occurrence overrides and series occurrences expanded in the
user's zone (floating, like the client) minus skipped/overridden occurrences and `planner_reminder_sent` — sends
`{title, body "in 10 min · 14:00", tag task_id, url /optimo/?date=…}` to every live endpoint, prunes 404/410
endpoints and records the send. The SW shows it; a click focuses the app on that day. In-app reminders remain the
fallback and stay quiet on a device where push is on.

### 2.2 Views
- **Day timeline** — hour rail, "now" line that tracks live, blocks sized by duration, overlapping
  blocks side-by-side, free time visible as drop rows, all-day strip at top. Tap empty slot = create at
  that time. Long-press/drag = move; edge-drag = resize (snap to 5 min; setting: 5/10/15).
- **Inbox** — unscheduled tasks, ordered by priority then manual `sort_key`. Desktop: left rail;
  mobile: bottom sheet / tab. Drag inbox→timeline schedules; timeline→inbox unschedules.
  Mobile fallback: "Place" action opens a slot picker (free slots suggested first).
- **Week** — 7 columns, compact blocks, drag between days; header shows planned vs free hours/day.
- **Calendar (month)** — dot density per day; tap = jump to day.
- **Quick-add bar** — always reachable; natural language (§2.4). `Cmd/Ctrl+K`.
- **Focus mode** — a single task full-screen with an elapsing timer and subtasks; ends with
  complete / +5 min / stop.

### 2.3 Time-blocking rules
- Moving a block keeps its duration; resizing changes `duration_min` only.
- Dropping onto an occupied slot: **no auto-push** by default (overlap renders side-by-side);
  setting `push_down: true` shifts later blocks in the same category chain (Structured-style
  "auto duration handling" is: default duration + snap + push toggle).
- Completing a block that ran over/under: offer "adjust to actual" (sets `duration_min` from
  `completed_at − start_at`) — one tap, never automatic.
- Day bounds from settings (`day_start`, `day_end`); blocks outside bounds still render, dimmed.

### 2.4 Natural-language quick add (on-device, no network)
`chrono-node` for date/time + a small grammar: `for 45m|1h` duration · `#category` · `!` `!!` `!!!`
priority · `every day|weekday|week|month|<weekday>` recurrence · `@` icon keyword hint.
"Lunch with Sam at 1pm" ⇒ title "Lunch with Sam", today 13:00, default duration. Parse preview shows
the interpretation before commit; unparsed text becomes the title. No LLM in this path.

### 2.5 Recurrence
Stored as an RFC 5545 `RRULE` string + `dtstart` on the series row (`rrule` package). Occurrences are
**materialised on read** for the visible range; per-occurrence changes (move, complete, edit, skip)
write an `exception` row keyed by `(series_id, occurrence_date)`. "This / this and following / all"
on edit. Completion is per occurrence.

### 2.6 Categories, icons, priorities
User-defined categories (name, color from an 8-swatch palette with light/dark variants, icon from an
original icon set of ~60 line glyphs, sort). Priority tints the block edge, never the whole block.

### 2.7 Settings
Theme (system / light / dark) · day start/end · default duration · snap · push-down · week starts on
· 12/24h · reminders lead time · focus timer length · data export (JSON) / import.

### 2.8 Offline + sync (v0.1 must-have)
Full read/write offline. Changes queue in an outbox and sync when online. Two browsers editing the same
task converge without data loss (§5). Visible sync state (synced / pending n / offline / error).

### 2.9 Performance budgets
5 000 tasks + 200 series in the library: day view first paint < 200 ms after data ready, drag at
60 fps (no layout thrash: transforms only during drag), inbox filter < 50 ms. Lighthouse perf ≥ 85,
a11y ≥ 90 on the built page (desktop + mobile). Timeline and inbox lists virtualised.

## 3. Later arcs (not in v0.1; design for them)

**AI subtasks (arc 6 slice 8, shipped).** The sparkle on the editor's subtasks card calls `plan-day` with
`{action: 'subtasks', title, notes, duration_min}`: the small model (`claude-haiku-4-5`), one strict `submit_subtasks`
tool with `tool_choice: auto` (one nudge on a text answer), no web search; 3–7 cleaned steps come back as proposals the
user ticks off, then Keep all / Discard. Each request is recorded as an `applied` planner_ai_plans row so it counts
against the 30/day limit (and stays out of the Plan tab); title and notes are never logged. Offline / not deployed →
the Plan tab's not-connected copy.
- **Arc 2 — Calendars (shipped: iCloud CalDAV, read-only; Google deferred).** Settings → Calendars posts the
  Apple ID + app-specific password once to the `calendar-connect` Edge Function, which discovers calendars
  (PROPFIND principal → calendar-home-set → VEVENT calendars) and stores only the AES-GCM ciphertext
  (`PLANNER_KEK`) in `planner_calendar_accounts` (the client reads the secret-free `…_public` view).
  `calendar-sync` (user JWT, or `x-cron-secret` from pg_cron every 15 min) REPORTs [now−7d, now+60d], expands
  RRULEs with ical.js (instance uid = `UID#start`), upserts changed rows into `planner_events` and tombstones the
  rest; clients pull them through `planner_sync_log` like any row (server-owned: replace, no merge). The app
  refreshes on open and every 15 min while visible. Events render as outlined, fixed pills (tap = details),
  share overlap columns with tasks, and count against free time.
- **Arc 4 — iCloud two-way + calendar picker.** Discovery reads attributes single- or double-quoted (iCloud writes
  `name='VEVENT'`) and re-runs on every sync: calendars keep their read toggle, new ones arrive on, vanished ones go;
  each carries `shared` / `writable`. Settings → Calendars lists them (colour, name, "Shared" badge, read switch), shows
  "Found N calendars · synced HH:MM · N events" or "No calendars found", and a **"Put optimo tasks in"** select writing
  `write_calendar_href` (db/005; default: a calendar named "optimo" the first time discovery finds it; None = off).
  After the event pull, `calendar-sync` runs the two-way pass (`_shared/twoway.ts`): every scheduled, non-recurring,
  non-override, live task with `start_at ≥ now−7d` (no upper bound; all-day → DATE events in `settings.tz`) whose
  `version > planner_calendar_links.pushed_version` is PUT as `optimo-<task_id>.ics` (UID `optimo-<id>@optimo`,
  `X-OPTIMO-TASK-ID`; If-None-Match `*` on create, If-Match on update); deleted / unscheduled / made-recurring → DELETE;
  a new write target → move. Completed tasks keep their event; a task that ages out of the window keeps its event.
  Objects with an `optimo-` UID are never cached as `planner_events`. Pull back: an etag change applies start, length
  and title to the task, and an object gone from the write calendar (including one moved to another calendar in
  iCloud) tombstones the task — both as an upsert with `field_ts = now` and `device_id = 'calendar-sync'`, so
  `planner_merge()` arbitrates like any client. A 412 on PUT is treated as that iCloud edit (never overwritten). Echo
  guard: a pulled-back change sets `pushed_version` to the merged version. The client asks for a sync ~5 s after its
  outbox pushes task rows (one call per burst); the 15-min cron is the backstop. **Recurring tasks are not written to
  iCloud yet** (series and per-occurrence overrides stay optimo-only).
- **Arc 3 — AI planning (Plan tab).** The Plan tab takes written intent for a day (today / tomorrow / a date), a mode
  (**Propose**, the default, or **Auto**) and an optional web-research switch, and posts them to the `plan-day` Edge
  Function (user JWT, `verify_jwt`; every read/write under the caller's JWT so RLS applies). `propose` loads that
  day's tasks, events, categories, settings and the learned profile — titles, times, durations, categories and
  priorities only — and asks Claude (`PLANNER_MODEL`, default `claude-sonnet-5-5`; `ANTHROPIC_API_KEY` server-side)
  for a plan through one strict tool (`submit_plan`: blocks with a one-line *why*, ≤ 3 questions, candid notes —
  Ear register: flag overcommitment, missing buffers and conflicts, never just agree). Research adds the server web
  search tool (≤ 3 uses); cited sources are returned with the plan. The result is a `planner_ai_plans` row
  (`status: draft`). Propose renders ghost blocks on the day with conflicts marked; accept all / tick some / edit
  then accept / reject. Accepted blocks become ordinary tasks through the outbox; Auto writes them at once with a
  one-tap Undo that tombstones exactly those tasks. `learn` distils what was kept and changed into
  `planner_ai_profile.data` with a small model. Guards: 30 plans/user/day (429), one retry, intent never logged.
  Until `db/004_ai.sql` and the function are live the tab says "Planner isn't connected yet" and AI outbox rows
  park without blocking the core sync.
- **Later.** Web push (installed-PWA only on iPhone), marquee portal link card, iOS/Watch clients.

## 4. Technical design

| Layer | Choice | Why |
|---|---|---|
| UI | TypeScript · React 18 · Vite · CSS variables (tokens from the Eye's Switchboard direction) | DnD-heavy UI, large lists; static build |
| DnD | `@dnd-kit/core` + pointer sensors; transforms during drag | 60 fps, touch + mouse |
| Local store | IndexedDB via `dexie` | queryable offline store, indexes by date |
| State | Dexie live queries + small zustand store for UI | no global re-render on drag |
| PWA | `vite-plugin-pwa` (Workbox), offline-first shell | installable on iPhone |
| Backend | Supabase project `press` (`eepjhpyziczrxvirczio`), tables prefixed `planner_`, RLS | already paid for, shared with marquee apps |
| Auth | The Family Wing session only (arc 5a): press's gate keeps one Supabase Auth session at localStorage `press:family:v1`; optimo's supabase-js reads/rotates it through a storage adapter (`src/auth/pressSession.ts`). No session → `press/optimo.html?return=<optimo URL>` (optimo's launcher runs the unchanged Family Wing sign-in, then bounces back to a same-origin `/optimo/` URL). Access = `press_access_has('optimo.html')`; false → "ask Mark" page | one sign-in for every family tool; iOS clients reuse the same Supabase Auth |
| Hosting | GitHub Pages `https://schnubsy.github.io/optimo/` via Actions on `main` (`base: '/optimo/'`) | own origin ⇒ own service worker + manifest |
| Tests | vitest · Playwright (desktop + iPhone 15) · @axe-core/playwright · Lighthouse | per `testing.md` |
| NLP | `chrono-node` + `rrule` | on-device |

Secrets: only the Supabase URL + publishable anon key ship in the client (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, committed in `.env.production` — publishable by design). Everything else stays
server-side (Edge Function secrets) in later arcs.

## 5. Data + sync contract (shared with future iOS/Watch clients)

### 5.1 Tables (`db/001_planner.sql`)
- `planner_categories` (id uuid, user_id, name, color, icon, sort_key, …sync cols)
- `planner_tasks` (id uuid, user_id, title, notes, category_id, priority int, start_at timestamptz null,
  duration_min int, all_day bool, completed_at, subtasks jsonb, reminders jsonb, sort_key,
  rrule text null, dtstart timestamptz null, series_id uuid null, tz text null /* arc 6, db/007 */,
  plan_date date null, someday bool not null default false, estimated bool not null default true /* arc 7, db/008 */,
  …sync cols). Place = derived from start_at → someday → plan_date → inbox (§2.1); `planner_merge()` merges the
  arc-7 columns field-level unchanged (it loops over every column of the row).
- `planner_exceptions` (series_id, occurrence_date date, task_id uuid null /* override */,
  skipped bool, …sync cols; PK (series_id, occurrence_date))
- `planner_settings` (user_id PK, data jsonb, …sync cols)
- `planner_sync_log` (seq bigserial PK, user_id, table_name, row_id, op, at) — the pull cursor source
  (trigger-maintained).
- `planner_ai_plans` (arc 3, `db/004_ai.sql`: id uuid v7, user_id, plan_date date, intent, mode propose|auto,
  status draft|accepted|rejected|applied|failed, proposal jsonb `{blocks, questions, notes}`, research jsonb
  `[{query,url,title,snippet}]`, model, accepted_task_ids uuid[], …sync cols) — written by `plan-day`; clients change
  only status / accepted_task_ids.
- `planner_ai_profile` (arc 3: id, user_id unique, data jsonb `{tone, day_shape, preferred_block_min, buffers,
  habits[], avoid[]}`, accepted_count, …sync cols) — distilled server-side; clients only reset it (tombstone).
- `planner_calendar_links` (arc 4, `db/005_calendar_twoway.sql`: task_id PK → planner_tasks, account_id, calendar_href,
  object_href, uid `optimo-<task_id>@optimo`, etag, pushed_version, pushed_at) — server-owned (calendar-sync, service
  role); clients may read. `planner_calendar_accounts.write_calendar_href` is the one calendar optimo writes into.
  `planner_ai_plans` / `planner_ai_profile` are optional tables for a client: a push answered with PGRST205 / 42P01 (not applied yet) parks those
  outbox rows and retries every cycle; the core tables never wait on them.
  Optional **columns** (`OPTIONAL_COLUMNS`, arc 7: `planner_tasks.plan_date / someday / estimated`): a push answered
  PGRST204 / 42703 (008 not applied yet) is re-sent without those columns (and their `field_ts` keys, so the server
  claims no timestamp for a value it never got); the row ids go to a local backlog (`meta.colBacklog`). Each later push
  probes `select plan_date,someday,estimated limit 1`; once it passes, the backlog rows are re-queued in full from the
  local store. Nothing counts as pending meanwhile, and pulls of pre-008 rows keep the local values (defaults for new
  rows).

**Sync cols on every row:** `version bigint` (server-incremented by trigger), `updated_at timestamptz`,
`deleted_at timestamptz null` (tombstone; hard-purged after 30 days), `field_ts jsonb`
(`{field: unix_ms}` — client-maintained, last-write time per field), `device_id text`.

### 5.2 Protocol (PostgREST only — no custom server)
- **Push**: client sends outbox rows via `upsert` with `field_ts`. A `BEFORE UPDATE` trigger merges
  **field-level last-writer-wins**: for each field in incoming `field_ts` newer than stored, take the
  incoming value; otherwise keep the stored one; `version` increments; the merged row is what lands.
  Deletes are tombstones (`deleted_at`), merged the same way.
- **Pull**: `planner_sync_log where seq > :cursor order by seq` ⇒ fetch touched rows ⇒ apply locally
  with the same field-level merge ⇒ advance cursor. Realtime subscription on `planner_sync_log` for
  live pulls when online; polling fallback every 60 s.
- **Idempotent**: client ids are uuid v7 (time-ordered); replaying the outbox is safe.
- Any client (Swift later) implements exactly: outbox + `field_ts` + cursor. No other contract.

### 5.3 RLS
All `planner_*`: `user_id = auth.uid()` for select/insert/update/delete. `planner_sync_log` select only.
From `db/006_people.sql`: a `*_family` policy beside each `*_own` one — `person_id is not null and
planner_family_access()` (= `planner_flags.family_access` AND `press_access_has('optimo.html')`); server-owned tables
(events, calendar_links, reminder_sent, sync_log) select only. The flag is **off** until arc 5b's person-scoped
client ships (the arc-5a client pulls the sync log and lists calendar accounts without a user filter).

### 5.4 People (B2 — schema in arc 5a `db/006_people.sql`, UI + sync in arc 5b)
Ratified by Mark 2026-10-03. Several family members use optimo inside the one Family Wing sign-in, with no extra
security between them.
- **Table** `planner_people (id, name, color, sort_key, created_by, created_at, deleted_at)`. Everyone with optimo
  access sees every person and anyone signed in can add one (policy `planner_people_family`, live from db/006).
  "Mark" has the fixed id `5eed0000-0000-4000-8000-00000000a4c0`.
- **Everything is per person.** `person_id` is on tasks, categories, settings, ai_profile, ai_plans, exceptions,
  calendar_accounts, calendar_links, events, push_subscriptions, reminder_sent and sync_log. Data, config, AI
  profile and reminders all belong to the picked person, not to the signed-in account.
- **Today's data → Mark.** db/006 backfills every row of Mark's account to Mark without firing merge/log triggers.
  Another account's rows stay unassigned until that person is picked in 5b.
- **Writes without a person** (the arc-5a client, Edge Functions) get one from a BEFORE INSERT trigger: the first
  person created by the row's user. Arc-5b clients always send `person_id`.
- **Picker.** On open, a list of people plus "Add someone" (name + colour). The pick is the active person.
  - The **last-picked person is remembered per device** (localStorage `optimo.person`).
  - The pick can be changed from the header at any time.
  - With one person, the picker is skipped.
- **Sync scoped by person.**
  - Outbox rows carry `person_id`.
  - The pull reads `planner_sync_log where person_id = :active and seq > :cursor`, with one cursor per person per device.
  - Realtime filters on `person_id=eq.<active>`.
  - Switching person swaps the local view; Dexie keeps each person's rows, and the outbox is never dropped.
- **One-row-per-person keys.**
  - `planner_settings` keeps its `user_id` PK for now. db/006 adds `unique (person_id)` beside it, and 5b clients
    upsert with `on_conflict=person_id`.
  - `planner_ai_profile` gets the same treatment (beside `unique (user_id)`).
  - A later migration drops the user_id keys once no client upserts on them.
- **iCloud per person.** Each person links their own Apple ID (`planner_calendar_accounts.person_id`). Mark keeps
  today's link.
  - calendar-connect and calendar-sync take the person from the request, and the cron path iterates accounts by
    person.
  - Events and links carry the account's person.
  - Calendar roles (Off · Show in optimo · Two-way) are per account, so per person.
- **Switch-over (5b).**
  - Ship the person-scoped client and Edge.
  - Cowork sets `update planner_flags set value = true where key = 'family_access'` (guarded: precondition is that
    the live build includes the person picker).
  - Then family-wide read/write is live.

## 6. Design system
**Current (arc 6, 2026-10-09):** the spine design in `docs/design/2026-10-09-mockups/` (10 mockups + the measured
`mockups.md` sheet) on the FINAL "Meadow" token base — `src/styles/tokens.css` (dark = the measured mockup palette:
`--canvas` #000, `--panel` #1C1C1E, `--card`, `--node`, `--spine`, accent #EC9792; light mirrors it) plus the culori-measured
a11y layer `tokens-a11y.css`. Font Nunito Sans (Google Fonts). Glyphs: `src/icons/set.ts` (24 px grid, filled, drawn in-repo).

**Originality rule (2026-10-09):** structure, flow, sizes and colours may follow the 2026-10-09 mockups exactly; glyph artwork is always drawn in-repo on the 24 px grid (never traced from any icon set), copy strings are ours (free-time phrases, bookend names, suggestion seeds), the name stays optimo.

History: Switchboard (arc 1, `docs/design/2026-09-26-lite/`) → FINAL Meadow (arc 2, `docs/design/2026-09-27-final/`) → spine (arc 6).

## 7. Testing (gauntlet — `scripts/gauntlet.sh`)
vitest (merge logic, NLP grammar, recurrence materialisation, push-down rules) · Playwright smoke
desktop + iPhone 15 (loads, timeline renders, quick-add creates, drag reschedules, offline round-trip,
two-context sync convergence) · axe inside Playwright · Lighthouse budgets. Evidence to `docs/evidence/`.

## 8. Ship proof
Pages deploy: `sha256 dist/index.html` before/after must change and the live
`https://schnubsy.github.io/optimo/` must contain a build-id string only the new build has
(`<meta name="build" content="<sha>">`).
