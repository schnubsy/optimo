import { describe, expect, it } from 'vitest'
import { changedFields, mergeRow } from '../../src/sync/merge'

const base = {
  id: 't1',
  title: 'Draft',
  notes: '',
  start_at: '2026-09-26T09:00:00.000Z',
  deleted_at: null as string | null,
  version: 3,
  field_ts: { title: 100, notes: 100, start_at: 100, deleted_at: 100 } as Record<string, number>,
}

describe('mergeRow — mirrors planner_merge()', () => {
  it('newer field wins, older field keeps the stored value (the SQL round-trip)', () => {
    // device A renamed at 200; device B (older clock for title) moved the block at 300
    const stored = { ...base, title: 'Renamed', field_ts: { ...base.field_ts, title: 200 } }
    const incoming = { ...base, title: 'Draft', start_at: '2026-09-26T10:00:00.000Z', field_ts: { ...base.field_ts, start_at: 300 } }
    const m = mergeRow(stored, incoming)
    expect(m.title).toBe('Renamed')
    expect(m.start_at).toBe('2026-09-26T10:00:00.000Z')
    expect(m.field_ts).toEqual({ title: 200, notes: 100, start_at: 300, deleted_at: 100 })
  })

  it('is symmetric in outcome whichever side arrives first', () => {
    const a = { ...base, title: 'A', field_ts: { ...base.field_ts, title: 200 } }
    const b = { ...base, notes: 'B', field_ts: { ...base.field_ts, notes: 250 } }
    const ab = mergeRow(mergeRow(base, a), b)
    const ba = mergeRow(mergeRow(base, b), a)
    expect(ab.title).toBe('A')
    expect(ab.notes).toBe('B')
    expect(ba.title).toBe('A')
    expect(ba.notes).toBe('B')
    expect(ab.field_ts).toEqual(ba.field_ts)
  })

  it('tombstones merge like any field: a newer delete wins, an older one loses', () => {
    const del = { ...base, deleted_at: '2026-09-26T12:00:00.000Z', field_ts: { ...base.field_ts, deleted_at: 400 } }
    expect(mergeRow(base, del).deleted_at).toBe('2026-09-26T12:00:00.000Z')
    const staleDel = { ...base, deleted_at: '2026-09-26T12:00:00.000Z', field_ts: { ...base.field_ts, deleted_at: 50 } }
    expect(mergeRow(base, staleDel).deleted_at).toBeNull()
  })

  it('equal timestamps take the incoming value and leave field_ts unchanged (SQL tie rule)', () => {
    const inc = { ...base, notes: 'same-ts' }
    const m = mergeRow(base, inc)
    expect(m.notes).toBe('same-ts')
    expect(m.field_ts).toEqual(base.field_ts)
  })

  it('field_ts merges to the per-field max', () => {
    const stored = { ...base, field_ts: { title: 500, notes: 10, start_at: 100, deleted_at: 100 } }
    const inc = { ...base, field_ts: { title: 20, notes: 600, start_at: 100, deleted_at: 100 } }
    expect(mergeRow(stored, inc).field_ts).toEqual({ title: 500, notes: 600, start_at: 100, deleted_at: 100 })
  })

  it('never arbitrates identity/bookkeeping keys and takes them from incoming', () => {
    const inc = { ...base, version: 9, field_ts: { ...base.field_ts } }
    expect(mergeRow({ ...base, field_ts: { ...base.field_ts, version: 999 } }, inc).version).toBe(9)
  })

  it('missing incoming ts counts as 0 (keeps stored)', () => {
    const inc = { ...base, title: 'no-ts', field_ts: {} }
    expect(mergeRow(base, inc).title).toBe('Draft')
  })
})

describe('changedFields', () => {
  it('deep-compares JSON fields and skips bookkeeping', () => {
    expect(changedFields({ a: [1], b: 'x', version: 1 }, { a: [1], b: 'y', version: 2 })).toEqual(['b'])
    expect(changedFields(undefined, { a: 1, field_ts: {} })).toEqual(['a'])
  })
})
