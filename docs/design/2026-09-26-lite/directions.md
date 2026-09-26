# optimo — Eye LITE ideation, 2026-09-26

**Read of the project.** optimo's promise is not a list; it is a day that has already been placed — every task
given a slot, free time visible, slippage honest. The hero job is *placing* (inbox → time, and re-placing
when the day slides), used in two rituals (morning plan, evening reconcile) and dozens of one-thumb moves
between. The quick-add bar is the seed of the later AI layer. Stack: React + Vite, CSS variables, PWA,
60 fps drag, 44 px targets. Three seats, three movements, kits firewalled; Flow reviewed all three.
No design register was reachable on this surface; the collision check ran across this run only.

---

## Direction 1 — Slack Water · Calm (Anaya Shrestha) · Organic / Calm-tech · light
The still point between tides: the day as a soft channel, blocks as river stones, a daylight arc instead
of a countdown. Nothing on screen moves unless you moved it.
- **Palette:** mist #EEF1EF, ink #24302D, sea-glass accent #4E8C82; category tints from kelp, heron,
  lichen, dune, rosehip, pebble, iris. Dark: #161C1B base, #7DB8AD accent.
- **Type:** Newsreader (day, headings, italic gap labels) + Spline Sans (all UI). Rows 72 / 64 px.
- **Flow:** 🟢 create (live chips) · 🟡 drag (fixed: dashed ghost + gutter time) · 🟡 resize (fixed: pill
  handle on hover/selected, 44 px) · 🟢 complete · 🟡 mobile inbox→timeline (fixed: Place = next free slot
  that fits; long-press drag secondary) · 🟡 open: low-chroma palette, ink-2 holds 4.8:1.
- **Best for:** a planner you open to feel calmer than before you opened it.

## Direction 2 — Switchboard · Steel (Viktor Stahl) · Brutalist / Systems-first · dark
A dispatch board: every slab a fact, every free slot a real dashed row you can drop into, a status strip
that never lies (planned, free, done, late, unplaced). One cobalt signal for now, running, and held.
- **Palette:** graphite #212427 / #2A2E32 / #33383D, ink #F1F2F3, signal cobalt #4D7CFF; categories
  deliberately desaturated (#6E8FA8, #8C7FA8, #7FA083, #A89478 …). Light: #E9EBEC base, #2757E6 signal.
- **Type:** Chivo 400/700/900 (UI) + Chivo Mono (time gutter, durations, counters only). Rows 56 / 52 px.
- **Flow:** 🟢 create (command line, parse row, Tab edits) · 🟢 drag · 🟡 resize (fixed: 44 px band on
  selected slab) · 🟢 complete · 🟡 mobile inbox→timeline (fixed: Place slot-picker from real free rows;
  open: no cross-tab drag in v1) · 🟡 density flagged for device check.
- **Best for:** the user who wants to *see* the day's free capacity and treats planning as operating.

## Direction 3 — Issue 269 · Vogue (Coco Belmont) · Editorial / Fashion · light (night edition: true black)
Every day is an issue: full-bleed cover, Bodoni folio hours, typeset entries with a single coloured rule
and no fill, the unplaced list as a contents page. One lipstick red for every act, including the strike.
- **Palette:** paper #FFFFFF, ink #000000, red #C8102E; couture swatches (ink navy #1F2A44, bordeaux
  #6E1E2E, camel #B08A5A, forest #2E5E4E, plum #5A3A63). Night: #000000 paper, #FF2D4D red.
- **Type:** Bodoni Moda (display, never below 16 px) + Work Sans (UI). Rows 84 / 72 px.
- **Flow:** 🟡 create (fixed: rule + red Add + prose read-back) · 🟡 drag (fixed: grip dots, outline lift,
  red ghost) · 🟡 resize (fixed: 3 px rule, 44 px band) · 🟢 complete · 🔴→🟡 mobile inbox→timeline
  (fixed: red Place on every entry; sheet collapses while dragging; needs device test) · 🟡 open: white
  space stands in for free time — quieter than rivals, accepted by the author.
- **Best for:** the user who wants the planner to feel like an object worth opening, and will trade a
  little at-a-glance capacity for it.

---

## Cross-cutting UX opportunities (apply to any direction)
1. **Place, not just drag.** Every unplaced item gets a one-tap Place that fills the earliest free slot that
   fits its estimate; drag stays the power path. This is the single fix that makes mobile work.
2. **Free time as an object.** Model gaps as first-class rows (start, length) — they are what the AI layer
   will fill, what Place searches, and what the day summary counts.
3. **Parse preview before commit.** Quick-add always shows what it understood (chips, a row, or a prose
   read-back) with a one-tap correction; never silently guess a time.
4. **Selected state on mobile.** Tap-to-select unlocks resize handle, done, and drag; keeps 44 px targets
   without cluttering resting blocks. 15-minute blocks render as one line, expand on tap.
5. **Undo everywhere, 5 s.** Complete, move, resize, delete all undoable; no confirm dialogs.
6. **Keyboard map on desktop** (N new, X done, arrows nudge 5 min, Shift+arrow resize, / quick-add).

---

## The Eye's recommendation — Marlowe Holm
**Switchboard (Direction 2).** optimo's whole promise is an *optimal* day, and Switchboard is the only
direction that turns free time and slippage into visible facts rather than empty space — and its command
line is already the AI layer's front door. If it reads too cold after a week of use, Slack Water is the
runner-up: same Place/free-slot model, softer nervous system.

### `src/styles/tokens.css` — Switchboard
```css
:root{
  --font-ui:"Chivo",system-ui,sans-serif; --font-mono:"Chivo Mono",ui-monospace,monospace;
  --fs-10:10px; --fs-11:11px; --fs-12:12px; --fs-13:13px; --fs-14:14px; --fs-16:16px; --fs-20:20px; --fs-28:28px;
  --fw-regular:400; --fw-bold:700; --fw-black:900; --lh-tight:1.3; --lh-base:1.45;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px;
  --r:2px; --border:1px; --border-active:2px; --stripe:4px;
  --shadow:none; --shadow-grab:0 8px 0 rgba(0,0,0,.35);
  --t-state:90ms; --t-sheet:160ms; --t-drag:0ms; --ease:linear;
  --hour-h:56px; --hour-h-mobile:52px; --tap-min:44px;
  --bg:#212427; --panel:#2A2E32; --panel-2:#33383D; --line:#3F454B; --line-strong:#575E66;
  --ink:#F1F2F3; --ink-2:#A6ADB4; --ink-3:#737B83;
  --signal:#4D7CFF; --signal-soft:rgba(77,124,255,.16);
  --cat-work:#6E8FA8; --cat-meet:#8C7FA8; --cat-health:#7FA083; --cat-personal:#A89478;
  --cat-family:#A87F86; --cat-errand:#8A9096; --cat-learn:#A6A07F; --cat-home:#7FA09B;
}
[data-theme="light"]{
  --bg:#E9EBEC; --panel:#F5F6F7; --panel-2:#DFE2E5; --line:#C4C9CE; --line-strong:#9AA1A8;
  --ink:#1A1D20; --ink-2:#4F565D; --ink-3:#7A8189;
  --signal:#2757E6; --signal-soft:rgba(39,87,230,.14); --shadow-grab:0 8px 0 rgba(0,0,0,.18);
}
```

Want any of these taken to a full review? Name it: Slack Water, Switchboard, or Issue 269.
