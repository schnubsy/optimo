// The spine's one segment map (arc 6 RULE): the ONLY minute↔pixel conversion on the day spine. Drag, the drop ghost,
// the paint ghost, the now marker, the rail labels and virtualisation all read a SegmentMap — never a px-per-minute
// constant of their own. Pure (no DOM) so it unit-tests (tests/unit/segments.test.ts).
//
// The day becomes an ordered list of segments:
//   edge   — before the first row / after the last row: a short linear run so early / late minutes stay reachable
//   anchor — a day bookend (settings.day_start / day_end), a 1-minute row
//   node   — busy time: one task / event, or a cluster of overlapping ones, at `minPx` per minute (≥ `rowMin` px)
//   gap    — free time, measured task-end → next start: proportional when ≤ `propMax` minutes, else compressed into
//            `gapCap` px (dashed spine) with two intermediate hour ticks
// Inside every segment minutes map linearly onto its pixels, so minToY / yToMin are piecewise-linear inverses.

export interface SpineSpan {
  key: string
  start: number // minutes after local midnight
  end: number
}

export type SegmentKind = 'edge' | 'anchor' | 'node' | 'gap'

export interface Segment {
  kind: SegmentKind
  from: number // minutes
  to: number
  y: number // px from the top of the spine content
  h: number
  compressed: boolean
  /** spans (task / event / anchor keys) whose rows live in this segment */
  keys: string[]
  /** compressed gaps: the intermediate hour ticks (minutes) */
  ticks: number[]
}

export interface SegmentOpts {
  /** px per minute in proportional segments (mockups: 2) */
  minPx?: number
  /** a compressed gap's height in px (mockups: 120) */
  gapCap?: number
  /** a node row's minimum height (mockups: 72) */
  rowMin?: number
  /** gaps longer than this (minutes) compress */
  propMax?: number
  /** false: no compression at all (the week columns) */
  compress?: boolean
  /** height of each edge run */
  edgePx?: number
  /** px above the first segment / below the last (not mapped: yToMin clamps) */
  padTop?: number
  padBottom?: number
  /** add the day_start / day_end bookend anchors */
  anchors?: boolean
}

export interface SegmentMap {
  segments: Segment[]
  /** total px including padTop / padBottom */
  height: number
  padTop: number
  minToY: (min: number) => number
  yToMin: (y: number) => number
}

export const ANCHOR_START = 'anchor:start'
export const ANCHOR_END = 'anchor:end'
export const DAY_MIN = 1440

const DEFAULTS: Required<SegmentOpts> = {
  minPx: 2,
  gapCap: 120,
  rowMin: 72,
  propMax: 60,
  compress: true,
  edgePx: 40,
  padTop: 12,
  padBottom: 0,
  anchors: true,
}

/** The two hour ticks of a compressed gap: the hour at ≈⅓ (floored), then one third of the gap's whole hours later. */
export function gapTicks(from: number, to: number): number[] {
  const len = to - from
  const t1 = Math.floor((from + len / 3) / 60) * 60
  const step = Math.floor(len / 180) * 60
  const out = [t1, t1 + step].filter((t, i, a) => t > from && t < to && a.indexOf(t) === i)
  return step ? out : out.slice(0, 1)
}

