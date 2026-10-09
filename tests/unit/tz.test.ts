// arc 6 slice 7 — per-task time zones: wall-clock in a zone ↔ the UTC instant (src/lib/time.ts).
import { describe, expect, it } from 'vitest'
import { isoAtZone, tzOffset, zonedParts, zoneCity } from '../../src/lib/time'

describe('time zones', () => {
  it('9:00 in London on 2026-10-09 (BST) is 08:00 UTC, which is 3:00 AM in Chicago (CDT)', () => {
    const iso = isoAtZone('2026-10-09', 9 * 60, 'Europe/London')
    expect(iso).toBe('2026-10-09T08:00:00.000Z')
    expect(zonedParts(iso, 'America/Chicago')).toEqual({ date: '2026-10-09', minutes: 3 * 60 })
    expect(zonedParts(iso, 'Europe/London')).toEqual({ date: '2026-10-09', minutes: 9 * 60 })
  })
  it('winter offsets and day roll-over', () => {
    expect(isoAtZone('2026-12-01', 30, 'Europe/London')).toBe('2026-12-01T00:30:00.000Z')
    expect(zonedParts('2026-12-01T00:30:00.000Z', 'America/Los_Angeles')).toEqual({ date: '2026-11-30', minutes: 16 * 60 + 30 })
    expect(tzOffset(Date.UTC(2026, 6, 1), 'Asia/Kolkata')).toBe(5.5 * 3600_000)
  })
  it('round-trips across a DST start (New York, 2026-03-08)', () => {
    for (const m of [60, 3 * 60, 4 * 60, 12 * 60]) expect(zonedParts(isoAtZone('2026-03-08', m, 'America/New_York'), 'America/New_York').minutes).toBe(m)
  })
  it('city label', () => expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires'))
})
