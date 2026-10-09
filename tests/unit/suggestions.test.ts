import { describe, expect, it } from 'vitest'
import { buildSuggestions, SEED_SUGGESTIONS } from '../../src/editor/suggestions'

const NOW = new Date(2026, 9, 9, 12, 0)
const at = (daysAgo: number, h: number, m = 0) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const t = (title: string, start_at: string | null, duration_min = 30, category_id: string | null = null, extra: Record<string, unknown> = {}) => ({
  title,
  start_at,
  duration_min,
  category_id,
  deleted_at: null,
  all_day: false,
  ...extra,
})

describe('buildSuggestions', () => {
  it('no history → our seed set, filtered by the query', () => {
    expect(buildSuggestions([], NOW).map((s) => s.title)).toEqual(['Answer emails', 'Walk', 'Groceries', 'Movie night', 'Run'])
    expect(buildSuggestions([], NOW, 'mov').map((s) => s.title)).toEqual(['Movie night'])
    expect(SEED_SUGGESTIONS.find((s) => s.title === 'Movie night')).toMatchObject({ start: 1200, duration: 90 })
  })

  it('inbox rows, deleted rows, all-day rows and rows outside the 60-day window do not count', () => {
    const rows = [
      t('Inbox thing', null),
      t('Gone', at(1, 9), 30, null, { deleted_at: at(0, 1) }),
      t('Holiday', at(2, 0), 0, null, { all_day: true }),
      t('Ancient', at(61, 9)),
      t('Future', at(-3, 9)),
    ]
    expect(buildSuggestions(rows, NOW)[0].seed).toBe(true)
  })

  it('distinct titles case-insensitively → mode start, median duration, mode category; newest spelling', () => {
    const rows = [
      t('swim', at(10, 7), 30, 'h'),
      t('Swim', at(8, 7), 45, 'h'),
      t('SWIM', at(6, 18), 60, 'x'),
      t('Swim', at(2, 7), 90, 'h'),
    ]
    const [s] = buildSuggestions(rows, NOW)
    expect(s).toMatchObject({ title: 'Swim', start: 7 * 60, duration: 45, category_id: 'h', count: 4 })
  })

  it('sorted by frequency then recency, filtered by the query', () => {
    const rows = [t('Read', at(5, 21)), t('Read', at(4, 21)), t('Write', at(3, 9)), t('Plan week', at(1, 8))]
    expect(buildSuggestions(rows, NOW).map((s) => s.title)).toEqual(['Read', 'Plan week', 'Write'])
    expect(buildSuggestions(rows, NOW, 'WR').map((s) => s.title)).toEqual(['Write'])
    expect(buildSuggestions(rows, NOW, 'zzz')).toEqual([])
  })

  it('a start-minute tie goes to the most recent', () => {
    const rows = [t('Call', at(5, 9)), t('Call', at(3, 14))]
    expect(buildSuggestions(rows, NOW)[0].start).toBe(14 * 60)
  })
})
