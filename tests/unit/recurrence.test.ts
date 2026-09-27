import { beforeEach, describe, expect, it } from 'vitest'
import { OptimoDB, db, useDatabase } from '../../src/data/db'
import * as repo from '../../src/data/repo'
import { expand, materialize, occurrencesInRange } from '../../src/recurrence/materialize'
import { editOccurrence, untilBefore } from '../../src/recurrence/exceptions'
import { dateKey, isoAt } from '../../src/lib/time'
import type { Task } from '../../src/data/types'

const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi)
const keys = (ds: Date[]) => ds.map((d) => `${dateKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
// Sat 26 Sep 2026 … Sat 31 Oct 2026
const FROM = local(2026, 9, 26)
const TO = local(2026, 10, 31)

describe('expand (floating local time)', () => {
  const start = local(2026, 9, 26, 9, 0).toISOString()
  it('daily', () => {
    expect(keys(expand('FREQ=DAILY', start, FROM, local(2026, 9, 29)))).toEqual(['2026-09-26 09:00', '2026-09-27 09:00', '2026-09-28 09:00'])
  })
  it('weekday skips the weekend', () => {
    expect(keys(expand('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', start, FROM, local(2026, 10, 3)))).toEqual([
      '2026-09-28 09:00', '2026-09-29 09:00', '2026-09-30 09:00', '2026-10-01 09:00', '2026-10-02 09:00',
    ])
  })
  it('weekly on the start weekday', () => {
    expect(keys(expand('FREQ=WEEKLY;BYDAY=SA', start, FROM, local(2026, 10, 18)))).toEqual(['2026-09-26 09:00', '2026-10-03 09:00', '2026-10-10 09:00', '2026-10-17 09:00'])
  })
  it('monthly by month day', () => {
    expect(keys(expand('FREQ=MONTHLY;BYMONTHDAY=26', start, FROM, local(2027, 1, 1)))).toEqual(['2026-09-26 09:00', '2026-10-26 09:00', '2026-11-26 09:00', '2026-12-26 09:00'])
  })
  it('keeps 09:00 local wall-clock across a DST change', () => {
    const all = expand('FREQ=DAILY', start, local(2026, 10, 20), local(2026, 11, 10))
    expect(new Set(all.map((d) => d.getHours()))).toEqual(new Set([9]))
  })
  it('UNTIL ends the series', () => {
    const r = untilBefore('FREQ=DAILY', '2026-09-29')
    expect(r).toBe('FREQ=DAILY;UNTIL=20260928T235959Z')
    expect(keys(expand(r, start, FROM, TO))).toEqual(['2026-09-26 09:00', '2026-09-27 09:00', '2026-09-28 09:00'])
  })
})

const series = (over: Partial<Task> = {}): Task => ({
  ...repo.blankTask({ title: 'Stretch', rrule: 'FREQ=DAILY', dtstart: local(2026, 9, 26, 7).toISOString(), start_at: local(2026, 9, 26, 7).toISOString(), duration_min: 15 }),
  id: 'S',
  ...over,
})

describe('materialize (pure)', () => {
  it('skipped occurrences disappear', () => {
    const out = materialize([series()], [{ series_id: 'S', occurrence_date: '2026-09-27', task_id: null, skipped: true, deleted_at: null, field_ts: {}, device_id: null }], [], FROM.toISOString(), local(2026, 9, 29).toISOString())
    expect(out.map((o) => o.occurrence.date)).toEqual(['2026-09-26', '2026-09-28'])
  })
  it('an override replaces its occurrence and lands at its own (moved) time', () => {
    const ov = { ...repo.blankTask({ title: 'Stretch (long)', start_at: local(2026, 9, 27, 20).toISOString(), duration_min: 30, series_id: 'S' }), id: 'O' }
    const out = materialize(
      [series()],
      [{ series_id: 'S', occurrence_date: '2026-09-27', task_id: 'O', skipped: false, deleted_at: null, field_ts: {}, device_id: null }],
      [ov],
      FROM.toISOString(),
      local(2026, 9, 29).toISOString(),
    )
    const d27 = out.filter((o) => o.occurrence.date === '2026-09-27')
    expect(d27).toHaveLength(1)
    expect(d27[0].task.title).toBe('Stretch (long)')
    expect(new Date(d27[0].task.start_at!).getHours()).toBe(20)
  })
  it('a tombstoned exception no longer applies', () => {
    const out = materialize([series()], [{ series_id: 'S', occurrence_date: '2026-09-27', task_id: null, skipped: true, deleted_at: 'x', field_ts: {}, device_id: null }], [], FROM.toISOString(), local(2026, 9, 29).toISOString())
    expect(out).toHaveLength(3)
  })
})

describe('editOccurrence (through the repo)', () => {
  beforeEach(async () => {
    useDatabase(new OptimoDB(`r-${Math.random()}`))
    await db.open()
    await repo.createTask({ title: 'Stretch', rrule: 'FREQ=DAILY', dtstart: local(2026, 9, 26, 7).toISOString(), start_at: local(2026, 9, 26, 7).toISOString(), duration_min: 15 }, 'S')
  })
  const occ = async (to = local(2026, 10, 3)) => {
    const s = await db.tasks.where('_kind').equals('series').toArray()
    return occurrencesInRange(s, FROM.toISOString(), to.toISOString())
  }

  it('this: override row + exception; completion is per occurrence', async () => {
    await editOccurrence('S', '2026-09-27', { completed_at: local(2026, 9, 27, 7, 20).toISOString() }, 'this')
    const out = await occ()
    expect(out.filter((o) => o.task.completed_at).map((o) => o.occurrence.date)).toEqual(['2026-09-27'])
    const ex = await db.exceptions.get(['S', '2026-09-27'])
    expect(ex?.task_id).toBeTruthy()
    expect((await db.tasks.get(ex!.task_id!))?.series_id).toBe('S')
    // editing the same occurrence again updates the same override
    await editOccurrence('S', '2026-09-27', { title: 'Stretch + foam roll' }, 'this')
    expect((await db.tasks.get(ex!.task_id!))?.title).toBe('Stretch + foam roll')
  })

  it('this: move one occurrence to another time', async () => {
    await editOccurrence('S', '2026-09-28', { start_at: isoAt('2026-09-28', 18 * 60) }, 'this')
    const d28 = (await occ()).filter((o) => o.occurrence.date === '2026-09-28')
    expect(d28).toHaveLength(1)
    expect(new Date(d28[0].task.start_at!).getHours()).toBe(18)
  })

  it('this: delete = skip', async () => {
    await editOccurrence('S', '2026-09-29', { deleted_at: new Date().toISOString() }, 'this')
    expect((await occ()).map((o) => o.occurrence.date)).not.toContain('2026-09-29')
    expect((await db.exceptions.get(['S', '2026-09-29']))?.skipped).toBe(true)
  })

  it('following: splits the series at the occurrence', async () => {
    await editOccurrence('S', '2026-09-30', { start_at: isoAt('2026-09-30', 6 * 60 + 30), title: 'Early stretch' }, 'following')
    const out = await occ()
    const by = Object.fromEntries(out.map((o) => [o.occurrence.date, o.task]))
    expect(by['2026-09-29'].title).toBe('Stretch')
    expect(new Date(by['2026-09-29'].start_at!).getHours()).toBe(7)
    expect(by['2026-09-30'].title).toBe('Early stretch')
    expect(new Date(by['2026-10-02'].start_at!).getMinutes()).toBe(30)
    expect(out.filter((o) => o.occurrence.date === '2026-09-30')).toHaveLength(1)
    expect((await db.tasks.get('S'))?.rrule).toContain('UNTIL=20260929T235959Z')
  })

  it('all: edits the series row (time + title) for every occurrence', async () => {
    await editOccurrence('S', '2026-09-30', { start_at: isoAt('2026-09-30', 8 * 60), title: 'Mobility' }, 'all')
    const out = await occ()
    expect(new Set(out.map((o) => `${o.task.title}@${new Date(o.task.start_at!).getHours()}`))).toEqual(new Set(['Mobility@8']))
    expect(out[0].occurrence.date).toBe('2026-09-26')
  })
})
