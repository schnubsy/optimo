// arc 6 slice 7 — Dexie v3 → v4 (tasks gain `tz`, no new index) keeps every row of a 5k library.
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { OptimoDB } from '../../src/data/db'

describe('Dexie v4 upgrade', () => {
  it('opens a v3 database holding 5 000 tasks without losing or rewriting any', async () => {
    const name = `upgrade-${Math.random()}`
    const v3 = new Dexie(name)
    v3.version(1).stores({
      tasks: 'id, start_at, category_id, series_id, _kind, [_kind+sort_key], [_kind+start_at]',
      categories: 'id, sort_key',
      exceptions: '[series_id+occurrence_date], series_id, task_id',
      settings: 'id',
      outbox: '++seq, [table+id]',
      meta: 'key',
    })
    v3.version(2).stores({ events: 'id, start_at, account_id' })
    v3.version(3).stores({ aiPlans: 'id, plan_date', aiProfile: 'id' })
    await v3.open()
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, start_at: new Date(Date.UTC(2026, 9, 1 + (i % 30), 8)).toISOString(), _kind: 'sched', sort_key: i }))
    await v3.table('tasks').bulkPut(rows)
    v3.close()

    const db = new OptimoDB(name)
    await db.open()
    expect(db.verno).toBe(4)
    expect(await db.tasks.count()).toBe(5000)
    expect(await db.tasks.get('t4999')).toMatchObject({ title: 'Task 4999', _kind: 'sched' })
    expect((await db.tasks.get('t0'))?.tz).toBeUndefined()
    await db.tasks.update('t0', { tz: 'Europe/London' })
    expect((await db.tasks.get('t0'))?.tz).toBe('Europe/London')
    db.close()
  })
})
