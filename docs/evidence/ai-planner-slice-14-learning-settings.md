# ai-planner slice 14 — learning + Settings → Planning

- **Learning.** Accepting a plan (all, some, or after edits) fires plan-day `learn` with the accepted task ids, the
  before/after of every edited block and the blocks left out (`src/plan/actions.ts`). It is best effort: a failure is
  silent. The server distils the style into `planner_ai_profile`, which syncs down like any row.
- **Settings → Planning** (`src/plan/PlanningSettings.tsx`, one card in Settings):
  - "Plan tab starts in": Propose — review first / Auto — write the day, with Undo (`settings.data.plan_mode`, synced).
  - "Web research": Off / On by default (`plan_research`).
  - "What optimo has learned": a read-only plain-words summary of the profile (day shape, focus block length, buffers,
    tone, habits, avoid) with its provenance ("From n accepted plans").
  - Reset tombstones the profile row through the outbox; the next accept starts a fresh one server-side.
- The Plan tab derives mode/research from settings until a choice is made on the tab. Settings may load after the
  tab mounts, so they are not frozen into initial state.

Tests:
- `tests/planning.spec.ts` (desktop + iPhone 15): default mode + research persist to the server's settings row and
  survive a reload (the Plan tab opens in Auto, research checked, "Plan my day"). Accept → `learn` 200 → the
  summary shows the distilled style. Reset → "Nothing yet" + server `deleted_at` set.
- `tests/unit/ai.test.ts`: `learnedLines` (plain words, empty fields left out) and the `resetAiProfile` tombstone.

Evidence: `ai-planner-slice-14-planning-settings-{desktop,iphone-15}.png`.

Gauntlet `ai-planner-slice-14` (20261003-072440) — GREEN: vitest 340 · deno · both secret gates · Playwright 209
(desktop + iPhone 15, axe) · Lighthouse 100/100 · 98/100.
The run before it (07:19) was red. The machine was in a macOS daemon respawn storm from about 04:40 to 07:20
(load 60–180, 70 `xpcproxy` in flight, vitest unable to start workers), with no process of ours running. Every
red run in that window was environmental and was re-run once the machine was quiet.