export function buildSegments(items: SpineSpan[], events: SpineSpan[], dayStart: number, dayEnd: number, options: SegmentOpts = {}): SegmentMap {
  const o = { ...DEFAULTS, ...options }
  const spans: SpineSpan[] = [...items, ...events].map((s) => ({ key: s.key, start: clampDay(s.start), end: clampDay(Math.max(s.end, s.start + 1)) }))
  if (o.anchors) {
    spans.push({ key: ANCHOR_START, start: clampDay(dayStart), end: clampDay(dayStart + 1) })
    spans.push({ key: ANCHOR_END, start: clampDay(Math.min(dayEnd, DAY_MIN - 1)), end: clampDay(Math.min(dayEnd, DAY_MIN - 1) + 1) })
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end || a.key.localeCompare(b.key))

  // busy clusters: transitively overlapping spans share one node segment
  const clusters: { from: number; to: number; keys: string[] }[] = []
  for (const s of spans) {
    const last = clusters[clusters.length - 1]
    if (last && s.start < last.to) {
      last.to = Math.max(last.to, s.end)
      last.keys.push(s.key)
    } else clusters.push({ from: s.start, to: s.end, keys: [s.key] })
  }

  const segs: Segment[] = []
  let y = o.padTop
  const push = (kind: SegmentKind, from: number, to: number, h: number, compressed: boolean, keys: string[] = [], ticks: number[] = []) => {
    segs.push({ kind, from, to, y, h, compressed, keys, ticks })
    y += h
  }

  if (!clusters.length) {
    push('edge', 0, DAY_MIN, o.compress ? o.edgePx * 2 : DAY_MIN * o.minPx, o.compress)
  } else {
    const first = clusters[0]
    if (first.from > 0) push('edge', 0, first.from, o.compress ? o.edgePx : first.from * o.minPx, o.compress)
    clusters.forEach((c, i) => {
      if (i > 0) {
        const prev = clusters[i - 1]
        const len = c.from - prev.to
        if (len > 0) {
          if (o.compress && len > o.propMax) push('gap', prev.to, c.from, o.gapCap, true, [], gapTicks(prev.to, c.from))
          else push('gap', prev.to, c.from, len * o.minPx, false)
        }
      }
      const isAnchor = c.keys.every((k) => k === ANCHOR_START || k === ANCHOR_END)
      // concurrent rows stack their text beside the side-by-side chips: one more 56 px line per extra row
      const stack = o.rowMin ? (c.keys.length - 1) * 56 : 0
      push(isAnchor ? 'anchor' : 'node', c.from, c.to, Math.max(o.rowMin + stack, (c.to - c.from) * o.minPx), false, c.keys)
    })
    const last = clusters[clusters.length - 1]
    if (last.to < DAY_MIN) push('edge', last.to, DAY_MIN, o.compress ? o.edgePx : (DAY_MIN - last.to) * o.minPx, o.compress)
  }

  const top = o.padTop
  const bottom = y
  const height = bottom + o.padBottom

  function minToY(min: number): number {
    const m = clampDay(min)
    // last segment whose `from` ≤ m (segments are contiguous and ordered)
    let lo = 0
    let hi = segs.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segs[mid].from <= m) lo = mid
      else hi = mid - 1
    }
    const s = segs[lo]
    const span = s.to - s.from
    return span > 0 ? s.y + ((m - s.from) / span) * s.h : s.y
  }

  function yToMin(px: number): number {
    const v = Math.min(bottom, Math.max(top, px))
    let lo = 0
    let hi = segs.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segs[mid].y <= v) lo = mid
      else hi = mid - 1
    }
    const s = segs[lo]
    return s.h > 0 ? s.from + ((v - s.y) / s.h) * (s.to - s.from) : s.from
  }

  return { segments: segs, height, padTop: top, minToY, yToMin }
}

function clampDay(m: number) {
  return Math.min(DAY_MIN, Math.max(0, m))
}

export interface RailLabel {
  min: number
  y: number
}

/** Rail labels closer than this are crowded: the less important one is dropped (arc 7 slice 2). */
export const RAIL_MIN_GAP = 28

/**
 * Gutter labels (mockups 01 / 08), most important first: the bookends, every row start (at the disc centre for short
 * rows, at the top for capsules), every capsule end, the compressed-gap ticks, then whole hours inside capsules and
 * half hours inside proportional gaps. A label is kept only when no label for the same minute is placed (no "4:00"
 * twice) and it is ≥ RAIL_MIN_GAP px from every placed label (the hour / half-hour fill keeps `minGap`). Within one
 * importance class the higher label wins.
 */
export function railLabels(map: SegmentMap, rows: { start: number; end: number; capsule: boolean; centreY?: number; anchor?: boolean }[], minGap = 40): RailLabel[] {
  const cands: { min: number; y: number; pri: number; gap: number }[] = []
  for (const r of rows) cands.push({ min: r.start, y: r.capsule ? map.minToY(r.start) : (r.centreY ?? map.minToY((r.start + r.end) / 2)), pri: r.anchor ? 0 : 1, gap: RAIL_MIN_GAP })
  for (const r of rows) if (r.capsule) cands.push({ min: r.end, y: map.minToY(r.end), pri: 2, gap: RAIL_MIN_GAP })
  for (const s of map.segments) for (const t of s.ticks) cands.push({ min: t, y: map.minToY(t), pri: 3, gap: RAIL_MIN_GAP })
  for (const s of map.segments) {
    if (s.compressed || s.kind === 'edge' || s.kind === 'anchor') continue
    const step = s.kind === 'gap' ? 30 : 60
    const caps = s.kind === 'node' ? rows.filter((r) => r.capsule && r.start >= s.from && r.end <= s.to) : []
    for (let t = Math.ceil((s.from + 1) / step) * step; t < s.to; t += step) {
      if (s.kind === 'node' && !caps.some((r) => t > r.start && t < r.end)) continue
      cands.push({ min: t, y: map.minToY(t), pri: 4, gap: minGap })
    }
  }
  cands.sort((a, b) => a.pri - b.pri || a.y - b.y || a.min - b.min)
  const out: RailLabel[] = []
  for (const c of cands) {
    if (out.some((l) => l.min === c.min || Math.abs(l.y - c.y) < c.gap)) continue
    out.push({ min: c.min, y: c.y })
  }
  return out.sort((a, b) => a.y - b.y)
}

/** Rows whose pixel range meets [top, bottom] — virtualisation by segment y. */
export function visibleByY<T extends { start: number; end: number }>(map: SegmentMap, rows: T[], top: number, bottom: number): T[] {
  return rows.filter((r) => map.minToY(r.end) >= top && map.minToY(r.start) <= bottom)
}
