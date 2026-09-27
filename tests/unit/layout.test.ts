import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OptimoDB, useDatabase, db } from '../../src/data/db'
import * as repo from '../../src/data/repo'
import { resizeItem } from '../../src/actions'
import { toItem } from '../../src/timeline/items'
import { clampStart, clusterShort, firstFit, freeRows, isLate, isOutOfBounds, layoutColumns, MIN_DURATION, pushDown, resizeTo, snap } from '../../src/timeline/layout'
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

describe('resizeTo', () => {
  it('adds the dragged minutes, snapped to the setting', () => {
    expect(resizeTo(90, 28, 56, 5)).toBe(120)
    expect(resizeTo(30, 10, 60, 15)).toBe(45)
  })
  it('never goes below the 5-minute minimum, whatever the snap', () => {
    expect(resizeTo(30, -500, 56, 15)).toBe(MIN_DURATION)
    expect(resizeTo(10, -8, 60, 10)).toBe(MIN_DURATION)
  })
})

describe('isLate (#1)', () => {
  it('is late only when not done, ended and today', () => {
    expect(isLate(600, false, 650)).toBe(true)
    expect(isLate(600, true, 650)).toBe(false)
    expect(isLate(700, false, 650)).toBe(false)
    expect(isLate(600, false, null)).toBe(false)
  })
})

describe('resize commit (slice 1 + 2)', () => {
  beforeEach(async () => {
    useDatabase(new OptimoDB(`t-${Math.random()}`))
    await db.open()
  })
  it('writes duration_min only — never start_at — through the repo layer', async () => {
    const t = await repo.createTask({ title: 'Plan', start_at: '2026-09-26T14:00:00.000Z', duration_min: 90 })
    vi.useFakeTimers({ now: Date.now() + 5000, toFake: ['Date'] })
    await resizeItem(toItem(t, '2026-09-26'), 120)
    vi.useRealTimers()
    const after = (await db.tasks.get(t.id))!
    expect(after.duration_min).toBe(120)
    expect(after.start_at).toBe(t.start_at)
    expect(after.field_ts.duration_min).toBeGreaterThan(t.field_ts.duration_min)
    expect(after.field_ts.start_at).toBe(t.field_ts.start_at)
    const out = await db.outbox.toArray()
    expect(out.at(-1)!.payload.duration_min).toBe(120)
  })
})

describe('clusterShort (+n pill)', () => {
  it('collapses three or more short pills starting within 30 min', () => {
    const spans = [s('a', 600, 615), s('b', 610, 625), s('c', 625, 640), s('d', 700, 760)]
    expect(clusterShort(spans)).toEqual([['a', 'b', 'c']])
  })
  it('leaves two short pills, long pills and spread-out shorts alone', () => {
    expect(clusterShort([s('a', 600, 615), s('b', 610, 625)])).toEqual([])
    expect(clusterShort([s('a', 600, 660), s('b', 605, 665), s('c', 610, 670)])).toEqual([])
    expect(clusterShort([s('a', 600, 615), s('b', 640, 655), s('c', 680, 695)])).toEqual([])
  })
})

import { keyboardInset } from '../../src/quickadd/QuickAdd'
describe('keyboardInset (A2-P0-4)', () => {
  it('is the height the keyboard takes from the layout viewport', () => {
    expect(keyboardInset(852, 852, 0)).toBe(0)
    expect(keyboardInset(852, 516, 0)).toBe(336)
    expect(keyboardInset(852, 516, 20)).toBe(316)
    expect(keyboardInset(852, 900, 0)).toBe(0)
  })
})
