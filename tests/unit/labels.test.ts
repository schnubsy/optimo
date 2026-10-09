// arc 7 slice 2 — row labels on the spine (src/timeline/labels.ts): each label beside its own chip, ≥ LABEL_GAP apart,
// inside its segment, with the text column past the chips that meet its line.
import { describe, expect, it } from 'vitest'
import { chipSpan, layoutLabels, LABEL_GAP, LABEL_HALF, stackLabels, type LabelNode } from '../../src/timeline/labels'
import { buildSegments } from '../../src/timeline/segments'
import { layoutColumns } from '../../src/timeline/layout'

const H = (h: number, m = 0) => h * 60 + m

describe('chipSpan', () => {
  it('discs are 56 px centred in the row; capsules 2 px/min clamped to the row, at least a disc', () => {
    expect(chipSpan(100, 30, 15, false)).toEqual({ top: 87, bottom: 143 })
    expect(chipSpan(0, 240, 120, true)).toEqual({ top: 0, bottom: 240 })
    expect(chipSpan(0, 184, 60, true)).toEqual({ top: 32, bottom: 152 })
    expect(chipSpan(0, 40, 30, true)).toEqual({ top: -8, bottom: 48 })
  })
})

describe('stackLabels', () => {
  it('keeps wanted centres that are already apart', () => {
    expect(stackLabels([{ key: 'a', want: 10 }, { key: 'b', want: 100 }], 52, 0, 200).map((p) => p.y)).toEqual([10, 100])
  })
  it('pushes a later label down to the gap; equal wants keep input order', () => {
    expect(stackLabels([{ key: 'a', want: 50 }, { key: 'b', want: 50 }, { key: 'c', want: 60 }], 52, 0, 500)).toEqual([
      { key: 'a', y: 50 },
      { key: 'b', y: 102 },
      { key: 'c', y: 154 },
    ])
  })
  it('pulls the tail back inside the upper bound, then the rest up behind it', () => {
    expect(stackLabels([{ key: 'a', want: 90 }, { key: 'b', want: 95 }], 52, 20, 120)).toEqual([
      { key: 'a', y: 68 },
      { key: 'b', y: 120 },
    ])
  })
  it('is deterministic: the same input always gives the same output', () => {
    const w = [{ key: 'x', want: 3 }, { key: 'y', want: 3 }, { key: 'z', want: 1 }]
    expect(stackLabels(w, 52, 0, 400)).toEqual(stackLabels(w, 52, 0, 400))
    expect(stackLabels(w, 52, 0, 400).map((p) => p.key)).toEqual(['z', 'x', 'y'])
  })
})

/** The QA overlap seed through the real segment map + columns, as Timeline does it. */
function seed(spans: { key: string; start: number; end: number; capsule: boolean }[]) {
  const map = buildSegments(spans, [], H(6), H(22))
  const cols = new Map(layoutColumns(spans.map((s) => ({ id: s.key, start: s.start, end: s.end }))).map((p) => [p.id, p.col]))
  const out = new Map<string, { y: number; cols: number; chip: { top: number; bottom: number } }>()
  for (const seg of map.segments.filter((s) => s.kind === 'node')) {
    const nodes: LabelNode[] = seg.keys.map((k) => {
      const s = spans.find((x) => x.key === k)!
      const top = map.minToY(s.start)
      return { key: k, col: cols.get(k)!, start: s.start, chip: chipSpan(top, map.minToY(s.end) - top, s.end - s.start, s.capsule) }
    })
    for (const [k, v] of layoutLabels(nodes, seg.y, seg.y + seg.h)) out.set(k, { ...v, chip: nodes.find((n) => n.key === k)!.chip })
  }
  return { map, out, cols }
}

describe('layoutLabels', () => {
  it('a lone row keeps its label on its chip centre (the arc-6 look)', () => {
    const { out } = seed([{ key: 'movie', start: H(20), end: H(21, 30), capsule: true }])
    const l = out.get('movie')!
    expect(l.y).toBe((l.chip.top + l.chip.bottom) / 2)
    expect(l.cols).toBe(0)
  })

  it('chained overlap (9–11, 9:30–13:30, 11:00, 13:00): labels ≥ 52 px apart, each inside its segment', () => {
    const { out, map } = seed([
      { key: 'deep', start: H(9), end: H(11), capsule: true },
      { key: 'offsite', start: H(9, 30), end: H(13, 30), capsule: true },
      { key: 'standup', start: H(11), end: H(11, 30), capsule: true },
      { key: 'lunch', start: H(13), end: H(14), capsule: true },
    ])
    const ys = [...out.values()].map((v) => v.y).sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LABEL_GAP)
    const seg = map.segments.find((s) => s.kind === 'node')!
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(seg.y + LABEL_HALF)
      expect(y).toBeLessThanOrEqual(seg.y + seg.h - LABEL_HALF)
    }
    // each label meets its own chip here (no push needed): the ring sits beside its own node
    for (const v of out.values()) expect(v.y >= v.chip.top && v.y <= v.chip.bottom).toBe(true)
    // the text clears every chip on its line: Lunch (col 0) still meets Offsite's capsule (col 1) → starts past col 1;
    // Deep work's line (10:00) meets Offsite too
    expect(out.get('lunch')!.cols).toBe(1)
    expect(out.get('deep')!.cols).toBe(1)
  })

  it('three-way overlap (16:00 / 16:00–17:00 / 16:15): three distinct rows, the later one pushed down', () => {
    const { out } = seed([
      { key: 'inbox', start: H(16), end: H(16, 15), capsule: false },
      { key: 'review', start: H(16), end: H(17), capsule: true },
      { key: 'invoices', start: H(16, 15), end: H(16, 45), capsule: true },
    ])
    const ys = ['inbox', 'review', 'invoices'].map((k) => out.get(k)!.y)
    expect(new Set(ys).size).toBe(3)
    const sorted = [...ys].sort((a, b) => a - b)
    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(LABEL_GAP)
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(LABEL_GAP)
    // the disc (16:00, shortest wanted y) keeps the top line
    expect(out.get('inbox')!.y).toBe(sorted[0])
  })

  it('the text column only skips chips that meet the label line', () => {
    const nodes: LabelNode[] = [
      { key: 'a', col: 0, start: 0, chip: { top: 0, bottom: 56 } },
      { key: 'b', col: 1, start: 30, chip: { top: 200, bottom: 400 } },
    ]
    const out = layoutLabels(nodes, 0, 400)
    expect(out.get('a')).toEqual({ y: 28, cols: 0 }) // b's chip starts far below a's line: a's title takes the row
    expect(out.get('b')).toEqual({ y: 300, cols: 1 })
  })
})
