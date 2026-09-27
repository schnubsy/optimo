# Structured.app — visual language & interaction digest (design reference, 2025–2026)

Purpose: capture the *feel* of Structured (Unorderly / Leo Mehlig, Berlin) in words so optimo can match the category
without copying assets. Sourced from official site/blog/help center, App Store + Google Play listings, press kit,
changelog and third-party reviews. Items marked **[obs]** are working observations from public screenshots/videos and
should be verified against the live app before being treated as fact.

## 1. Day timeline

- **Structure.** One vertical "spine" runs top to bottom. Time-of-day labels sit in a narrow left gutter ("On the left
  side you can see the time of day"). Each task is a **row**, not a calendar-grid rectangle: a round icon "bubble" on
  the spine, with the title and time text to its right. Vertical space is proportional to duration ("a 30 minute task
  takes up half the space of a one hour task"), so the day reads as a flowing list that also encodes time.
- **Task rendering [obs].** The bubble is a filled circle in the task's colour with a white glyph inside; the row's text
  is title (semibold, ~body size) over a secondary line with start time / duration (smaller, muted). There is no large
  filled card behind the text in the default layout; the colour lives in the circle and in the spine segment. Corners
  everywhere are fully round (circles, pill buttons) — the feel is soft/bubbly, not boxy. Subtasks now render inline
  under the parent row in the timeline (4.4, Dec 2025).
- **Progress fill.** The bubble fills with colour as the task's time elapses: "gradual color fill of each event circle
  enables quick orientation" (Designli); a Play reviewer: "the bubbles fill in as time passes." This doubles as the
  "now" indicator — the currently-running task is the partly-filled one. A separate horizontal now-line is *not* the
  primary cue [obs].
- **Line between blocks / free time.** The spine continues between bubbles. In a gap, the spine turns light/dashed and
  the app inserts an inline free-time prompt ("prompts to add tasks in free time slots"; nudges like "Want to read a book
  for 40 min?"). Layout setting controls this: **Full** = times at left + free-time prompts + icons under dates;
  **Simplified** = no free-time prompts, keeps "+" button; **Minimal** = no free-time prompts and no timestamps beside
  tasks. The "line between blocks" is therefore a spine-plus-gap-prompt pattern, not a coloured block that stretches.
- **Overlaps.** Overlapping tasks are shown side-by-side/offset on the spine and the app raises "task overlap alerts"
  ("get a warning when your tasks conflict"). Calendar events imported (Pro) render in the same row style.
- **Completed.** "The app dims and strikes them out, but they remain visible on your timetable"; the bubble becomes a
  checkmark state [obs]. Swipe right = complete; left = to Inbox; up = reschedule; down = delete (App Store story).
- **Focus.** "Focus Now" opens a countdown for the active task; "the rest of the timeline fades into the background."

## 2. Colour system

- **Per-task colour, not categories.** Each task gets its own colour (earlier: "four presets or a custom colour"; now a
  larger preset row + custom picker [obs]). Colour is advisory ("categorise by type or urgency"), never a data model.
  Recurring tasks and calendar events tend to keep one colour so they read as a family.
- **App accent** is user-selectable ("App Color… Edit Palette"), default a warm pink/magenta (help center: "pink plus
  button"). Accent drives the selected date, FAB, and controls; it does not recolour existing tasks.
- **Palette character.** Saturated but soft — candy/pastel leaning, white glyphs sit on it. Reviews call the result
  "polished and calming" and "pretty to look at." Backgrounds: pure white in light; near-black (site theme colour
  `#1a1a1a`) in dark, where "all the black text to white. The other colours remain the same" (task colours don't shift).
- Themes: System / Light / Dark; seasonal "Pride" palette variant; OpenDyslexic font option.

## 3. Iconography

- Glyph set: 500+ line-weight-consistent symbols, SF-Symbols-like (rounded, filled, single-colour), grouped in categories
  (Animals, Food & Drinks, Activities…). Rendered **white inside the coloured circle** on the spine; the same circle is
  reused compressed in week/month views. "Smart Task Icons" (4.6, 2026) auto-suggest a glyph from the title.
- A reviewer notes "a large sticker on the left side of your task name" — i.e. the bubble is deliberately large and
  emoji-like in presence, which is a big part of the brand feel.
- UI chrome uses symbols too; 4.3.12 "reworked some of the in-app symbols" and added **animated tab-bar icons**.

## 4. Navigation & layout

- **iPhone (4.0, Jan 2025):** bottom tab bar (Timeline · Inbox · Structured AI · Settings; AI tab hideable in 4.6), a
  large round "+" FAB bottom-right, a horizontal **date strip** at top (tap a day; swipe to change week; tap month to
  open month view). Timeline button toggles Day / Week / Month.
- **Week view:** day timelines "visualized side by side, compressed to their respective task icon"; all-day row on top;
  tapping an icon opens that task in a day timeline docked at the bottom. Month view: icons per day; tap = jump to day.
- **iPad / Mac:** layout "largely unchanged" by 4.0 — inbox is a **left sidebar you can toggle**, timeline centre, week
  dates across the top; Mac has in-app text-size slider and time-picker tweaks.
- **Web (1.0, Apr 2025):** inbox toggle top-left (M), settings gear top-right, pink "+" bottom-right; keyboard-first
  (Q new task, I inbox task, A all-day, arrows change day, ⌘+arrows week, E complete, B bulk-edit). Day/week/multi-day/
  month views. Illustrated onboarding with "handcrafted illustrations."
- **Inbox:** list of undated tasks; drag from inbox onto a timeline slot, or check off directly.
- **Quick add:** "+" → editor sheet with title, time, duration, icon, colour, subtasks, notes, alerts; suggested tasks
  row (tap to duplicate a past task); AI/voice natural-language entry (Pro).

## 5. Motion — what makes it feel fluid

- Continuous spine + proportional spacing means inserting/moving a task **reflows** neighbours; drag-and-drop reschedules
  live ("instant drag-to-reschedule").
- Completion: bubble flips to checkmark, row dims/strikes in place (no removal), with **haptic + UI sound** (3.6.1).
- Bubble progress fill animates over the task's duration; focus mode dims everything else.
- Swipe gestures on rows (4 directions) with spring-like sheet transitions; animated tab-bar icons on tab switch.
- Editor is a bottom sheet on phone, popover/sidebar on desktop [obs].

## 6. Distinctive (do NOT copy) vs generic (fine to share)

**Brand-identifying — avoid:**
- The exact **icon-bubble-on-a-spine** row (large coloured circle with white glyph, thin vertical line, title right).
- **Circle progress-fill as the "now" indicator.**
- The inline **free-time prompt sentence** on a dashed spine gap ("Want to read a book for 40 min?").
- Week view as side-by-side spines **compressed to icon stacks**; month view as icon-per-day.
- Pink/magenta default accent + candy palette; the Charlotte illustration style; "Structured" name/wordmark; their glyph
  set; "Inbox" + "Structured AI" tab naming pairing; onboarding copy.

**Generic category conventions — safe:**
- Vertical day timeline with time gutter; duration-proportional blocks; drag-to-reschedule.
- A now-line or current-time marker; dim + strike completed tasks; check-to-complete.
- Per-task colour and an icon; date strip; FAB for add; bottom tab bar on phone, sidebar on desktop.
- Undated "inbox/backlog" list that drags onto the timeline; week/month overviews; keyboard shortcuts on web.
- Focus/countdown mode; light/dark themes; haptics on completion.

**How optimo can differ while keeping the feel:** use rounded **rectangular blocks** (tinted fill, saturated left edge)
rather than icon bubbles; put the icon inside the block, not on a spine; show gaps as translucent negative space with a
subtle "+" affordance rather than prompt copy; use a horizontal now-line with a ring on the gutter; keep the calm
proportional rhythm, generous white space and round corners.

## Sources

- https://structured.app/ · https://structured.app/blog/getstarted · https://structured.app/blog/4-0
- https://structured.app/blog/structured-web-1-0 · https://structured.app/blog/structuredfive
- https://help.structured.app/en/articles/380546 · https://help.structured.app/en/articles/354306
- https://help.structured.app/en/articles/2050050 · https://feedback.structured.app/changelog
- https://apps.apple.com/us/app/structured-daily-planner/id1499198946 · https://apps.apple.com/sg/app/structured-daily-planner-todo/id1499198946
- https://apps.apple.com/us/iphone/story/id1596158592 · https://play.google.com/store/apps/details?id=io.unorderly.structured
- https://impresskit.net/a94850d4-7d78-4ce2-ad8c-40841ebe2888 · https://impresskit.net/press-release/28190b99-ddf6-4861-82fc-94b045a5b428
- https://appleinsider.com/articles/23/01/09/structured-301-review-no-frills-attractive-daily-planner
- https://screensdesign.com/showcase/structured-daily-planner · https://designli.co/blog/how-the-structured-app-achieved-millions-of-downloads-using-behavioral-design
- https://beingpaperless.com/structured-for-the-ipad-complete-review/ · https://calmevo.com/structured-app-review/
- https://daveswift.com/structured/ · https://www.usecarly.com/blog/tiimo-vs-structured/
- https://habi.app/insights/best-daily-planner-apps/ · https://www.saner.ai/blogs/best-daily-planner-apps · https://plaky.com/blog/best-daily-planner-apps/
