// arc 7 slice 2 — where each row's text + ring go on the spine. Pure (no DOM) so it unit-tests
// (tests/unit/labels.test.ts). Every y here is a pixel the segment map produced (arc 6 RULE: segments.ts is the only
// minute↔pixel conversion) — this module only spaces those pixels apart.
//
// Rule (deterministic):
//   1. A row's label wants to sit level with its own chip's centre (the disc, or the middle of the capsule).
//   2. Labels of one segment are taken in order (wanted y, then start, then key) and each sits at least LABEL_GAP
//      below the previous one — a later row whose chip is too close to the one above is pushed down.
//   3. A backward pass pulls the tail up so no label leaves its segment (the segment map gives every concurrent row
//      a 56 px line, so a cluster always has room for its stack).
//   4. A label's text starts right of the right-most chip whose span meets the label's band (± LABEL_HALF): the title
//      takes the rest of the row, and it never runs under a chip of the same cluster.
// The ring is drawn on the label's row, so ring centres are ≥ LABEL_GAP apart and each ring sits beside its own title.

/** Vertical spacing between two labels (and so two rings): ≥ 44 px ring hit areas never meet. */
export const LABEL_GAP = 52
/** Half the height of a label block (time line + title) — its band for chip collisions and segment bounds. */
export const LABEL_HALF = 22
/** A disc (and an event / bookend chip) is 56 px; a capsule is 2 px per minute, at least a disc. */
export const NODE_PX = 56

export interface Span1D {
  top: number
  bottom: number
}

/** The chip's span inside its row (px from the same origin as rowTop): centred in the row, as NodeRow draws it. */
export function chipSpan(rowTop: number, rowH: number, dur: number, capsule: boolean): Span1D {
  const h = capsule ? Math.max(NODE_PX, Math.min(rowH, dur * 2)) : NODE_PX
  const top = rowTop + (rowH - h) / 2
  return { top, bottom: top + h }
}

export interface LabelNode {
  key: string
  /** overlap column (0 = on the spine) */
  col: number
  /** the chip's span, px from the top of the spine content */
  chip: Span1D
  /** tie-break after the wanted y (minutes: earlier rows first) */
  start: number
}

export interface LabelBox {
  /** the label's (and ring's) centre, px from the top of the spine content */
  y: number
  /** the text column starts this many overlap columns right of the base text column */
  cols: number
}

/**
 * Space wanted centres ≥ `gap` apart inside [lo, hi]: forward push-down, then a backward pull-up. Input order is the
 * tie-break for equal wants. Returns the placed centres in sorted order with their keys.
 */
export function stackLabels(wants: { key: string; want: number }[], gap: number, lo: number, hi: number): { key: string; y: number }[] {
  const out = wants.map((w, i) => ({ ...w, i })).sort((a, b) => a.want - b.want || a.i - b.i).map((w) => ({ key: w.key, y: w.want }))
  for (let i = 0; i < out.length; i++) out[i].y = Math.max(out[i].y, lo, i ? out[i - 1].y + gap : -Infinity)
  for (let i = out.length - 1; i >= 0; i--) out[i].y = Math.min(out[i].y, hi, i < out.length - 1 ? out[i + 1].y - gap : Infinity)
  return out
}

/** Labels for the rows of one segment (a cluster of concurrent rows, or a single row) spanning [segTop, segBottom]. */
export function layoutLabels(nodes: LabelNode[], segTop: number, segBottom: number): Map<string, LabelBox> {
  const ordered = [...nodes].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))
  const lo = Math.min(segTop + LABEL_HALF, (segTop + segBottom) / 2)
  const hi = Math.max(segBottom - LABEL_HALF, lo)
  const placed = stackLabels(ordered.map((n) => ({ key: n.key, want: (n.chip.top + n.chip.bottom) / 2 })), LABEL_GAP, lo, hi)
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  const out = new Map<string, LabelBox>()
  for (const p of placed) {
    const own = byKey.get(p.key)!
    let cols = own.col
    for (const n of nodes) if (n.chip.top < p.y + LABEL_HALF && n.chip.bottom > p.y - LABEL_HALF) cols = Math.max(cols, n.col)
    out.set(p.key, { y: p.y, cols })
  }
  return out
}
