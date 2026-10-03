# ai-planner slice 13 — the Plan tab

**Entry points.** `RESERVED_AI_TAB = true`: the reserved fourth column of the iPhone tab bar shows **Plan** between
Week and Settings (design spec §5.6), with arrow-key order Inbox → Timeline → Week → Plan → Settings. On desktop, a Plan
button (the in-repo `ui-plan` glyph) sits beside the gear. Quick-add gives up 40px of its minimum width so the sync
badge stays on screen at 1280 (P0-3 guard green).

**View** (`src/plan/Plan.tsx`, `PlanGhosts.tsx`, `plan.css`, `api.ts`, `actions.ts`):
- Inputs: intent box; day picker (Today / Tomorrow / any date); mode (Propose default, Auto; the default comes from
  settings); a web-research switch.
- **Propose:** the plan card shows the model's questions (answerable inline → "Re-plan with answers" re-plans the same
  row), its challenge notes, the block list (tick to keep, Edit title/start/minutes, each block's *why*, "Overlaps …"
  when it clashes with an existing task or event) and sources. The chosen day's timeline gets ghost blocks: dashed,
  tinted by category, clashing ones moved to the right half, unticked ones dotted.
  Actions: **Accept all · Accept n ticked · Reject**. Accepted blocks become ordinary tasks via `repo.createTask` (the
  outbox), the plan row records `status: accepted` + `accepted_task_ids`, and a toast offers Undo.
- **Auto:** the whole proposal is written at once (`status: applied`). Undo tombstones exactly those tasks.
- **Degrades:** no Supabase client, `plan-day` 404 (not deployed) or 503 `not_connected` (004 not applied) →
  "Planner isn't connected yet" with the controls disabled (and Try again). Offline → "You're offline — the
  planner needs a connection". The core sync stays green throughout.
- On iPhone the card scrolls into view when a proposal arrives. Ghosts are decorative (`aria-hidden`); the list is
  the accessible surface.

**Tests** (`tests/plan.spec.ts`, desktop + iPhone 15). The real `plan-day` handler runs in-process with the scripted
model:
- not connected (function missing) — notice + disabled controls, no handler call;
- not connected (004 missing) — 503 → notice, sync badge still "synced", no console errors besides the 503;
- offline → notice, disabled; back online → notice gone;
- propose → untick one → accept some: 3 ghosts, the why and notes shown; 2 tasks created and pushed; plan accepted on
  the server; `learn` fired with 2 accepted + 1 rejected;
- edit → accept: the task carries the edited title/time/duration; `learn` gets 1 edit;
- auto → undo: 3 tasks written at once; Undo leaves only the pre-existing task;
- research: source link + cited snippet shown;
- questions answered inline re-plan the same row (1 row on the server); clash with a seeded task marked;
- axe clean on the Plan view with a proposal open, light + dark.

`tests/chrome.spec.ts` is updated for the fifth tab and the arrow order. `tests/timeline.spec.ts` "drag reschedules"
gets a pinned clock: at 04:30 the 13:00 pill sat on the auto-scroll edge.

Evidence: `ai-planner-slice-13-plan{,-card,-ghosts}-{desktop,iphone-15}-{light,dark}.png`.

Gauntlet `ai-planner-slice-13` (20261003-042854) — GREEN: vitest · deno · both secret gates · Playwright desktop +
iPhone 15 (axe) · Lighthouse 100/100 · 98/100.
