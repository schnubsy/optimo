# ai-planner slice 12 — Edge Function `plan-day`

**Shape.** `supabase/functions/_shared/plan.ts` holds `handlePlan(Request, PlanPorts) → Response` (lessons 2026-09-27:
runtime-neutral handler over ports, no TS parameter properties). Three callers run the same code:
- the Deno entry `plan-day/index.ts`,
- the deno tests,
- the hermetic Playwright server (`tests/support/fakeSupabase.ts`).

`supabase/config.toml`: `[functions.plan-day] verify_jwt = true`.

**Deno entry.** supabase-js with the anon key **plus the caller's JWT**, so every read and write goes through RLS.
The model call uses `npm:@anthropic-ai/sdk@^0.131.0` with `ANTHROPIC_API_KEY` (already on press) and optional
`PLANNER_MODEL` (default `claude-sonnet-5-5`). The SDK has a 45 s timeout and no SDK retries; the handler retries
once on 429/5xx/timeout. Server-side refusal fallback (`fallbacks: "default"`) is on for the models that accept it.
No new secret.

**`propose`** {date, from, to, tz, intent, mode, research, plan_id?, answers?}
- Reads that day's tasks, events, categories, settings and profile: titles, times, durations, categories and
  priorities only. No notes, credentials or device ids.
- One strict tool, `submit_plan`: `{blocks[{title,start_at,duration_min,category_id,priority,why}], questions ≤3,
  notes}`, with `tool_choice: auto` (forced tool choice is a 400 on the current models) and an Ear-register system
  prompt: flag overcommitment / buffers / conflicts, never just agree.
- Research adds `web_search_20260209` (max_uses 3). The handler resumes over `pause_turn` by re-sending the paused
  assistant turn, with no extra user message. Sources come from `web_search_tool_result` and snippets from the
  citations.
- Output is validated: local times are mapped to UTC from the client's local midnight, malformed blocks are dropped,
  and a malformed whole returns 502.
- Upserts a `planner_ai_plans` row (status `draft`, `model`, `research`, field_ts stamped).

**`learn`** {plan_id, accepted_task_ids, edits, rejected}: `claude-haiku-4-5` with a forced `save_profile` tool
distils the diff into `planner_ai_profile.data` and bumps `accepted_count`. After a Reset (tombstone) it starts fresh
on the same row.

**Guards**
- No or bad JWT → 401.
- 30 plans per user per day (counted by uuid v7 id ≥ the UTC-day floor) → 429 with a friendly message. Re-planning an
  existing plan is not counted.
- One retry.
- The intent is never logged; only the failure class is.
- planner tables missing → 503 `not_connected`, which the client shows as "Planner isn't connected yet".

**Tests**
- deno (`_shared/plan_test.ts`, fake Anthropic port `tests/fake/planPorts.ts`):
```
propose: a draft row with local times turned into UTC, the challenge notes, no research ... ok (14ms)
propose with research: resumes over pause_turn and returns cited sources ... ok (582µs)
the 31st plan of the day is a 429 with a friendly message; re-planning an existing plan is not counted ... ok (3ms)
malformed model output is a 502 and stores nothing ... ok (402µs)
a plain-text answer gets one nudge, then the tool call lands ... ok (240µs)
one retry on 529/timeout; a 400 is not retried; the intent never reaches the log ... ok (625µs)
learn distils into the profile with the small model and bumps accepted_count ... ok (398µs)
no JWT is a 401; bad input is a 400 ... ok (170µs)
missing planner tables are a 503 not_connected, not a crash ... ok (136µs)
ok | 9 passed | 0 failed (21ms)
```
- Playwright (`tests/planfn.spec.ts`): the real handler in-process behind `/functions/v1/plan-day`. propose returns
  a draft row that syncs down to Dexie through the sync log; learn writes the profile; no JWT → 401; no unexpected
  requests.
- Gauntlet: the deno step now type-checks `plan-day/index.ts` (SDK included). A new secret gate checks that no
  `sk-ant-…` appears in dist, the evidence or tracked files.

Gauntlet `ai-planner-slice-12` (20261003-040951): GREEN. The first run lost two specs to the browser being killed
externally.

Close-out: deploying `plan-day` is Cowork's job (BLOCKED → HANDOFF step).
