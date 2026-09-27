import { describe, expect, it } from 'vitest'
import { clampStart, firstFit, freeRows, isOutOfBounds, layoutColumns, pushDown, snap } from '../../src/timeline/layout'
import { dayStats } from '../../src/views/stats'
import { visibleWindow } from '../../src/timeline/virtual'

const s = (id: string, start: number, end: number) => ({ id, start, end })

describe('layoutColumns', () => {
  it('non-overlapping blocks get one column each', () => {
    const out = layoutColumns([s('a', 60, 120), s('b', 120, 180)])
    expect(out.map((p) => [p.id, p.col, p.cols])).toEqual([['a', 0, 1], ['b', 0, 1]])
  })
  it('overlapping blocks go side by side', () => {
    const out = layoutColumns([s('a', 960, 990), s('b', 975, 1005)])
    expect(out.map((p) => [p.id, p.col, p.cols])).toEqual([['a', 0, 2], ['b', 1, 2]])
  })
  it('a transitive cluster shares the column count and reuses freed columns', () => {
    const out = layoutColumns([s('a', 0, 60), s('b', 30, 90), s('c', 60, 120)])
    const by = Object.fromEntries(out.map((p) => [p.id, p]))
    expect(by.a.cols).toBe(2)
    expect(by.c.col).toBe(0) // a's column is free again at 60
  })
  it('zero-length blocks still occupy a slot', () => {
    const out = layoutColumns([s('a', 60, 60), s('b', 60, 90)])
    expect(out[0].cols).toBe(2)
  })
})

describe('snap / bounds', () => {
  it('snaps to 5/10/15', () => {
    expect(snap(62, 5)).toBe(60)
    expect(snap(63, 5)).toBe(65)
    expect(snap(64, 10)).toBe(60)
    expect(snap(68, 15)).toBe(75)
  })
  it('clamps a moved block inside the day keeping duration', () => {
    expect(clampStart(-30, 60)).toBe(0)
    expect(clampStart(1430, 60)).toBe(1380)
  })
  it('flags out-of-bounds blocks', () => {
    expect(isOutOfBounds({ start: 300, end: 330 }, 360, 1320)).toBe(true)
    expect(isOutOfBounds({ start: 340, end: 400 }, 360, 1320)).toBe(false)
    expect(isOutOfBounds({ start: 1320, end: 1380 }, 360, 1320)).toBe(true)
  })
})

describe('freeRows / firstFit', () => {
  const day = [s('run', 420, 465), s('deep', 540, 660), s('lunch', 780, 840)]
  it('lists gaps inside bounds at least minLen long', () => {
    expect(freeRows(day, 360, 900, 15)).toEqual([
      { start: 360, len: 60 },
      { start: 465, len: 75 },
      { start: 660, len: 120 },
      { start: 840, len: 60 },
    ])
  })
  it('trims gaps already in the past', () => {
    expect(freeRows(day, 360, 900, 15, 700)[0]).toEqual({ start: 700, len: 80 })
  })
  it('handles overlapping busy spans', () => {
    expect(freeRows([s('a', 60, 120), s('b', 90, 150)], 0, 240, 15)).toEqual([{ start: 0, len: 60 }, { start: 150, len: 90 }])
  })
  it('Place = earliest free row that fits', () => {
    expect(firstFit(freeRows(day, 360, 900), 90)).toEqual({ start: 660, len: 120 })
  })
})

describe('pushDown', () => {
  it('shifts later overlapping blocks, keeping order and durations', () => {
    const out = pushDown([s('m', 60, 120), s('x', 90, 120), s('y', 120, 180), s('z', 300, 330)], 'm')
    const by = Object.fromEntries(out.map((p) => [p.id, p]))
    expect(by.x).toMatchObject({ start: 120, end: 150 })
    expect(by.y).toMatchObject({ start: 150, end: 210 })
    expect(by.z).toMatchObject({ start: 300, end: 330 })
  })
})

describe('dayStats', () => {
  it('counts planned within bounds, free, done and late', () => {
    const items = [
      { key: 'a', start: 420, end: 480, task: { completed_at: 'x', all_day: false } },
      { key: 'b', start: 540, end: 600, task: { completed_at: null, all_day: false } },
      { key: 'c', start: 700, end: 760, task: { completed_at: null, all_day: false } },
    ] as never
    const st = dayStats(items, 360, 1320, 650)
    expect(st).toEqual({ planned: 180, free: 780, done: 1, total: 3, late: 1 })
  })
})

describe('visibleWindow', () => {
  it('covers the viewport ± one screen', () => {
    expect(visibleWindow(560, 560, 56)).toEqual({ from: 0, to: 1800 })
    expect(visibleWindow(0, 0, 56)).toEqual({ from: 0, to: 1440 })
  })
})
