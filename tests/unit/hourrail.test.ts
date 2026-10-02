// Snag train 2026-10, slice 1 (Fixes #15): the now-pill must mask the hour numeral it overlaps.
import { describe, expect, it } from 'vitest'
import { hourNumeralHidden } from '../../src/timeline/HourRail'

describe('hourNumeralHidden', () => {
  it('hides the numeral within 12 minutes of the hour mark', () => {
    expect(hourNumeralHidden(15 * 60, 15 * 60)).toBe(true) // exactly on the hour
    expect(hourNumeralHidden(15 * 60 + 6, 15 * 60)).toBe(true) // 6 min after
    expect(hourNumeralHidden(15 * 60 - 11, 15 * 60)).toBe(true) // 11 min before
  })
  it('shows the numeral at or beyond the 12-minute boundary', () => {
    expect(hourNumeralHidden(15 * 60 + 12, 15 * 60)).toBe(false)
    expect(hourNumeralHidden(15 * 60 - 12, 15 * 60)).toBe(false)
    expect(hourNumeralHidden(13 * 60, 15 * 60)).toBe(false)
  })
  it('never hides when there is no now (not today)', () => {
    expect(hourNumeralHidden(null, 15 * 60)).toBe(false)
    expect(hourNumeralHidden(undefined, 15 * 60)).toBe(false)
  })
})
