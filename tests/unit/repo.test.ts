import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OptimoDB, useDatabase, db } from '../../src/data/db'
import * as repo from '../../src/data/repo'

beforeEach(async () => {
  useDatabase(new OptimoDB(`t-${Math.random()}`))
  await db.open()
})

describe('repo — outbox stamping', () => {
  it('create stamps every data field and enqueues one outbox row', async () => {
    const t = await repo.createTask({ title: 'Write plan', start_at: '2026-09-26T14:00:00.000Z', duration_min: 90 })
    for (const k of ['title', 'notes', 'start_at', 'duration_min', 'priority', 'subtasks', 'deleted_at']) expect(t.field_ts[k]).toBeGreaterThan(0)
    expect(t.field_ts.id).toBeUndefined()
    expect(t._kind).toBe('sched')
    const out = await db.outbox.toArray()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ table: 'tasks', id: t.id, op: 'upsert' })
    expect(out[0].payload._kind).toBeUndefined()
  })

  it('update stamps only the changed fields with a newer ts', async () => {
    const t = await repo.createTask({ title: 'A' })
    vi.useFakeTimers({ now: Date.now() + 5000, toFake: ['Date'] })
    const u = (await repo.updateTask(t.id, { title: 'B', notes: t.notes }))!
    vi.useRealTimers()
    expect(u.field_ts.title).toBeGreaterThan(t.field_ts.title)
    expect(u.field_ts.notes).toBe(t.field_ts.notes)
    expect(await db.outbox.count()).toBe(2)
  })

  it('a no-op update writes nothing', async () => {
    const t = await repo.createTask({ title: 'A' })
    await repo.updateTask(t.id, { title: 'A' })
    expect(await db.outbox.count()).toBe(1)
  })

  it('delete is a tombstone, not a removal', async () => {
    const t = await repo.createTask({ title: 'A' })
    await repo.deleteTask(t.id)
    const row = await db.tasks.get(t.id)
    expect(row?.deleted_at).toBeTruthy()
    expect(row?._kind).toBe('gone')
    expect(row?.field_ts.deleted_at).toBeGreaterThanOrEqual(t.field_ts.deleted_at)
  })

  it('inbox vs scheduled kind follows start_at', async () => {
    const t = await repo.createTask({ title: 'Inbox item' })
    expect(t._kind).toBe('inbox')
    const s = await repo.updateTask(t.id, { start_at: '2026-09-26T10:00:00.000Z' })
    expect(s?._kind).toBe('sched')
  })

  it('exceptions and settings enqueue with their composite / fixed keys', async () => {
    await repo.putException('s1', '2026-09-26', { skipped: true })
    await repo.updateSettings({ snap: 10 })
    const out = await db.outbox.toArray()
    expect(out.map((o) => `${o.table}:${o.id}`)).toEqual(['exceptions:s1|2026-09-26', 'settings:me'])
    expect((await repo.getSettings()).snap).toBe(10)
  })
})
