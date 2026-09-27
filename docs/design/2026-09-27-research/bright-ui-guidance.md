# Bright, graphical, sleek UI — design-system guidance (2024–2026)

Brief for redesigning optimo from a dark "instrument panel" into a fun, bright, graphical register. React + CSS variables, light + dark, iPhone + desktop. Every number below is either quoted from a cited source or computed/verified in OKLCH→sRGB with WCAG 2 contrast (marked *verified*).

## 1. Palettes — bright but sophisticated, legible in dark mode

**The shared mechanism (M3 / Radix / Tailwind agree):** pick one hue, then derive every role by moving *lightness* (tone) at fixed hue, not by tweaking hex codes.
- Material 3 builds a 13-tone palette per hue (0,10,20,…,90,95,99,100) in HCT and maps roles to tones. Its contrast rule: a tone difference **≥ 40 gives ≥ 3:1, ≥ 50 gives ≥ 4.5:1**, so pairs stay accessible when the scheme flips to dark. Light: `primary`=40, `on-primary`=100, `primary-container`=90, `on-primary-container`=10. Dark: 80 / 20 / 30 / 90. (Compose sample: light container `#C7F089`, dark container `#324F00`.)
- Radix Colors uses a 12-step scale per hue: 1–2 app backgrounds, **3–5 component backgrounds** (normal/hover/pressed), 6–8 borders, **9 solid** ("the purest step"), 10 solid hover, **11–12 text**, with 11/12 "guaranteed to Lc 60 and Lc 90 APCA on a step 2 background". Dark scales are separately composed, not inverted. Bright hues (**Sky, Mint, Lime, Yellow, Amber**) are "designed for dark foreground text" on step 9 — white text fails there.
- Tailwind v4 moved the whole default palette to `oklch()` for P3 vividness (e.g. `--color-avocado-300: oklch(0.94 0.11 115)`; `-600: oklch(0.53 0.12 118)`).

**Tinted card + solid chip from one hue (the consumer-app recipe, *verified*):**
```
/* light */ --tint: oklch(0.95 0.045 H); --on-tint: oklch(0.32 0.11 H);   /* ≈10–11:1 */
            --chip: oklch(0.55 0.19 H);  --on-chip: white;                 /* ≥4.5:1 for H=25,240,300,85 */
/* dark  */ --tint: oklch(0.30 0.055 H); --on-tint: oklch(0.88 0.08 H);   /* ≈9.2–9.6:1 */
            --chip: oklch(0.78 0.16 H);  --on-chip: oklch(0.20 0.02 H);   /* ≈8–9.6:1 */
```
Rules that keep 4.5:1 on colored surfaces: (a) text on a tint is the same hue at L≈0.32 (light) / L≈0.88 (dark), never gray; (b) a chip with white text needs L ≤ 0.55 — at L 0.62 every hue tested lands at 3.2–4.0:1 (OK for ≥24px/bold text or UI outlines at 3:1, not body); (c) in dark mode chips get *brighter* (L 0.78) and take dark ink, as Radix does for Sky/Mint/Lime/Amber; (d) mint (H 160) and lime (H 125) at L 0.55 still miss white text (4.1:1) — give them ink text in both modes.

