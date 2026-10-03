# ai-planner — sentry (security pass) before the PR

**Required step: secrets scan of the arc diff** (`31f7d10..HEAD`: 90 files, +3068 lines; 3096 added lines scanned,
PNG and lock files excluded). No secret values were found.

| pattern | hits |
|---|---|
| Anthropic key `sk-ant-…` | 0 |
| JWT `eyJ….….` (incl. service-role / anon JWTs) | 0 |
| AWS `AKIA…` · GitHub `ghp_` / `github_pat_` · Slack `xox?-` | 0 |
| PEM private key | 0 |
| `api_key/secret/password/token = "…"` literals | 0 |
| `SUPABASE_SERVICE_ROLE_KEY` | 0 |
| `service_role` | 2: the role name in `db/004_ai.sql` GRANTs (control-files rule: grant to authenticated, service_role) |
| test app-specific password fixture | 0 |

- GitHub secret scanning on `schnubsy/optimo`: 0 alerts.
- Gauntlet secret gates (every slice from 12 on): no `sk-ant-` in `dist/`, `docs/evidence/` or tracked files, and
  no fixture password.
- Dependencies: `npm audit --omit=dev` found 0 vulnerabilities. Deno adds `npm:@anthropic-ai/sdk@^0.131.0`, which is
  server-side only and never bundled into the client.

**Threat sketch: the AI planning layer**

| | |
|---|---|
| Data held | `planner_ai_plans` (intent text, the proposal, cited source URLs/snippets, model id) and `planner_ai_profile` (the planning-style summary). Both use own-row RLS (`user_id = auth.uid()`), sync cols and the merge/log triggers (004). |
| Flows | The client posts to `plan-day` with the user's JWT (`verify_jwt = true`). The function reads and writes through supabase-js **with the caller's JWT** (anon key + Authorization), so RLS scopes every query; the service role is not used. The Anthropic API gets titles, local times, durations, category names, priorities, event titles/times and the profile. Never task notes, calendar credentials, device ids or emails. The intent text goes to the model and the plan row, **never to logs** (failure class only, tested). |
| Secrets | `ANTHROPIC_API_KEY` (and optional `PLANNER_MODEL`) live only in Edge Function secrets, already set on press. No new secret. The client still ships only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. |
| Abuse limits | 30 plans/user/day (429), intent ≤ 4000 chars, ≤ 3 web searches per plan, one retry, 45 s per model call. |
| Blast radius | A leaked user JWT exposes only that user's plans/profile (RLS) and spends at most 30 model calls per day. Web-research sources are external URLs, rendered as plain links (`rel="noopener noreferrer"`, `target=_blank`) and never fetched by the client. Model output is validated server-side (times clipped to the day, category ids checked against the user's own, strings length-capped) and rendered as text, never HTML. |
| Verified vs inferred | Verified by tests: RLS-scoped port shape (code), no-intent-in-logs, 401 without JWT, 429 limit, malformed output → 502. Inferred, not live-tested here: production RLS on the two new tables. That is Cowork's postcondition after applying 004 (1 policy per table, RLS on). |

**Verdict: 🟢 sentry green.** Gauntlet green at `ai-planner-slice-16` (20261003-072711), so both ship gates are green.
