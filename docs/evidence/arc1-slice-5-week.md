# arc1 · slice 5 — recurrence, week + month, subtasks/reminders, settings, focus (2026-09-26)

## Gauntlet (`scripts/gauntlet.sh arc1-s5`, 20260926-200406) — GREEN
- 🟢 unit (vitest) — 71 tests at gauntlet time (+2 reminders after: 73). recurrence.test (TZ pinned to America/New_York
  so DST is exercised): daily · weekday · weekly · monthly · 09:00 wall-clock held across DST · UNTIL ·
  skip · override replaces and moves an occurrence · tombstoned exception ignored · "this" override + per-occurrence
  completion · delete = skip · "this & following" split (UNTIL on the old series, new series from the occurrence) · "all"
- 🟢 build (vite)
- 🟢 playwright smoke + axe (desktop, iPhone 15) — 45 passed, 17 skipped (desktop-only / evidence-only / @real)
- 🟢 lighthouse desktop perf=100 a11y=100 · mobile perf=98 a11y=100

## week.spec.ts — desktop + iPhone 15
- week: 7 columns, planned/free per day in the header; drag Lunch into the neighbouring column → start_at ±24 h exactly (time kept); axe clean
- theme: Settings → Light → Dark; `<html data-theme>` follows; **persists across reload** (pre-paint localStorage + synced settings row)
- recurrence e2e: "Stand-up every day at 9:15am for 15m" → rest of this week + 7 next week; completing today's occurrence
  marks only that one (1 exception row)
- month: dot density (10-task day → `data-count=10`), tap jumps to the day view; axe clean
- focus: timer ticks, +5 min → 95, Complete returns to the day and completes the task; axe clean
- export/import (desktop): JSON has 14 tasks + 8 categories; importing the older file keeps a newer local edit (same LWW as sync)

## Screenshots
`arc1-slice-5-{week,month,focus,settings}-{desktop,iphone-15}.png`
