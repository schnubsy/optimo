# perf.spec.ts — 2026-10-09T18:14:58.498Z

day switches (ms): 7.1, 2.0, 7.0, 9.7, 8.4, 8.8

filter (ms): 1.3, 1.0, 0.6, 1.0

| budget | measured | limit | result |
|---|---|---|---|
| day view ready after data (max of 6 day switches) | 9.7 ms | < 200 ms | 🟢 |
| inbox filter → rendered (max of 4 queries over 1262 in inbox · 937h45) | 1.3 ms | < 50 ms | 🟢 |
| day view ready after data (median of 6, arc 6 spine) | 8.4 ms | ≤ 50 ms | 🟢 |
| drag: 60 pointer moves, long tasks > 50 ms | 0 | 0 | 🟢 |
| drag frame time p95 | 16.7 ms | ≤ 20 ms | 🟢 |
| drag moves the slab by transform only | yes | yes | 🟢 |
| rAF frames delivered during the drag | 60 | — | info |
| library | 5200 rows (5 000 tasks + 200 series) + 670 calendar events | 5 200 + 670 | 🟢 |
