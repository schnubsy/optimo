# plan-day — deployed 2026-10-09 by Code via the claude.ai Supabase connector (arc 6 slice 8)

| | before | after |
|---|---|---|
| version | 6 | **7** |
| ezbr_sha256 | `087d34a0829e738dab2123694158b4db191f855df4d11d4dbdb71b69b9e70b83` | **`aab12198185a07c555844278539e217094d6b0c437ac1f26207d5300503fbc19`** |
| verify_jwt | true | true |
| files | plan-day/index.ts · _shared/plan.ts · deno.json | same set (import map deno.json) |

Uploaded from the repo at the slice-8 commit (sha256 of the sources: index.ts `2fa7aa6f14405f56…`,
_shared/plan.ts `4142e00c79029d5f…`, deno.json `138eb6ca7f9c3cc6…`).

Live checks (no user data touched, no model call made):
- POST without a JWT → **401** (gateway, verify_jwt).
- POST `{action:'subtasks', title:'smoke'}` with the project's publishable key (a valid JWT that is not a user) →
  **401 `{"error":"Sign in first."}`** — the handler's own answer, so the v7 module (with the subtasks action) boots.
- The subtasks path itself is proven hermetically: deno tests (plan_test.ts, 20/20) + Playwright through the real
  handler behind the fake gateway (tests/wizard.spec.ts › AI subtasks). Mark's first real sparkle tap is the live call.
