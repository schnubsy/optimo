// arc 7 slice 4: the edge-only, speed-capped auto-scroll step and the activator point.
import { describe, expect, it } from 'vitest'
import { EDGE, MAX_STEP, edgeStep, pointOf } from '../../src/lib/dragScroll'
import { fmtH } from '../../src/views/Week'

describe('edgeStep', () => {
  const top = 100
  const bottom = 700
  it('never scrolls in the middle of the container', () => {
    for (const y of [top + EDGE + 1, 400, bottom - EDGE - 1]) {
      expect(edgeStep(y, top, bottom, 1)).toBe(0)
      expect(edgeStep(y, top, bottom, -1)).toBe(0)
    }
  })
  it('scrolls only the way the pointer travelled', () => {
    expect(edgeStep(bottom - 10, top, bottom, -1)).toBe(0)
    expect(edgeStep(top + 10, top, bottom, 1)).toBe(0)
    expect(edgeStep(bottom - 10, top, bottom, 0)).toBe(0)
    expect(edgeStep(bottom - 10, top, bottom, 1)).toBeGreaterThan(0)
    expect(edgeStep(top + 10, top, bottom, -1)).toBeLessThan(0)
  })
  it('ramps with depth into the band and is capped at MAX_STEP, even past the edge', () => {
    const a = edgeStep(bottom - EDGE + 4, top, bottom, 1)
    const b = edgeStep(bottom - 4, top, bottom, 1)
    expect(a).toBeGreaterThanOrEqual(1)
    expect(b).toBeGreaterThan(a)
    expect(edgeStep(bottom + 200, top, bottom, 1)).toBe(MAX_STEP)
    expect(edgeStep(top - 200, top, bottom, -1)).toBe(-MAX_STEP)
  })
  it('a container shorter than three bands never auto-scrolls', () => {
    expect(edgeStep(105, 100, 100 + EDGE * 3 - 1, 1)).toBe(0)
  })
})

describe('pointOf', () => {
  it('reads mouse and touch events', () => {
    expect(pointOf({ clientX: 3, clientY: 4 } as unknown as Event)).toEqual({ x: 3, y: 4 })
    expect(pointOf({ touches: [{ clientX: 5, clientY: 6 }] } as unknown as Event)).toEqual({ x: 5, y: 6 })
    expect(pointOf({ touches: [], changedTouches: [{ clientX: 7, clientY: 8 }] } as unknown as Event)).toEqual({ x: 7, y: 8 })
    expect(pointOf(null)).toBeNull()
  })
})

describe('fmtH (week header planned / free)', () => {
  it('formats hours and minutes compactly', () => {
    expect(fmtH(0)).toBe('0m')
    expect(fmtH(45)).toBe('45m')
    expect(fmtH(120)).toBe('2h')
    expect(fmtH(150)).toBe('2h30')
    expect(fmtH(605)).toBe('10h05')
  })
})
