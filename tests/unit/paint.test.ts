import { describe, expect, it } from 'vitest'
import { paintMin, paintSpan, yToMin } from '../../src/timeline/paint'

describe('paintSpan (arc 5a slice 4)', () => {
  it('snaps both ends to the grid', () => {
    expect(paintSpan(9 * 60 + 13, 10 * 60 + 28, 5)).toEqual({ start: 555, end: 630 }) // 09:15–10:30
    expect(paintSpan(9 * 60 + 7, 10 * 60 + 22, 15)).toEqual({ start: 540, end: 615 }) // 09:00–10:15
    expect(paintSpan(9 * 60 + 4, 9 * 60 + 36, 10)).toEqual({ start: 540, end: 580 })
  })
  it('paints upward from the press point', () => {
    expect(paintSpan(11 * 60, 9 * 60 + 47, 15)).toEqual({ start: 9 * 60 + 45, end: 11 * 60 })
    expect(paintSpan(600, 541, 5)).toEqual({ start: 540, end: 600 })
  })
  it('never paints less than one snap step (or the 5-min minimum)', () => {
    expect(paintSpan(600, 600, 15)).toEqual({ start: 600, end: 615 })
    expect(paintSpan(600, 602, 5)).toEqual({ start: 600, end: 605 })
    // a tiny upward drag grows upward
    expect(paintSpan(600, 598, 10)).toEqual({ start: 590, end: 600 })
    expect(paintMin(5)).toBe(5)
    expect(paintMin(15)).toBe(15)
  })
  it('clamps to the day', () => {
    expect(paintSpan(60, -200, 15)).toEqual({ start: 0, end: 60 })
    expect(paintSpan(23 * 60, 26 * 60, 15)).toEqual({ start: 23 * 60, end: 1440 })
    expect(paintSpan(1440, 1450, 15)).toEqual({ start: 1425, end: 1440 })
    expect(paintSpan(-3, -1, 5)).toEqual({ start: 0, end: 5 })
  })
  it('maps pixels to minutes at both densities', () => {
    expect(yToMin(72 * 9.25, 72)).toBeCloseTo(555)
    expect(yToMin(66 * 9.25, 66)).toBeCloseTo(555)
  })
})
