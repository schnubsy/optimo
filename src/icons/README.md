# optimo icons

All glyphs drawn in-repo; none traced from SF Symbols, Material, Structured or any icon library.

- `set.ts` — 64 activity glyphs + 12 chrome glyphs (24×24, filled, `currentColor`), picker groups, and the
  `LEGACY` map that keeps pre-arc-2 names resolving. Rules: docs/design/2026-09-27-final/spec.md §6.
- `Icon.tsx` — renders a glyph; chrome glyphs also render as a 1.75px outline (inactive tabs).
- `brand.svg` — the app mark (PWA icons via `scripts/make-icons.ts`).
- Review sheet: `npx tsx scripts/icon-sheet.ts` → `docs/evidence/icons.png`.
