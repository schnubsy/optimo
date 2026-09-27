# optimo — Eye FULL review · recommendation (2026-09-27)

Marlowe Holm, Creative Director. Six directions, one Flow pass each, project-weighted rubric:
register fit 30 · legibility at 5-min granularity & mobile 25 · originality 20 · buildability incl. dark 15 · motion 10.

## Scores

| Rank | Direction | Seat · movement | Register | Legibility | Originality | Build | Motion | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | **Gelateria** | Vogue · Editorial (pop-editorial) | 9 | 8 | 8 | 9 | 7 | **83.5** |
| 2 | **Meadow** | Calm · Organic / Calm-tech | 9 | 7 | 7 | 9 | 8 | **80.5** |
| 3 | Bauklotz | Steel · Bauhaus | 8 | 8 | 9 | 9 | 5 | 80.5 |
| 4 | Fahrplan | Grid · Swiss / International | 6 | 10 | 7 | 10 | 6 | 77.0 |
| 5 | Prism | Neon · Glassmorphism (daylight) | 9 | 6 | 8 | 6 | 9 | 76.0 |
| 6 | Orchard | Cupertino · Apple HIG idiom | 7 | 9 | 5 | 9 | 7 | 74.0 |

Runner-up tie broken for Meadow over Bauklotz: the brief's word "bubbles" and the 25-weight on mobile
legibility favour touchable pills over a full day of solid fills (Flow's open item on Bauklotz).

## The pick — Gelateria (Vogue · Editorial)

Sherbet-tinted 16px blocks with same-hue ink text (≈10:1 light / ≈9.3:1 dark), a 28px icon chip in the
block's top-right corner, italic Libre Caslon Display hour numerals in the gutter, Karla for everything you
touch, a dotted connector with an italic "1 h 15 free" between blocks, an ink now-line, one mango accent.
It is the only direction scoring 8+ on every weighted criterion; it answers Mark's sentence literally
(colour-coded blocks, a line between them that names the free time) in a bright register that stays
grown-up; and it is a tokens + CSS change on the existing components — no new layout engine.
Flow's five flows pass with two addressed items (44px resize band with a bottom-edge pill handle that
commits `duration_min` only; the gap label as a create target) and one accepted trade-off (chip hides
below 25 min; single-line pill).

## Runner-up — Meadow (Calm · Organic)

Same tint/ink system in full-width pills (radius 22, min 32px), chip at the left end, an elapsed
tone-sweep on the running pill, a dotted sage stem with a leaf-green "1h 15m free" label, one family
(Nunito Sans). Closest in spirit to the Structured feel Mark referenced; costs proportionality under
25 minutes (short items stack, "+n" cluster).

## What Mark should look at to decide

1. Desktop Gelateria vs Meadow hero mocks in `presentation.html` — is an italic serif in the gutter a
   voice he wants to see every morning, or does he want the rounded-sans softness of the reference?
2. The free-time connector in each: dotted rule + italic duration (Gelateria) vs sage stem + pill (Meadow).
3. The 15-minute standup and 10-minute dentist call in both mocks — the short-block behaviour is the
   real difference at 5-min granularity.
4. Optional hybrid: Gelateria's palette and blocks with Nunito Sans instead of Caslon + Karla — two token
   lines (`--font-display`, `--font-ui`); lower risk, less memorable.

## Originality statement — Gelateria (exact)

Blocks are rounded rectangles with the icon chip inside the block (top-right), never circles on a spine;
there is no circular progress fill (running = 2px ink outline + "now" chip); free time is a dotted
connector labelled with a duration, never a prompt sentence; the accent is mango, never pink; week view is
compact tinted blocks, not icon stacks; no Structured naming, glyphs, illustrations or copy. Versus the
category: not Tiimo (no illustrated icon library, no ring/timer hero), not Amie (no emoji identity, radius
16 not pill, no bouncy springs), not Google Calendar (tints not solid fills, no tonal containers), not
Apple Calendar (chip inside the block, no left bar, no glass over content, ink now-line not red), not
Akiflow/Routine (no command bar or console), not Sunsama (no kanban), not Notion Calendar (no monochrome).

## Handoff

- `tokens-gelateria.css` · `spec-gelateria.md` · `design-system-prompt.md` (winner)
- `tokens-meadow.css` · `spec-meadow.md` (runner-up)
- `presentation.html` (all six, Flow findings, matrix)

Risks: **P0** resize-by-edge must commit `duration_min` only and persist — a vitest + Playwright case is in
the prompt. **Watch** Libre Caslon italic at 16px on iPhone (verify hinting on device; fall back to 18px).
**Watch** dark-mode tint separation — the 1px inset ring is mandatory. **OK** Karla lacks `tnum` in some
builds — the prompt sets `tabular-nums`; verify in the font specimen and fall back to `font-feature-settings:
"tnum"` if needed.

Pending: this pack was produced without a live STEP 5 pause (sub-agent surface). Mark's pick is final; if
he chooses other than Gelateria/Meadow, re-run STEP 6 for that pair.
