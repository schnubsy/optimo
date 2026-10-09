## 2026-10-09 — Arc 7: Inbox-first — cloud home, bug sweep, readable week, capture → process → paint

Branch `arc/inbox-first`, run from a **cloud session** (first arc built without the Mac). Mark's decisions (2026-10-09
checkpoint): **1** cloud is primary — GitHub holds everything, the Mac only pulls · **2** inbox processing buckets =
**Today · a day (untimed) · Someday** · **3** restore: readable week, iPhone inbox count, schedule/unschedule switch in
the editor (priority/subtask progress on the spine NOT restored) · **4** one arc, bugs first, then restore, then capture.
Product direction (Mark): capture is frictionless like a to-do inbox — no when / how long needed. Processing the inbox
later gives each item a day (or Someday) and maybe an estimate; then it is painted onto the timeline (drag, AI, or
manual edit). **iPhone = today companion** (track today, capture). **Desktop = plan the week.**
Evidence for the bug list: QA walk 2026-10-09 (cloud, Chromium; iPhone emulated at 402×874 + 393×852, desktop at
1024/1280/1440) — reports summarised in `docs/evidence/arc7-qa-baseline.md`.

RULE: one segment map stays the only minute↔pixel conversion on the spine (arc 6 rule) — every fix routes through it.
RULE: `db/008_inbox_first.sql` is additive only (new nullable / defaulted columns); applied via the Supabase connector
inside the order, proof in evidence. No destructive SQL.
RULE: a task's place is derived, never stored twice: `start_at` set ⇒ scheduled; else `someday` ⇒ Someday; else
`plan_date` set ⇒ "to place" on that day; else ⇒ Inbox. Moving between states clears the fields that no longer apply.
RULE: cloud mode — `PW_CHROMIUM` runs both Playwright projects on the cloud's Chromium; the gauntlet sets it itself.
Anything only real Safari can prove goes on Mark's on-device list in HANDOFF.

=== SLICE 1 — Cloud home ===
Done (this session): repo cloned from GitHub; Mac-only HANDOFF line + verify-2026-10-09 note committed; cloud mode in
`playwright.config.ts` + `scripts/gauntlet.sh` (Chromium path, CHROME_PATH for Lighthouse, deno via npm);
CLAUDE.md "Stack & how to run" gains the cloud workflow. Baseline gauntlet in cloud mode recorded.

=== SLICE 2 — Day timeline layout bugs ===
Overlap groups: each task's title/meta sits beside its own disc/capsule (never stacked at the group top); its ring
is on its own row; no ring maps to another task; titles get the remaining width (no 91 px squeeze, no mid-word clip of
the time line). Rail labels: no clipping at the left edge, no duplicates, ≥ 28 px apart. Calendar events: tappable
(44 px hit area) with their title beside them. A long task no longer covers the "Lights out" bookend. All-day chips
clear of the panel grabber; collapsed panel peek shows the first row, not the all-day strip.
Done: Playwright on both projects with the QA's overlap seed (9–11, 9:30–13:30, 11:00, 12:15 event, 13:00) asserts
each ring's row contains its own title, ring centres ≥ 44 px apart, labels' left ≥ panel left; evidence PNGs.

=== SLICE 3 — Chrome, wizard, settings bugs ===
Desktop header wraps / collapses at 1024 (AI + Settings always on-screen). Wizard: the primary action (Continue /
Create / Save) is always visible (sticky footer) on both projects incl. 1280×800 and 402×874 with safe areas; desktop
wizard sized for desktop (not cut at 800 tall). Settings inputs fit their cards at all widths. iPhone: the date header
+ strip hide on AI and Settings. Header ‹ › step by week in Week and by month in Month; no duplicate arrows.
Segmented control shows no false "Day" on Plan/Settings (#52). Time-zone search ranks prefix/city matches first and has
no double border. Duration "Reset" passes contrast. Escape in a child sheet closes only that sheet. Inbox wizard offers
no timed suggestions. Completion toast names the task.

=== SLICE 4 — Drag accuracy ===
Drops land where the pointer is (inbox → timeline, week drops, day drags), ± one snap. Auto-scroll only near the
edges and speed-limited. The drag card shows the live start time; the ghost label never sits on an hour label.

=== SLICE 5 — Readable week ===
Desktop week columns (and iPhone overview when wide enough) show title + time per task when the column is ≥ 110 px,
overlaps side by side, a per-day "Xh planned · Yh free" line, the now-line on today, all-day items and calendar
events. Week day headers are drop targets for "plan for this day" (slice 9).

=== SLICE 6 — Restore: inbox count + schedule switch ===
iPhone Inbox tab shows a count badge (inbox items, not "to place"). Editor ③ gets a one-tap place control: Inbox ·
Today · pick day · Someday · Timeline (time) — replaces the inert "Inbox" row.

=== SLICE 7 — Data: plan_date, someday, estimate ===
`db/008_inbox_first.sql`: `planner_tasks.plan_date date null`, `someday boolean not null default false`,
`estimated boolean not null default true` (false = no estimate yet; `duration_min` still holds the default used when
painting). Dexie v5 (index `[_kind+plan_date]`), `taskKind` adds `planned` and `someday`, repo actions
`planForDay(id, date)`, `toSomeday(id)`, `toInbox(id)`, `setEstimate(id, min|null)`, scheduling clears plan_date/someday.
Sync + export carry the new fields; fake Supabase knows them. Unit tests for every transition. spec §2.1/§5.1 updated.

=== SLICE 8 — Capture + inbox processing ===
FAB (iPhone) and `N`/header command line (desktop) open a one-line capture: type, Enter → Inbox, untimed, no estimate,
field stays open for the next item. A parsed time/date still schedules or plans (parser kept) — shown as a chip before
Enter. "Details…" opens the full wizard. Inbox rows get quick process actions: Today · Tomorrow · Pick day · Someday ·
estimate chips (15/30/60/90/—). Someday is a collapsed section under the inbox.

=== SLICE 9 — "To place" trays + painting ===
Day view (both): a "To place" tray above the timeline lists that day's planned items (overdue unfinished ones roll to
today's tray). Drag a tray item onto the timeline → scheduled (estimate or default length); Place → earliest free slot;
"Fit with AI" opens the AI tab with the tray items as the intent. Desktop week: a tray above each column; drag inbox /
tray items between days or onto a time. iPhone Timeline is today-first.

=== SLICE 10 — Gauntlet, QA re-walk, PR ===
Gauntlet green in cloud mode (environment-only failures listed, not hidden); QA re-walk on both projects vs the
baseline list; PR → merge → ship proof; HANDOFF lists Mark's real-iPhone checks.