Three example systems (hex = sRGB fallback of the OKLCH, *verified* as above):
1. **Sherbet** (warm, playful) — sun `H85` tint `#fcedcd`/chip `#a36200`; coral `H25` `#ffe4df`/`#c92f33`; grape `H300` `#f3e8ff`/`#854ece`. Canvas `oklch(0.985 0.005 85)` `#fcfaf6`, ink `oklch(0.22 0.02 85)` (16.6:1). Dark canvas `oklch(0.19 0.012 260)` `#111419`, card `#1b1f26`, text `#e4e8ef` (15:1), secondary text `oklch(0.72 0.02 260)` (6.6:1 on card).
2. **Poolside** (cool, sporty) — sky `H240` `#d4f3ff`/`#0079d3`; mint `H160` `#d6f8e4`/`#009048` + ink text; lime `H125` `#e7f4d4`/`#598200` + ink text; dark chips `#3bc3ff`, `#3ad693`, `#a0c849` with ink. Pair with Radix-style "natural gray" (slate for blue, sage for green) — Radix warns saturated grays can clash with colorful components in dark mode.
3. **Radix-native** (fastest to ship) — take Radix `amber`, `tomato`, `violet`, `grass` scales as-is: step 3 = tinted card, step 9 = chip, step 11 = colored label, step 12 = heading on tint; use the separate dark scales. Note GitHub issue #42: Yellow/Amber/Orange step 11 do not all reach 4.5:1 — check per hue.

Apple HIG cross-check: system colors are defined per appearance (light/dark) and vibrancy rules assume text on *materials*, not on saturated fills; treat "Increase Contrast" as a third theme variant that raises tint L-delta by ~0.05.

## 2. Typography — friendly-geometric, professional (all on Google Fonts, OFL)

Set times/durations with `font-variant-numeric: tabular-nums` (Google Fonts "Implementing OpenType features on the web"); where a family lacks `tnum`, fall back to a mono for the timeline rail — mono figures are tabular by construction.
1. **Nunito (UI + headings, 400–900) + JetBrains Mono (times, 500)** — Nunito's rounded terminals read "soft" at every weight without turning childish; the mono keeps a 24-hour rail aligned and its slightly rounded forms sit well beside Nunito. Safest all-rounder.
2. **Figtree (everything, 300–900) + `tabular-nums`** — drawn for product UI, geometric but with humanist proportions, big x-height; one family keeps bundle small. Verify `tnum` renders in the specimen tester before relying on it.
3. **Outfit (display 600–800) + Manrope (UI/body 400–700)** — Outfit's single-storey *a* and round bowls give poster-like headers; Manrope is crisper for 13–15px labels and ships tabular figures + slashed zero (per the googlefonts/manrope repo).
4. **Fredoka (display only, 500–700) + DM Sans (UI/body) + DM Mono (times)** — Fredoka is the most "toy-like"; keep it to day titles, streak counts and empty states so DM Sans carries the professional register. Alternates if a pairing feels off: Quicksand, Sora, Urbanist, Lexend, Baloo 2 (display).

## 3. Shape & depth
- **Radius scale (M3):** none 0, XS 4, S 8 (buttons/chips), M 12 ("most-used"), L 16 (cards/nav), XL 28 (sheets/hero), full 9999 (pills/FAB). M3 Expressive (May 2025) adds larger "increased" steps and 35 morphable shapes; Duolingo ships 16px cards/buttons, 12px inputs, pill chips. A planner needs three: `--r-chip: 999px`, `--r-card: 16px`, `--r-sheet: 28px`.
- **Concentric corners:** inner radius = outer radius − padding (Apple exposes `ConcentricRectangle` for this in iOS 26); nested cards that share a radius look wrong.
- **Depth:** prefer tinted surfaces over shadows — M3 uses "tonal color overlays instead of just shadows"; Radix steps 1→2→3 give three levels with zero shadow. Reserve one soft shadow (`0 8px 24px -12px oklch(0.2 0.02 H / .25)`) for floating things (sheet, dragged block, FAB). Duolingo's "3D" affordance is a 4px solid bottom border in the darker step that collapses on `:active` — cheap, playful, no blur.
- **Glass:** Apple's own rules — glass is a *navigation/controls layer floating above content*, never for content, never glass-on-glass, tint only the control that matters, and system glass must respect Reduce Transparency / Increase Contrast. NN/g's iOS 26 review: "anything placed on top of something else becomes harder to see"; text over text is illegible, shimmering controls distract, and crowded glass tab bars shrink tap targets below ~1cm. So: at most one `backdrop-filter: blur(20px) saturate(1.4)` surface (the bottom bar/sheet header) over a plain canvas, with an opaque fallback under `prefers-reduced-transparency` and `prefers-contrast: more`.
- **Rounded icon chips:** 40px circle or 12px-radius square, tint step 3 fill, chip step 9 glyph (light) / step 11 glyph on step 3 (dark); the glyph is 20–24px inside 40. One hue per category, never a gradient per chip.

