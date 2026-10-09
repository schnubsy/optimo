// arc 6 slice 3 — the spine's segment map (src/timeline/segments.ts) is the only minute↔pixel conversion.
import { describe, expect, it } from 'vitest'
import { ANCHOR_END, ANCHOR_START, buildSegments, gapTicks, railLabels, visibleByY } from '../../src/timeline/segments'

const H = (h: number, m = 0) => h * 60 + m

describe('buildSegments', () => {
  it('empty day: two 1-minute bookend anchors joined by one compressed gap, edges outside', () => {
    const map = buildSegments([], [], H(9), H(22, 30))
    expect(map.segments.map((s) => s.kind)).toEqual(['edge', 'anchor', 'gap', 'anchor', 'edge'])
    const [, a, gap, b] = map.segments
    expect(a).toMatchObject({ from: H(9), to: H(9, 1), keys: [ANCHOR_START], h: 72 })
    expect(b).toMatchObject({ from: H(22, 30), to: H(22, 31), keys: [ANCHOR_END], h: 72 })
    // gaps are measured anchor-end → next start: 13h 29m
    expect(gap.to - gap.from).toBe(13 * 60 + 29)
    expect(gap.compressed).toBe(true)
    expect(gap.h).toBe(120)
    expect(map.minToY(H(9))).toBe(a.y)
  })

  it('a 13.5 h gap compresses to 120 px with hour ticks at 1:00 / 5:00', () => {
    const map = buildSegments([], [], H(9), H(22, 30))
    const gap = map.segments.find((s) => s.kind === 'gap')!
    expect(gap.h).toBe(120)
    expect(gap.ticks).toEqual([H(13), H(17)])
    // ticks sit linearly inside the compressed run (≈ 0.30 and 0.59 of it, as in mockup 01)
    expect((map.minToY(H(13)) - gap.y) / gap.h).toBeCloseTo(0.296, 2)
    expect((map.minToY(H(17)) - gap.y) / gap.h).toBeCloseTo(0.593, 2)
    // mockup 08: 9:01 → 20:00 ticks at 12:00 / 3:00
    expect(gapTicks(H(9, 1), H(20))).toEqual([H(12), H(15)])
  })

  it('a 90-min task is a 180 px capsule; a 60-min gap is proportional (120 px), a 61-min gap compresses', () => {
    const map = buildSegments([{ key: 'movie', start: H(20), end: H(21, 30) }], [], H(9), H(22, 30))
    const node = map.segments.find((s) => s.kind === 'node')!
    expect(node).toMatchObject({ from: H(20), to: H(21, 30), h: 180, keys: ['movie'] })
    expect(map.minToY(H(21, 30)) - map.minToY(H(20))).toBe(180)
    const after = map.segments[map.segments.indexOf(node) + 1]
    expect(after).toMatchObject({ kind: 'gap', from: H(21, 30), to: H(22, 30), h: 120, compressed: false })
    const m2 = buildSegments([{ key: 'x', start: H(20), end: H(21, 29) }], [], H(9), H(22, 30))
    expect(m2.segments.find((s) => s.kind === 'gap' && s.from === H(21, 29))!.compressed).toBe(true)
  })

  it('short tasks get a 72 px row; overlapping tasks share one node segment; events join the spine', () => {
    const map = buildSegments(
      [
        { key: 'a', start: H(10), end: H(10, 15) },
        { key: 'b', start: H(10, 10), end: H(10, 40) },
      ],
      [{ key: 'ev:1', start: H(14), end: H(15) }],
      H(9),
      H(22),
    )
    const nodes = map.segments.filter((s) => s.kind === 'node')
    // two concurrent rows: 72 + one stacked 56 px text line
    expect(nodes[0]).toMatchObject({ from: H(10), to: H(10, 40), keys: ['a', 'b'], h: 128 })
    expect(nodes[1]).toMatchObject({ keys: ['ev:1'], h: 120 })
    const short = buildSegments([{ key: 's', start: H(12), end: H(12, 10) }], [], H(9), H(22)).segments.find((s) => s.kind === 'node')!
    expect(short.h).toBe(72)
  })

  it('round-trips yToMin(minToY(m)) == m on 500 random minutes', () => {
    const map = buildSegments(
      [
        { key: 'a', start: H(7), end: H(7, 45) },
        { key: 'b', start: H(9), end: H(11) },
        { key: 'c', start: H(11), end: H(11, 30) },
        { key: 'd', start: H(13), end: H(13, 5) },
        { key: 'e', start: H(16, 15), end: H(17) },
      ],
      [{ key: 'ev:x', start: H(16), end: H(16, 30) }],
      H(6),
      H(22),
    )
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 500; i++) {
      const m = Math.floor(rnd() * 1440)
      expect(map.yToMin(map.minToY(m))).toBeCloseTo(m, 6)
    }
    // monotonic: later minutes never sit higher
    for (let m = 1; m <= 1440; m++) expect(map.minToY(m)).toBeGreaterThanOrEqual(map.minToY(m - 1))
  })

  it('clamps outside the content; the week variant (no compression) is linear at its own px/min', () => {
    const map = buildSegments([], [], H(9), H(22))
    expect(map.yToMin(-50)).toBe(0)
    expect(map.yToMin(map.height + 500)).toBe(1440)
    const week = buildSegments([{ key: 'w', start: H(20), end: H(21, 30) }], [], H(9), H(22), { minPx: 0.6, compress: false, rowMin: 0, padTop: 0, anchors: false })
    expect(week.minToY(H(10)) - week.minToY(H(9))).toBeCloseTo(36, 6)
    expect(week.minToY(H(21, 30)) - week.minToY(H(20))).toBeCloseTo(54, 6)
  })
})

describe('railLabels', () => {
  it('mockup 08: 9:00 · 12:00 · 3:00 · 8:00 · 9:00 · 9:30 · 10:00 · 10:30', () => {
    const map = buildSegments([{ key: 'movie', start: H(20), end: H(21, 30) }], [], H(9), H(22, 30))
    const rows = [
      { start: H(9), end: H(9, 1), capsule: false },
      { start: H(20), end: H(21, 30), capsule: true },
      { start: H(22, 30), end: H(22, 31), capsule: false },
    ]
    expect(railLabels(map, rows).map((l) => l.min)).toEqual([H(9), H(12), H(15), H(20), H(21), H(21, 30), H(22), H(22, 30)])
  })
})

describe('visibleByY', () => {
  it('keeps only rows meeting the pixel window', () => {
    const rows = [
      { key: 'a', start: H(7), end: H(8) },
      { key: 'b', start: H(20), end: H(21) },
    ]
    const map = buildSegments(rows, [], H(6), H(22))
    const yA = map.minToY(H(7))
    expect(visibleByY(map, rows, yA - 10, yA + 10).map((r) => r.key)).toEqual(['a'])
  })
})
