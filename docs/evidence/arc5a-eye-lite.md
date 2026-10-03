# arc 5a — Eye LITE review (Flow pass) · 2026-10-03

Scope: these screenshots in `docs/evidence/`: slice 1 no-access, slice 2 sync states, slice 3 roles and empty, slice 4 paint ghost (desktop + iPhone 15). Intent was read from the slice 2, 3 and 4 `.md` files. There are no new directions and no scoring.
Originality: nothing here comes from Structured or any other planner. The no-access card, the segmented role control, the dashed-cap paint ghost and the range pill are all Meadow-native.

**Verdict: P0: none.**

| # | Screen | Sev | Finding | Suggested fix |
|---|---|---|---|---|
| 1 | slice-2 done (desktop + iPhone) | 🟡 P1 | "Synced · 12 events · 0 sent to iCloud" is set in terracotta accent ink. The failure reason uses `--danger-ink`, which is nearly the same red. At a glance, success and failure look alike. | Show success in neutral `--ink` with a small check glyph. Keep red for failure only. |
| 2 | slice-2 failed (desktop + iPhone) | 🟡 P1 | The account line still says "synced 13:42 · 12 events" directly above "iCloud didn't answer in time.". It reads as if the sync succeeded. | When the last run failed, change the line to "Last good sync 13:41 · 12 events". Do not refresh the timestamp on failure. |
| 3 | slice-3 roles (iPhone) | 🟡 P1 | The reason Family's Two-way is disabled ("read-only on iCloud") exists only as `title` and `aria-describedby`. Touch has no hover, so sighted iPhone users never see why. | When Two-way is disabled, add "Read-only on iCloud" to the visible helper line, or put a small lock and caption beside the option. |
| 4 | slice-3 roles | 🟡 P1 | The Two-way helper ("optimo tasks are written here, and edits made here come back.") drops the old warning that deleting the event there deletes the task. That is the one destructive consequence. | Append: "Deleting one there deletes the task." |
| 5 | iPhone Settings (slices 2, 3) | 🟡 P1 | Section text under the translucent tab bar shows through the tab labels ("Reminders" over "Inbox · Timeline"), which hurts legibility. This is pre-existing chrome, not new in 5a. | Make the tab-bar backdrop more opaque, or blur it, and add bottom padding equal to the tab bar plus the safe-area height to the scroll container. |
| 6 | slice-1 no-access | ⚪ P2 | "ask Mark" gives no way to actually ask. | Optional: make "ask Mark" a link that goes back to the Family Wing contact or a mailto. |
| 7 | slice-2 all states | ⚪ P2 | The header "Synced" dot (task sync) stays grey and says "Synced" while the calendar button says "Syncing…" or shows a failure. That gives two different sync signals. | Leave the scopes separate, but give the header a "Tasks synced" label or tooltip so its scope is clear. |
| 8 | slice-2 done | ⚪ P2 | The event count appears twice: on the account line and on the button. | Keep the button transient. Fine as is, or drop "12 events" from the button and keep only "N sent to iCloud". |
| 9 | slice-2 evidence | ⚪ P2 | The screenshots predate slice 3: they still show switches and the "Put optimo tasks in" select. | Re-shoot slice 2 states on the merged build for the arc-close pack. **Done in-arc** (EVIDENCE=1 syncfeedback.spec on the merged tree). |
| 10 | slice-3 roles | ⚪ P2 | The calendar named "optimo" with the role "Show in optimo" reads as a tongue-twister. | Fine for now. If it grates, rename the option "Show here". |
| 11 | slice-3 empty | ⚪ P2 | The empty state reads calmly and correctly. "Sync now" is the next step, but it has the same weight as Disconnect. | In this state only, make Sync now the primary (filled) button. |
| 12 | slice-4 ghost (desktop + iPhone) | ⚪ P2 | The free-gap label "1h 15m free" shows through the ghost fill, so two time readouts compete. | Hide or fade the gap label under an active ghost. |
| 13 | slice-4 ghost (iPhone) | ⚪ P2 | The free gap's "+" button peeks out from behind the range pill. | Hide the gap "+" while painting, or offset the pill. |
| 14 | slice-4 ghost | ⚪ P2 | The pill shows the range but not the length, so the user has to work out the duration while dragging. | "17:00–17:45 · 45 m". |

Counts: P0 0 · P1 5 · P2 9.