## 4. Iconography — drawing an original 24px rounded/filled set
- **Grid:** 24×24 with a 20×20 live area (2px padding), keylines: 20 square, 22×18 landscape, 18×22 portrait, 20 circle (Material system-icon spec). Stroke 2px, stroke corners and end caps 2px radius for "rounded"; align to whole pixels.
- **Optical size:** Material Symbols expose `opsz` 20–48 because "for the image to look the same at different sizes, the stroke weight changes as the icon size scales" — draw 20px variants slightly heavier (≈2.25px) and 40px lighter (≈1.75px). Weight axis 100–700, `FILL` 0→1 for the outlined→filled state toggle (use for complete/incomplete).
- **Apple HIG:** "match the weights of interface icons and adjacent text"; optically centre asymmetric glyphs (nudge, add padding); simplify to familiar metaphors; ship vector (SVG).
- **Filled look:** fill + 1 counter-cut of 2px; keep one open detail so filled icons don't become blobs at 20px.
- **License-safe to study (not copy):** Material Symbols (Apache 2.0, rounded + filled axes — closest reference for this register), Lucide (ISC; ~150 Feather-derived glyphs MIT), Phosphor (MIT, six weights incl. duotone/fill), Heroicons (MIT, solid + outline pairs). **Do not** reference SF Symbols for a web app: Apple's SF Symbols license limits them to Apple-platform apps and forbids using them as icons/logos; tracing them is a copy.

