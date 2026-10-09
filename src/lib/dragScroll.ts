// arc 7 slice 4 — drag geometry helpers: the live pointer and an edge-only, speed-capped auto-scroll. dnd-kit's own
// auto-scroll is off (it fired anywhere in the outer 15 % of a container at up to 2 000 px/s and ran away); this one
// scrolls only the container under the pointer, only within EDGE px of its top / bottom edge, at ≤ MAX px per frame,
// and only in a direction the pointer has actually moved since the drag began.

export const EDGE = 48
export const MAX_STEP = 12

export interface Pt {
  x: number
  y: number
}

/** clientX / clientY of a mouse, pointer or touch event (the drag's activator event). */
export function pointOf(e: Event | null | undefined): Pt | null {
  if (!e) return null
  const t = (e as TouchEvent).touches?.[0] ?? (e as TouchEvent).changedTouches?.[0]
  if (t) return { x: t.clientX, y: t.clientY }
  const m = e as MouseEvent
  return typeof m.clientX === 'number' ? { x: m.clientX, y: m.clientY } : null
}

/**
 * Px to scroll this frame for a pointer at `y` in a container spanning [top, bottom]: 0 outside the two EDGE bands,
 * ramping to MAX_STEP at (and past) the edge. Negative = up. `dir` limits it to the way the pointer has travelled.
 */
export function edgeStep(y: number, top: number, bottom: number, dir: -1 | 0 | 1, edge = EDGE, max = MAX_STEP): number {
  if (bottom - top < edge * 3) return 0 // a container this short has no "middle": never auto-scroll it
  const ramp = (depth: number) => Math.max(1, Math.round(max * Math.min(1, depth / edge)))
  if (dir < 0 && y < top + edge) return -ramp(top + edge - y)
  if (dir > 0 && y > bottom - edge) return ramp(y - (bottom - edge))
  return 0
}

const scrollable = (el: Element): el is HTMLElement => {
  if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight + 1) return false
  const oy = getComputedStyle(el).overflowY
  return oy === 'auto' || oy === 'scroll'
}

/** The vertical scroller whose box contains the point (nearest first) — never one the point is merely near. */
export function scrollerAt(p: Pt): HTMLElement | null {
  const seen = new Set<Element>()
  for (const hit of document.elementsFromPoint(p.x, p.y)) {
    for (let n: Element | null = hit; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (seen.has(n)) break
      seen.add(n)
      if (!scrollable(n)) continue
      const r = n.getBoundingClientRect()
      if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) return n
    }
  }
  return null
}
