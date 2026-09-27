# perf.spec.ts — 2026-09-27T01:09:41.814Z

day switches (ms): 14.5, 8.5, 10.5, 11.8, 12.2, 1.6

filter (ms): 1.2, 1.2, 0.3, 1.0

| budget | measured | limit | result |
|---|---|---|---|
| day view ready after data (max of 6 day switches) | 14.5 ms | < 200 ms | 🟢 |
| inbox filter → rendered (max of 4 queries over 1262 items, 937h45) | 1.2 ms | < 50 ms | 🟢 |
| drag: 60 pointer moves, long tasks > 50 ms | 0 | 0 | 🟢 |
| drag moves the slab by transform only | yes | yes | 🟢 |
| rAF frames delivered during the drag | 60 | — | info |
| library | 5200 rows (5 000 tasks + 200 series) | 5 200 | 🟢 |