## 5. Motion — "fluid" without being slow
Tokens (M3 easing-and-duration): standard `cubic-bezier(0.2,0,0,1)`, standard-decelerate `(0,0,0,1)`, standard-accelerate `(0.3,0,1,1)`, emphasized-decelerate `(0.05,0.7,0.1,1)`, emphasized-accelerate `(0.2,0,1,1)`. Durations: short 50/100/150/200, medium 250/300/350/400, long 450/500/550/700 ms. Emil Kowalski's standards: UI under 300 ms, buttons 100–160, popovers 125–200, dropdowns 150–250, modals/drawers 200–500; enter/exit = ease-out, never ease-in; animate only `transform`/`opacity`; never scale from 0 (start 0.9–0.97); "slow where users decide, fast where systems respond"; skip animation for things done 100×/day.
| Interaction | Spec |
|---|---|
| Add task (appears in list) | 200 ms, emphasized-decelerate, `translateY(8px)→0` + opacity 0→1, `scale(.97)→1`; list neighbours shift with 250 ms standard |
| Complete + celebration | check draws 150 ms ease-out; row tints to `--tint` 200 ms; one burst: 6–8 dots, 350–450 ms, ease-out, opacity to 0 — fires only on user tap, never on sync |
| Drag settle | spring (M3 Expressive "spatial" spring, or CSS `linear()` spring from Josh Comeau's generator), duration ~0.5 s, bounce 0.15–0.25 (Emil: keep bounce 0.1–0.3); dismiss on velocity (~0.11) not distance; damp at edges |
| Sheet open | 350–400 ms, Emil's drawer curve `cubic-bezier(0.32,0.72,0,1)`; close 250 ms standard-accelerate; scrim 200 ms opacity |
| Hover / press | 100–150 ms `ease`; press `scale(.97)`; CSS transitions (retargetable) not keyframes |
Reduced motion: `prefers-reduced-motion: reduce` keeps opacity/colour, drops transforms (Comeau: "reduce, don't remove", so the reduced path still feels premium); Apple's App Store criteria: stop decorative motion, replace functional motion (status change, hierarchy) with dissolve/highlight/colour shift; kill parallax, multi-axis, spinning, auto-advance. Caveat from Comeau: `linear()` springs "turn around instantly" when interrupted — use a JS spring (Motion/React Spring) for interruptible drag.

## 6. Bright-yet-sleek consumer UIs to study
- **Duolingo** — one unapologetic green (#58CC02) + 5 secondary brights on white; 16px radii, 2–3px chunky borders, 800-weight display, 4px "3D" button lip. Bright because saturation is high *and* surfaces are flat white.
- **Headspace (2024, Italic Studio)** — kept its orange, expanded palette "to represent the range of human emotions", custom Aperçu that "flexes from playful to clinical"; proof a warm palette can carry credibility.
- **Finch** — pastel skeuomorphic pet world; animated feedback on every completed goal; critique warns its density can "overwhelm" — celebrate, but keep the list plain.
- **Gentler Streak (ADA 2023)** — colourful UIKit, abstract mascot "Yorhart", "humanity over statistics"; numbers shown as meaning, not raw metrics — a model for time-left / streak displays.
- **Copilot Money (ADA finalist 2024)** — colour-coded categories on a deep-space dark canvas with Swift Charts; shows bright category colour surviving dark mode via saturated chips on near-black.
- **Airbnb (Summer 2025)** — 3D "Lava" icons, new type/colour/card system; bright via soft-shaded objects on white, not via coloured backgrounds. Study the icon chips, not the 3D itself.

## Sources
- https://m3.material.io/styles/color/system/how-the-system-works · https://note.com/pajero/n/ne34d4797a35e?hl=en · https://developer.android.com/develop/ui/compose/designsystems/material3
- https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale · https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette · https://github.com/radix-ui/colors/issues/42
- https://tailwindcss.com/blog/tailwindcss-v4 · https://developer.apple.com/design/human-interface-guidelines/color · https://developer.apple.com/design/human-interface-guidelines/materials
- https://fonts.google.com/knowledge/using_type/implementing_open_type_features_on_the_web · https://github.com/googlefonts/manrope · https://fonts.google.com/specimen/Figtree · https://fonts.google.com/specimen/Nunito · https://fonts.google.com/specimen/Outfit · https://fonts.google.com/specimen/Fredoka
- https://m3.material.io/styles/shape/corner-radius-scale · https://pub.dev/documentation/material_design/latest/material_design/M3Corners-class.html · https://m3.material.io/blog/building-with-m3-expressive · https://www.androidauthority.com/google-material-3-expressive-features-changes-availability-supported-devices-3556392/
- https://www.nngroup.com/articles/liquid-glass/ · https://bitrig.com/blog/liquid-glass-best-practices · https://www.macrumors.com/how-to/ios-reduce-transparency-liquid-glass-effect/
- https://m3.material.io/styles/icons/designing-icons · https://m2.material.io/design/iconography/system-icons.html · https://developers.google.com/fonts/docs/material_symbols · https://developer.apple.com/design/human-interface-guidelines/icons · https://developer.apple.com/sf-symbols/ · https://lucide.dev/license · https://phosphoricons.com · https://heroicons.com
- https://m3.material.io/styles/motion/easing-and-duration/tokens-specs · https://docs.rs/material-rs/latest/src/material_rs/theme/motion.rs.html · https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md · https://www.joshwcomeau.com/react/prefers-reduced-motion/ · https://www.joshwcomeau.com/animation/linear-timing-function/ · https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/
- https://github.com/nexu-io/open-design/blob/main/design-systems/duolingo/DESIGN.md · https://www.itsnicethat.com/articles/italic-studio-headspace-graphic-design-project-250424 · https://ixd.prattsi.org/2024/09/design-critique-finch-ios-app/ · https://developer.apple.com/news/?id=3m0ht22s · https://developer.apple.com/articles/copilot-money/ · https://designcompass.org/en/2025/07/04/airbnb-new-design-system/
