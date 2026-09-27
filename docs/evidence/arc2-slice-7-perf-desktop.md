# perf.spec.ts — 2026-09-27T20:47:40.229Z

day switches (ms): 9.3, 7.3, 8.4, 8.5, 9.1, 11.3

filter (ms): 1.3, 1.0, 0.3, 1.1

| budget | measured | limit | result |
|---|---|---|---|
| day view ready after data (max of 6 day switches) | 11.3 ms | < 200 ms | 🟢 |
| inbox filter → rendered (max of 4 queries over 1262 items, 937h45) | 1.3 ms | < 50 ms | 🟢 |
| drag: 60 pointer moves, long tasks > 50 ms | 0 | 0 | 🟢 |
| drag moves the slab by transform only | yes | yes | 🟢 |
| rAF frames delivered during the drag | 60 | — | info |
| library | 5200 rows (5 000 tasks + 200 series) + 670 calendar events | 5 200 + 670 | 🟢 |
