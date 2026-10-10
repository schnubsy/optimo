# Arc 7 — db/008_inbox_first.sql applied (2026-10-09, cloud session, Supabase connector)

- Applied as migration `optimo_008_inbox_first`, version `20261009225222`, project `press` (eepjhpyziczrxvirczio).
- Body = db/008 minus the begin/commit wrapper (the connector wraps its own transaction). Additive only.
- Postconditions:
  - estimated | boolean | NO | true · plan_date | date | YES | null · someday | boolean | NO | false  ✓
  - rows with plan_date / someday / not estimated right after apply: 0  ✓
