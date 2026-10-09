# Arc 7 — QA baseline (2026-10-09, cloud, build f153010)

Method: three read-only agents in the cloud session. iPhone: Chromium emulation (isMobile, touch, DPR 3) at 402×874 and
393×852, dark + light, safe-area insets simulated (62 top / 34 bottom); WebKit not available in the cloud. Desktop:
Chromium at 1024×768, 1280×800, 1440×900, dark + light. Hermetic Supabase fake, seeded realistic day. No console errors
in any flow; no horizontal overflow at any size.

## Lost / degraded in arc 6 (audit f488703 → 9b8a3f1)
- LOST — Week: titles/times on tasks (icon discs only), per-day "planned · free" line, side-by-side overlaps
  (`layoutColumns` dropped, every `.wnode` at left:50%), now-line.
- LOST — iPhone inbox count (tab badge + header line).
- LOST — priority + subtask progress + category name on timeline rows; elapsed sweep (now an accent ring).
- DEGRADED — iPhone capture: one line → 3 wizard steps; untimed text no longer defaults to Inbox.
- DEGRADED — schedule/unschedule from the editor (TaskSheet switch gone; ③ shows an inert "Inbox" row).
- DEGRADED — drag-resize only on capsules ≥ 30 min; category change only via ③ palette; iPhone week = icon overview.
- MOVED — Plan → AI tab; Week → panel drag; Month → header title; Focus → ③ / F; TaskSheet fields → wizard ②/③.

## Bugs — iPhone
- P0 Overlap groups: titles stack at the group top, rings at each task's own time → ring beside "Lunch" completes
  Standup (`Timeline.tsx:115-123`, `spine.css:31-38`).
- P1 First all-day chip under the panel grabber (untappable). P1 Collapsed peek shows the all-day strip, not row 1.
- P1 ③ Create/Delete below the fold at 402×874. P1 Rail labels clipped ("l0:00") and duplicated ("4:00" twice).
- P1 Time line clipped mid-word in overlaps. P1 Date header + strip stays on AI and Settings.
- P1 AI tab nests the timeline scroller (#51). P1 Content readable through the tab bar (#70).
- P2 Week overview overlaps drawn on top of each other; iCloud event = 22 px dot, no hit area; sub-44 px targets
  (grabber, Today, all-day chips, gap Add Task, ••• discs); TZ search ranking + double border; ③ time row truncates;
  ••• "Change to All-Day" overflow; Duration Reset contrast (axe serious); Escape in Repeat also opens Discard;
  inbox wizard suggests timed items; bare "Done" toast; unlabeled category discs; duplicate banner landmark.

## Bugs — desktop
- P0 At 1024 wide the AI + Settings buttons are off-screen (`.pane-hdr` no wrap, `.pane-qa` min-width).
- P1 Week unreadable (see LOST) + overlaps hide each other; all-day + events missing.
- P1 Week/inbox drops off target up to 1 h (overlay top edge, not pointer — `Planner.tsx:200-205`).
- P1 Three-way overlap: two rings coincide; clicking one un-completes another.
- P1 Chained overlap: titles stack inside the first capsule; event = blue dot off the spine.
- P1 Rail labels clipped. P1 Wizard at 1280×800: Continue clipped, Create/Delete below the fold, title cut.
- P1 Day drag auto-scroll runs away (threshold 0.15, `Planner.tsx:295`). P1 Settings inputs overflow cards.
- P1 Long evening task covers "Lights out". P1 Plan ghosts cover tasks (#43), false Day segment (#52), "1:30" (#47).
- P2 Header ‹ › step by day in Week/Month (duplicate arrows); Month dots only; 300 px rail truncates titles; empty-day
  "15h 59m"; no hover state; drag card shows stale time, ghost label on hour labels; quick-add placeholder clipped;
  Focus "120:00" + starts 30 min early; now-line through Add Task.

## Environment (cloud)
Playwright 1.63 wants Chromium 1243 / WebKit 2359; the cloud has Chromium 1194 only → cloud mode (`PW_CHROMIUM`).
Deno via `npx deno@2`. Press-launcher, offline-SW and 5k perf specs are environment-sensitive here.
