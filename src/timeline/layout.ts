// Pure timeline geometry: overlap columns, snapping, day bounds and free rows (docs/spec.md §2.2–2.3).

export interface Span {
  id: string
  start: number // minutes after local midnight
  end: number
}
export interface Placed extends Span {
  col: number
  cols: number
}
export interface FreeRow {
  start: number
  len: number
}

/** Side-by-side columns for overlapping blocks. Clusters of transitively-overlapping spans share a column count. */
export function layoutColumns(spans: Span[]): Placed[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id))
  const out: Placed[] = []
  let cluster: Placed[] = []
  let colEnds: number[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    const n = colEnds.length
    for (const p of cluster) p.cols = n
    out.push(...cluster)
    cluster = []
    colEnds = []
  }
  for (const s of sorted) {
    const end = Math.max(s.end, s.start + 1) // zero-length blocks still occupy a row
    if (s.start >= clusterEnd) {
      flush()
      clusterEnd = -Infinity
    }
    let col = colEnds.findIndex((e) => e <= s.start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(end)
    } else colEnds[col] = end
    cluster.push({ ...s, col, cols: 0 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return out
}

export function snap(min: number, step: number): number {
  return Math.round(min / step) * step
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

/** Keep a moved block inside the 24 h day while preserving its duration. */
export function clampStart(start: number, duration: number): number {
  return clamp(start, 0, Math.max(0, 1440 - duration))
}

export function isOutOfBounds(span: Pick<Span, 'start' | 'end'>, dayStart: number, dayEnd: number): boolean {
  return span.end <= dayStart || span.start >= dayEnd
}

/**
 * Free rows inside [dayStart, dayEnd): gaps not covered by any span, at least `minLen` long.
 * `from` lets callers hide gaps that are already in the past (partial gap is trimmed).
 */
export function freeRows(spans: Pick<Span, 'start' | 'end'>[], dayStart: number, dayEnd: number, minLen = 15, from = dayStart): FreeRow[] {
  const lo = Math.max(dayStart, from)
  const busy = spans
    .map((s) => [Math.max(s.start, lo), Math.min(s.end, dayEnd)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
  const out: FreeRow[] = []
  let cur = lo
  for (const [a, b] of busy) {
    if (a > cur && a - cur >= minLen) out.push({ start: cur, len: a - cur })
    cur = Math.max(cur, b)
  }
  if (dayEnd - cur >= minLen) out.push({ start: cur, len: dayEnd - cur })
  return out
}

/** Earliest free row that fits `duration` — the Place action. */
export function firstFit(rows: FreeRow[], duration: number): FreeRow | undefined {
  return rows.find((r) => r.len >= duration)
}

/** Minutes delta for a vertical pixel delta. */
export function pxToMin(px: number, hourPx: number): number {
  return (px / hourPx) * 60
}
export function minToPx(min: number, hourPx: number): number {
  return (min / 60) * hourPx
}

/** push_down: shift later blocks that now overlap, keeping order and durations. */
export function pushDown(spans: Span[], movedId: string): Span[] {
  const moved = spans.find((s) => s.id === movedId)
  if (!moved) return spans
  const rest = spans.filter((s) => s.id !== movedId && s.start >= moved.start).sort((a, b) => a.start - b.start)
  const out = new Map(spans.map((s) => [s.id, s]))
  let cursor = moved.end
  for (const s of rest) {
    if (s.start >= cursor) break
    const d = s.end - s.start
    const n = { ...s, start: cursor, end: cursor + d }
    out.set(s.id, n)
    cursor = n.end
  }
  return [...out.values()]
}
