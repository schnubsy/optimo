# Arc 2 · slice 2 — FINAL design system (Meadow hybrid, pastel edition)

Implements `docs/design/2026-09-27-final/design-system-prompt.md` §1–3 (presentation only; data/sync untouched).

- `src/styles/tokens.css` = `docs/design/2026-09-27-final/tokens.css` **byte-identical** (`cmp` clean).
- `src/styles/tokens-a11y.css` — measured corrections, not taste: the spec's §12 table estimated ratios from OKLCH L;
  culori measures `--done-ink` on `--done-fill` at 3.97:1 (light) / 4.12:1 (dark) → 0.51 / 0.66 (4.70 / 4.82:1), and
  `--ink-3` on canvas at 3.69:1 → text uses `--ink-2`; `--ink-3` stays for decorative marks. axe agreed with culori.
- Nunito Sans 400/600/700/800 (Google Fonts), theme-color meta per scheme, light is the base theme, `system` follows
  `prefers-color-scheme`, `data-theme` driven by the synced setting.
- Timeline: pastel pill (radius min(22px, h/2); thin pills one line), **chip = complete control** (aria-pressed,
  "Mark {title} done", Undo toast; X on a focused pill; long-press / right-click → category picker), priority = 2px
  ring on the chip, elapsed tone-sweep, done = neutral fill + strike + check glyph, dotted free-time rule with the
  sage "1h 15m free" label and a "+" (gap start, min(gap, default)), "+n" cluster for ≥3 short pills in 30 min, now
  line with a gutter time pill, dashed hour lines, 72/66 px per hour.
- Inbox rows (surface pill, 26px chip opens the editor, meta "Pers, 0:30 · P1", Place pill), editor (24/800 title,
  8 category chips, duration chips, switches, subtask chips — **no checkbox in the DOM**), week compact pills + dotted
  free rules ≥ 45 min, month chip-colour dots (max 4 + "+n"), settings cards, focus, sign-in.

## Tests
- `tests/unit/contrast.test.ts` — 68 cases: 8 hues × 2 themes (pill text on pill + hovered pill, chip glyph on chip)
  and 10 UI pairs × 2 themes, all ≥ 4.5:1, values parsed from the CSS.
- `tests/unit/layout.test.ts` — resize commit writes `duration_min` only (start_at + its field_ts unchanged);
  `clusterShort` (+n).
- `tests/design2.spec.ts` — chip completes + Undo, no checkbox in a pill, X toggles, FreeGap "+" at gap start with
  min(gap, default), "+3" cluster → list → editor, category picker, axe clean in light **and** dark across Day /
  Inbox / Week / Month / Settings / Editor.
- Gauntlet `arc2-s2-gauntlet-20260927-150511` GREEN: vitest · Playwright + axe (desktop, iPhone 15) · Lighthouse
  desktop 100/100, mobile 98/100.

## Evidence
`arc2-slice-2-{day,week}-{desktop,iphone-15}-{light,dark}.png`, `arc2-slice-2-inbox-iphone-15-{light,dark}.png`.
