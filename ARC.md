## 2026-10-03 — arc 3: AI planner (Plan tab)

Ratified by Mark (kickoff 2026-10-03):
- **Mode:** Propose is the DEFAULT (draft plan → accept all / accept some / edit / reject). Mark can switch a request
  to **Auto**, which writes the day straight into the timeline with a one-tap Undo. Default is a Settings preference.
- **Learning ships now:** accepted/edited plans distil into `planner_ai_profile` (tone, day shape, block lengths, buffers, habits).
- **Web research ships now:** optional per request (Anthropic server-side web search), sources shown with the plan.
- **Housekeeping first:** Pages `paths-ignore`, stale CLAUDE.md stage, snags #29–#37.

RULE: Originality gate holds — no other planner's look, copy, icons or naming in the Plan tab.
RULE: Only publishable keys in the client. The model call lives in an Edge Function using the project secrets
      `ANTHROPIC_API_KEY` (already set on `press`) and optional `PLANNER_MODEL` (default `claude-sonnet-5-5`). No new secret.
RULE: DDL channel — `db/004_ai.sql` (INBOX FILE, uncommitted in the main checkout) is committed UNCHANGED; Code never
      applies it. Edge Function deploy is Cowork's. Both are close-out manifest items marked BLOCKED → Mark's manual steps.
RULE: The Plan tab must degrade cleanly when the function/tables are not live yet ("Planner isn't connected yet"),
      so merging + Pages deploy before the Cowork apply/deploy is safe.
RULE: Privacy — send the model only what planning needs (titles, times, durations, categories, priorities); never
      calendar credentials, notes bodies or device ids.
RULE: Challenge-style prompting (Ear register): flag overcommitment, missing buffers and conflicts; ask ≤3 questions;
      never just agree.

### Slice 1 — housekeeping
Scope: `.github/workflows/pages.yml` gains `paths-ignore: [docs/**, '**/*.md', ARC.md, HANDOFF.md]`; CLAUDE.md
"Current stage" corrected (snag train merged e17b434, live; arc 3 in progress).
Done: workflow lint passes; a docs-only test commit on the branch does not match the deploy filter (evidence: the filter
diff + reasoning); CLAUDE.md stage no longer says "PR open".
Status: done 3977543

### Slices 2–10 — snags #29–#37 (one slice per Issue, train rules)
Scope: each open `snag` Issue #29…#37 in order; done-criteria = the Issue's acceptance; commit carries `Fixes #n`.
Independent → may run as parallel sub-agents. Issues close only via the merged PR.
Status: done — 2 #29 875e12d · 3 #30 7933f86 · 4 #31 f755cd9 · 5 #32 3a5bb72 · 6 #33 3e0c259 · 7 #34 a9806a0 · 8 #35 8aa0dcd · 9 #36 a4a89a0 · 10 #37 d4e47ba

### Slice 11 — data layer
Scope: commit `db/004_ai.sql` unchanged; add `planner_ai_plans` + `planner_ai_profile` to the Dexie schema, types and
the outbox/pull sync (same field-level merge as every other table, spec §5). Spec §3/§5 updated for both tables.
Done: unit tests cover round-trip + merge for both tables; 5k-task perf budget unchanged.
Status: done 8a32373

### Slice 12 — Edge Function `plan-day`
Scope: `supabase/functions/plan-day/` as a `Request → Response` handler over a ports interface (lessons 2026-09-27),
`verify_jwt = true` in `supabase/config.toml`. Actions:
- `propose` {date, intent, mode, research:boolean} → loads that day's tasks, events, categories, settings and the
  profile for the caller (RLS via the caller's JWT) → Anthropic Messages API, structured output via a single tool
  schema `{blocks:[{title,start_at,duration_min,category_id?,priority?,why}], questions:[≤3], notes}`; when
  `research` is true, enable the server web-search tool (max 3 uses) and return citations → upsert a
  `planner_ai_plans` row (`status: draft`, `model`, `research`).
- `learn` {plan_id, accepted_task_ids, edits} → distils the diff between proposal and what Mark kept into
  `planner_ai_profile.data` (small model call; bumps `accepted_count`).
Guards: 30 calls/user/day (count today's plans) → 429 with a friendly message; timeout + one retry; never log intent text.
Done: deno unit tests for both actions with a fake Anthropic port (incl. research on/off, 429, malformed model output);
the hermetic Playwright fake runs the same handler in-process; secret gate green.
Status:

### Slice 13 — Plan tab
Scope: replace `RESERVED_AI_TAB` (`src/chrome/TabBar.tsx`) with the Plan view: intent box, day picker (today /
tomorrow / date), mode switch (Propose default / Auto), research toggle. Propose → ghost blocks on the day timeline,
each with its "why", conflicts with existing tasks/events marked; Accept all · tick to accept some · edit a block
before accepting · Reject. Accepted blocks become normal tasks through the outbox. Auto → tasks written at once,
toast with Undo (tombstones exactly those tasks). Questions from the model shown above the plan, answerable inline
(re-plan). Offline or function unreachable → disabled with "Planner isn't connected yet / you're offline".
Done: Playwright desktop + iPhone 15 (axe) cover propose→accept-some, edit→accept, auto→undo, research citations,
not-connected state; screenshots to evidence.
Status:

### Slice 14 — learning + settings
Scope: accept/edit fires `learn`; Settings → "Planning" section: default mode (Propose/Auto), research default,
read-only "What optimo has learned" summary from the profile, Reset (tombstones the profile row).
Done: tests cover default-mode persistence, learn call on accept, reset.
Status:

### Slice 15 — design review (Eye LITE) · Slice 16 — Lighthouse budget
Standard UI-arc slices (arc.md). Only 🔴 P0 findings are actioned in-arc; the rest filed as `snag`.
Status:
