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
med / high), `start_at` (null ⇒ inbox), `duration_min` (default from settings, 30), `all_day`,
`subtasks[]` (title, done), `reminders[]` (offset minutes before start; in-app only in v0.1),
`completed_at`, recurrence (§2.5).

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
- **Arc 2 — Calendars (shipped: iCloud CalDAV, read-only; Google deferred).** Settings → Calendars posts the
  Apple ID + app-specific password once to the `calendar-connect` Edge Function, which discovers calendars
  (PROPFIND principal → calendar-home-set → VEVENT calendars) and stores only the AES-GCM ciphertext
  (`PLANNER_KEK`) in `planner_calendar_accounts` (the client reads the secret-free `…_public` view).
  `calendar-sync` (user JWT, or `x-cron-secret` from pg_cron every 15 min) REPORTs [now−7d, now+60d], expands
  RRULEs with ical.js (instance uid = `UID#start`), upserts changed rows into `planner_events` and tombstones the
  rest; clients pull them through `planner_sync_log` like any row (server-owned: replace, no merge). The app
  refreshes on open and every 15 min while visible. Events render as outlined, fixed pills (tap = details),
  share overlap columns with tasks, and count against free time. Two-way is later.
- **Arc 3 — AI planning.** Intent paragraphs → structured plan proposal (Claude via Edge Function,
  same key as the marquee agents); learns tone/structure from accepted plans (`planner_ai_profile`);
  challenge-style prompting (Ear register), never just agreeing. Optional web research.
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
| Auth | Supabase Auth, email one-time code (shared press template), single user | holds calendar tokens later; iOS clients reuse |
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
  rrule text null, dtstart timestamptz null, series_id uuid null, …sync cols)
- `planner_exceptions` (series_id, occurrence_date date, task_id uuid null /* override */,
  skipped bool, …sync cols; PK (series_id, occurrence_date))
- `planner_settings` (user_id PK, data jsonb, …sync cols)
- `planner_sync_log` (seq bigserial PK, user_id, table_name, row_id, op, at) — the pull cursor source
  (trigger-maintained).

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

## 6. Design system
Tokens and the hero direction live in `docs/design/2026-09-26-lite/` (Eye LITE, 2026-09-26).
Recommended and adopted: **Switchboard** (dark-first instrument panel, Chivo/Chivo Mono, single cobalt
signal, free time rendered as real drop rows). Runner-up: Slack Water. Paste-ready tokens are in
`directions.md` → `src/styles/tokens.css`. Original icon set: `src/icons/` (SVG, 24px grid, line, drawn
in-repo — never imported from a named icon library's brand set).

## 7. Testing (gauntlet — `scripts/gauntlet.sh`)
vitest (merge logic, NLP grammar, recurrence materialisation, push-down rules) · Playwright smoke
desktop + iPhone 15 (loads, timeline renders, quick-add creates, drag reschedules, offline round-trip,
two-context sync convergence) · axe inside Playwright · Lighthouse budgets. Evidence to `docs/evidence/`.

## 8. Ship proof
Pages deploy: `sha256 dist/index.html` before/after must change and the live
`https://schnubsy.github.io/optimo/` must contain a build-id string only the new build has
(`<meta name="build" content="<sha>">`).
