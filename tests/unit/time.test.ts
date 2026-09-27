import { describe, expect, it } from 'vitest'
import { formatDayTitle } from '../../src/lib/time'

describe('formatDayTitle', () => {
  it('formats the strip date', () => {
    expect(formatDayTitle(new Date(2026, 8, 26))).toBe('Sat 26 Sep 2026')
  })
})
