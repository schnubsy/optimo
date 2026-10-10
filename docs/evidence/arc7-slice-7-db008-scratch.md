# Arc 7 slice 7 — db/008_inbox_first.sql on a PGlite scratch (no server touched)

Harness: `scripts/db-scratch.mjs` (PGlite 0.5.8 + pgcrypto, Supabase-shaped role / auth / press stubs). It applies
db/001, 002, 004, 005 (003 is pg_cron/vault only), writes arc-5a-era client data for two accounts, applies db/006 twice,
then **section 8 (new): db/007 + db/008 each twice** and arc-7 client-shaped upserts.
Run twice back to back on 2026-10-09 (cloud session), identical output: **GREEN, 55 PASS, 0 FAIL**.
Command: `PGLITE=<dir containing node_modules/@electric-sql/pglite> node scripts/db-scratch.mjs`.
Not applied to `press` — the orchestrator applies 008 through the Supabase connector.

What section 8 proves: 008 is idempotent; existing rows read the defaults with no version bump and no sync-log rows
(`add column … default` fires no trigger); `planner_merge()` merges the three columns field-level with no change to it
(an older place decision loses both place fields; a mixed someday + plan_date merge is stored, never rejected — hence no
cross-column CHECK); a pre-008 client's upsert keeps them and their field_ts; `plan_date` is a real `date`.

## Output (run 2, section 8; lines 1–44 are the unchanged 006 checks, all PASS)

```text
applied db/001_planner.sql
applied db/002_calendar_push.sql
applied db/004_ai.sql
applied db/005_calendar_twoway.sql
pre-006: tasks max(version)=1, sync_log rows=11
… 39 × PASS (db/006 twice, backfill, family flag, people policies — as in arc5a-slice-5-db006-scratch.txt)
PASS  db/007_task_tz.sql run 1 applied clean
PASS  db/007_task_tz.sql run 2 applied clean
PASS  db/008_inbox_first.sql run 1 applied clean
PASS  db/008_inbox_first.sql run 2 applied clean
008 columns: estimated boolean null=NO default=true · plan_date date null=YES default=null · someday boolean null=NO default=false
PASS  008 columns have the documented types / nullability / defaults
PASS  every existing row reads plan_date null · someday false · estimated true
PASS  007/008 fired no merge trigger (version unchanged)
PASS  007/008 wrote no sync-log rows
PASS  no cross-column check on someday / plan_date (a field-level merge can never be rejected)
PASS  planForDay upsert merges: plan_date lands, version bumps
PASS  an older place decision loses field-level (plan_date kept, someday stays false)
PASS  a field-level mix (someday + plan_date) is stored; the client derives Someday
PASS  estimated merges like any field
PASS  a pre-008 client's upsert keeps plan_date / someday / estimated and their field_ts
PASS  plan_date is a real date: 'next tuesday' is rejected
PASS  every accepted write logged once for the pull

RESULT: GREEN
```
