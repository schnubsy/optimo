// arc 6 slice 7 — Dexie v3 → v4 (tasks gain `tz`, no new index) keeps every row of a 5k library.
// arc 7 slice 7 — Dexie v4 → v5 (db/008: plan_date / someday / estimated, index [_kind+plan_date]) fills the column
// defaults on every row without stamping field_ts, and re-derives _kind.
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { OptimoDB } from '../../src/data/db'

function oldSchema(db: Dexie, upTo: 3 | 4) {
  db.version(1).stores({
    tasks: 'id, start_at, category_id, series_id, _kind, [_kind+sort_key], [_kind+start_at]',
    categories: 'id, sort_key',
    exceptions: '[series_id+occurrence_date], series_id, task_id',
    settings: 'id',
    outbox: '++seq, [table+id]',
    meta: 'key',
  })
  db.version(2).stores({ events: 'id, start_at, account_id' })
  db.version(3).stores({ aiPlans: 'id, plan_date', aiProfile: 'id' })
  if (upTo === 4) db.version(4).stores({})
}

describe('Dexie upgrades', () => {
  // fake-indexeddb re-indexes a modified row in O(n), so the v5 upgrade (which rewrites every row) is quadratic here:
  // 1 000 rows ≈ 4 s, 5 000 ≈ 100 s. The 5k-library upgrade is timed on real IndexedDB in tests/inboxfirst.spec.ts.
  it('opens a v3 database holding 1 000 tasks without losing any (→ v5)', async () => {
    const name = `upgrade-${Math.random()}`
    const v3 = new Dexie(name)
    oldSchema(v3, 3)
    await v3.open()
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, start_at: new Date(Date.UTC(2026, 9, 1 + (i % 30), 8)).toISOString(), _kind: 'sched', sort_key: i, field_ts: { title: 5 } }))
    await v3.table('tasks').bulkPut(rows)
    v3.close()

    const db = new OptimoDB(name)
    await db.open()
    expect(db.verno).toBe(5)
    expect(await db.tasks.count()).toBe(1000)
    expect(await db.tasks.get('t999')).toMatchObject({ title: 'Task 999', _kind: 'sched', plan_date: null, someday: false, estimated: true })
    expect((await db.tasks.get('t0'))?.tz).toBeUndefined()
    await db.tasks.update('t0', { tz: 'Europe/London' })
    expect((await db.tasks.get('t0'))?.tz).toBe('Europe/London')
    db.close()
  }, 60_000)

  it('v4 → v5 fills defaults (no field_ts), keeps present values, re-derives _kind and indexes plan_date', async () => {
    const name = `upgrade5-${Math.random()}`
    const v4 = new Dexie(name)
    oldSchema(v4, 4)
    await v4.open()
    await v4.table('tasks').bulkPut([
      { id: 'inbox', title: 'Captured', start_at: null, rrule: null, series_id: null, deleted_at: null, _kind: 'inbox', sort_key: 1, field_ts: { title: 7 } },
      { id: 'sched', title: 'Timed', start_at: '2026-10-09T14:00:00.000Z', rrule: null, series_id: null, deleted_at: null, _kind: 'sched', sort_key: 2, field_ts: { title: 7 } },
      { id: 'series', title: 'Daily', start_at: '2026-10-09T08:00:00.000Z', rrule: 'FREQ=DAILY', series_id: null, deleted_at: null, _kind: 'series', sort_key: 3, field_ts: {} },
      { id: 'gone', title: 'Deleted', start_at: null, rrule: null, series_id: null, deleted_at: '2026-10-01T00:00:00.000Z', _kind: 'gone', sort_key: 4, field_ts: {} },
      // a row a newer client already wrote (e.g. synced down before the upgrade ran): its values win, _kind is fixed
      { id: 'pre', title: 'Planned early', start_at: null, rrule: null, series_id: null, deleted_at: null, plan_date: '2026-10-12', someday: false, estimated: false, _kind: 'inbox', sort_key: 5, field_ts: { plan_date: 9 } },
    ])
    await v4.table('outbox').add({ table: 'tasks', id: 'inbox', op: 'upsert', payload: { id: 'inbox' }, field_ts: {} })
    v4.close()

    const db = new OptimoDB(name)
    await db.open()
    expect(db.verno).toBe(5)
    const all = Object.fromEntries((await db.tasks.toArray()).map((t) => [t.id, t]))
    expect(all.inbox).toMatchObject({ _kind: 'inbox', plan_date: null, someday: false, estimated: true, field_ts: { title: 7 } })
    expect(all.inbox.field_ts.plan_date).toBeUndefined() // defaults carry no timestamp: any synced value outranks them
    expect(all.sched).toMatchObject({ _kind: 'sched', plan_date: null, someday: false, estimated: true })
    expect(all.series._kind).toBe('series')
    expect(all.gone._kind).toBe('gone')
    expect(all.pre).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12', estimated: false, field_ts: { plan_date: 9 } })
    expect(await db.outbox.count()).toBe(1) // the upgrade queues nothing and drops nothing
    const planned = await db.tasks.where('[_kind+plan_date]').between(['planned', ''], ['planned', '￿']).toArray()
    expect(planned.map((t) => t.id)).toEqual(['pre'])
    db.close()
  })
})
