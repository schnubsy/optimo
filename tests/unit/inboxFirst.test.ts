// arc 7 slice 7 — inbox-first data (db/008): the derived place, every repo transition (fields cleared, field_ts
// stamped, outbox rows), the to-place queries with the overdue roll-forward, and export/import of the new fields.
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { OptimoDB, useDatabase, db } from '../../src/data/db'
import * as repo from '../../src/data/repo'
import { taskKind, settlePlace, withTaskDefaults } from '../../src/data/place'
import { inboxCount, plannedFor, plannedRange, somedayList, useInboxCount, usePlanned, usePlannedRange, useSomeday } from '../../src/data/hooks'
import { exportAll, importAll } from '../../src/data/export'
import { applyRemote } from '../../src/sync/engine'
import { mergeRow } from '../../src/sync/merge'
import { schedule, unschedule } from '../../src/actions'
import type { Task } from '../../src/data/types'

beforeEach(async () => {
  useDatabase(new OptimoDB(`if-${Math.random()}`))
  await db.open()
})

const base = { deleted_at: null, rrule: null, series_id: null, start_at: null, plan_date: null, someday: false }
const outbox = () => db.outbox.toArray()
const last = async () => (await outbox()).at(-1)!

describe('taskKind — the derived place', () => {
  it('inbox: no time, no day, not Someday', () => expect(taskKind(base)).toBe('inbox'))
  it('planned: plan_date only', () => expect(taskKind({ ...base, plan_date: '2026-10-12' })).toBe('planned'))
  it('someday: someday only', () => expect(taskKind({ ...base, someday: true })).toBe('someday'))
  it('sched: start_at wins over plan_date and someday', () =>
    expect(taskKind({ ...base, start_at: '2026-10-09T14:00:00.000Z', plan_date: '2026-10-12', someday: true })).toBe('sched'))
  it('someday wins over plan_date (a merged mix)', () => expect(taskKind({ ...base, someday: true, plan_date: '2026-10-12' })).toBe('someday'))
  it('series and override rows keep their kinds', () => {
    expect(taskKind({ ...base, rrule: 'FREQ=DAILY', start_at: '2026-10-09T08:00:00.000Z', plan_date: '2026-10-12' })).toBe('series')
    expect(taskKind({ ...base, series_id: 's1', start_at: '2026-10-09T08:00:00.000Z', someday: true })).toBe('override')
  })
  it('gone beats everything', () => expect(taskKind({ ...base, deleted_at: '2026-10-01T00:00:00.000Z', plan_date: '2026-10-12' })).toBe('gone'))
  it('a pre-008 row (fields absent) is inbox or sched as before', () => {
    expect(taskKind({ deleted_at: null, rrule: null, series_id: null, start_at: null })).toBe('inbox')
    expect(taskKind({ deleted_at: null, rrule: null, series_id: null, start_at: '2026-10-09T08:00:00.000Z' })).toBe('sched')
  })
  it('withTaskDefaults fills only what is missing', () => {
    expect(withTaskDefaults({ id: 'x' })).toEqual({ id: 'x', plan_date: null, someday: false, estimated: true })
    expect(withTaskDefaults({ plan_date: '2026-10-12', someday: true, estimated: false })).toEqual({ plan_date: '2026-10-12', someday: true, estimated: false })
  })
  it('settlePlace: unscheduling a row that carried a stale day goes to the inbox', () => {
    const before: Pick<Task, 'start_at' | 'plan_date' | 'someday' | 'rrule' | 'series_id'> = { ...base, start_at: '2026-10-09T08:00:00.000Z', plan_date: '2026-10-01' }
    expect(settlePlace(before, { start_at: null }, { ...before, start_at: null })).toMatchObject({ plan_date: null, someday: false })
  })
})

describe('repo transitions', () => {
  it('captureToInbox: inbox, no estimate, duration = settings.default_duration, every field stamped, one outbox row', async () => {
    await repo.updateSettings({ default_duration: 45 })
    await db.outbox.clear()
    const t = await repo.captureToInbox('  Call the plumber  ')
    expect(t).toMatchObject({ title: 'Call the plumber', _kind: 'inbox', start_at: null, plan_date: null, someday: false, estimated: false, duration_min: 45 })
    for (const k of ['title', 'start_at', 'plan_date', 'someday', 'estimated', 'duration_min']) expect(t.field_ts[k]).toBeGreaterThan(0)
    const out = await outbox()
    expect(out).toHaveLength(1)
    expect(out[0].payload).toMatchObject({ id: t.id, plan_date: null, someday: false, estimated: false })
    expect(out[0].payload._kind).toBeUndefined()
  })

  it('captureToInbox with opts: a day files it as planned, a duration counts as an estimate, a bad day throws', async () => {
    const p = await repo.captureToInbox('Dentist forms', { plan_date: '2026-10-12', duration_min: 20 })
    expect(p).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12', estimated: true, duration_min: 20 })
    const s = await repo.captureToInbox('Learn Rust', { someday: true, plan_date: '2026-10-12' })
    expect(s).toMatchObject({ _kind: 'someday', someday: true, plan_date: null })
    await expect(repo.captureToInbox('x', { plan_date: '12/10/2026' })).rejects.toThrow(/YYYY-MM-DD/)
  })

  it('planForDay from the inbox: plan_date set; start_at + plan_date + someday stamped together; one outbox row', async () => {
    const t = await repo.captureToInbox('Taxes')
    const n = (await outbox()).length
    const p = (await repo.planForDay(t.id, '2026-10-12'))!
    expect(p).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12', someday: false, start_at: null })
    expect(p.field_ts.plan_date).toBeGreaterThan(t.field_ts.plan_date)
    expect(p.field_ts.someday).toBe(p.field_ts.plan_date)
    expect(p.field_ts.start_at).toBe(p.field_ts.plan_date)
    expect(p.field_ts.title).toBe(t.field_ts.title)
    expect(await outbox()).toHaveLength(n + 1)
    expect((await last()).payload).toMatchObject({ id: t.id, plan_date: '2026-10-12', someday: false, start_at: null })
    expect((await last()).field_ts.plan_date).toBe(p.field_ts.plan_date)
    // same day again is a no-op: nothing queued
    await repo.planForDay(t.id, '2026-10-12')
    expect(await outbox()).toHaveLength(n + 1)
    expect(() => repo.planForDay(t.id, 'tomorrow')).toThrow(/YYYY-MM-DD/)
  })

  it('planForDay from the timeline unschedules it', async () => {
    const t = await repo.createTask({ title: 'Gym', start_at: '2026-10-09T14:00:00.000Z' })
    const p = (await repo.planForDay(t.id, '2026-10-10'))!
    expect(p).toMatchObject({ _kind: 'planned', start_at: null, plan_date: '2026-10-10' })
    expect(p.field_ts.start_at).toBeGreaterThan(t.field_ts.start_at)
  })

  it('toSomeday from planned clears plan_date; planForDay from Someday clears someday', async () => {
    const t = await repo.captureToInbox('Paint the fence', { plan_date: '2026-10-12' })
    const s = (await repo.toSomeday(t.id))!
    expect(s).toMatchObject({ _kind: 'someday', someday: true, plan_date: null })
    expect(s.field_ts.someday).toBeGreaterThan(t.field_ts.someday)
    expect(s.field_ts.plan_date).toBe(s.field_ts.someday)
    expect((await last()).payload).toMatchObject({ someday: true, plan_date: null })
    const p = (await repo.planForDay(t.id, '2026-10-20'))!
    expect(p).toMatchObject({ _kind: 'planned', someday: false, plan_date: '2026-10-20' })
  })

  it('toInbox from Someday, from planned and from the timeline clears time, day and Someday', async () => {
    const a = await repo.captureToInbox('A', { someday: true })
    const b = await repo.captureToInbox('B', { plan_date: '2026-10-12' })
    const c = await repo.createTask({ title: 'C', start_at: '2026-10-09T09:00:00.000Z' })
    for (const t of [a, b, c]) {
      const n = (await outbox()).length
      const i = (await repo.toInbox(t.id))!
      expect(i).toMatchObject({ _kind: 'inbox', start_at: null, plan_date: null, someday: false })
      expect(i.field_ts.start_at).toBeGreaterThan(t.field_ts.start_at)
      expect(await outbox()).toHaveLength(n + 1)
    }
  })

  it('scheduling (actions.schedule / updateTask start_at) clears plan_date and someday, stamped', async () => {
    const p = await repo.captureToInbox('Planned', { plan_date: '2026-10-12' })
    await schedule(p, '2026-10-12', 9 * 60)
    const s = (await db.tasks.get(p.id))!
    expect(s).toMatchObject({ _kind: 'sched', plan_date: null, someday: false })
    expect(s.field_ts.plan_date).toBe(s.field_ts.start_at)
    expect((await last()).payload).toMatchObject({ plan_date: null, someday: false })
    const q = await repo.captureToInbox('Someday', { someday: true })
    const r = (await repo.updateTask(q.id, { start_at: '2026-10-13T10:00:00.000Z' }))!
    expect(r).toMatchObject({ _kind: 'sched', someday: false, plan_date: null })
    expect(r.field_ts.someday).toBe(r.field_ts.start_at)
  })

  it('a timed create never carries a day or Someday', async () => {
    const t = await repo.createTask({ title: 'x', start_at: '2026-10-09T09:00:00.000Z', plan_date: '2026-10-12', someday: true })
    expect(t).toMatchObject({ _kind: 'sched', plan_date: null, someday: false })
  })

  it('unschedule (actions.unschedule) goes to the inbox even when a merge left a stale day on the row', async () => {
    const id = '0199a000-0000-7000-8000-0000000000d1'
    await applyRemote('tasks', [{ id, title: 'Mixed', notes: '', category_id: null, priority: 0, start_at: '2026-10-09T09:00:00Z', duration_min: 30, all_day: false, completed_at: null, subtasks: [], reminders: [], sort_key: 1, rrule: null, dtstart: null, series_id: null, plan_date: '2026-10-01', someday: false, estimated: true, deleted_at: null, field_ts: { start_at: 5, plan_date: 6 }, device_id: 'b' }])
    expect((await db.tasks.get(id))?._kind).toBe('sched')
    await unschedule((await db.tasks.get(id))!)
    expect(await db.tasks.get(id)).toMatchObject({ _kind: 'inbox', start_at: null, plan_date: null, someday: false })
  })

  it('an edit that keeps the task unscheduled keeps its day (the wizard saving a planned task)', async () => {
    const p = await repo.captureToInbox('Planned', { plan_date: '2026-10-12' })
    const u = (await repo.updateTask(p.id, { title: 'Planned (renamed)', start_at: null, notes: 'n' }))!
    expect(u).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12' })
    expect(u.field_ts.plan_date).toBe(p.field_ts.plan_date) // no place move ⇒ place not re-stamped
  })

  it('undo of a schedule (restoreTask) puts the task back on its day', async () => {
    const p = await repo.captureToInbox('Planned', { plan_date: '2026-10-12' })
    const before = (await db.tasks.get(p.id))!
    await repo.updateTask(p.id, { start_at: '2026-10-12T09:00:00.000Z' })
    await repo.restoreTask(before)
    expect(await db.tasks.get(p.id)).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12', start_at: null })
  })

  it('series and override rows: place actions are guarded no-ops; plan_date / someday never stick', async () => {
    const s = await repo.createTask({ title: 'Daily', start_at: '2026-10-09T08:00:00.000Z', rrule: 'FREQ=DAILY', dtstart: '2026-10-09T08:00:00.000Z', plan_date: '2026-10-12' })
    expect(s).toMatchObject({ _kind: 'series', plan_date: null, someday: false })
    const o = await repo.createTask({ title: 'Daily (moved)', start_at: '2026-10-10T09:00:00.000Z', series_id: s.id })
    const n = (await outbox()).length
    expect(await repo.planForDay(s.id, '2026-10-12')).toBeUndefined()
    expect(await repo.toSomeday(s.id)).toBeUndefined()
    expect(await repo.toInbox(o.id)).toBeUndefined()
    expect(await outbox()).toHaveLength(n)
    expect(await db.tasks.get(s.id)).toMatchObject({ _kind: 'series', start_at: '2026-10-09T08:00:00.000Z' })
    expect((await repo.updateTask(s.id, { someday: true }))).toBeUndefined() // settles back to false ⇒ no change
  })

  it('setEstimate: minutes ⇒ estimated; null ⇒ no estimate (unscheduled → default duration, scheduled keeps length)', async () => {
    await repo.updateSettings({ default_duration: 25 })
    const t = await repo.captureToInbox('Read paper')
    const e = (await repo.setEstimate(t.id, 90))!
    expect(e).toMatchObject({ duration_min: 90, estimated: true })
    expect(e.field_ts.estimated).toBeGreaterThan(t.field_ts.estimated)
    expect((await last()).payload).toMatchObject({ duration_min: 90, estimated: true })
    const c = (await repo.setEstimate(t.id, null))!
    expect(c).toMatchObject({ duration_min: 25, estimated: false })
    const s = await repo.createTask({ title: 'Block', start_at: '2026-10-09T09:00:00.000Z', duration_min: 50 })
    expect(await repo.setEstimate(s.id, null)).toMatchObject({ duration_min: 50, estimated: false })
    await expect(repo.setEstimate(t.id, 0)).rejects.toThrow(/≥ 1/)
    expect(await repo.setEstimate('missing', 30)).toBeUndefined()
  })

  it('changing duration_min anywhere (resize, wizard) counts as an estimate', async () => {
    const t = await repo.captureToInbox('x')
    expect((await repo.updateTask(t.id, { duration_min: 40 }))?.estimated).toBe(true)
    const u = await repo.captureToInbox('y')
    expect((await repo.updateTask(u.id, { duration_min: u.duration_min, title: 'y2' }))?.estimated).toBe(false)
  })

  it('two devices: the later place decision wins as a unit under field-level LWW', async () => {
    const t = await repo.captureToInbox('Contested')
    const a = (await repo.planForDay(t.id, '2026-10-12'))! // device A, earlier
    const b = { ...(await repo.toSomeday(t.id))! } // device B, later (same row lineage)
    const atServer = mergeRow(a as never, b as never) as Task
    expect(taskKind(atServer)).toBe('someday')
    expect(atServer).toMatchObject({ someday: true, plan_date: null })
    const reverse = mergeRow(b as never, a as never) as Task // A arriving late loses both fields
    expect(reverse).toMatchObject({ someday: true, plan_date: null })
  })
})

describe('to-place queries (overdue roll-forward)', () => {
  const TODAY = '2026-10-09'
  async function seed() {
    const mk = (title: string, plan_date: string, extra: Partial<Task> = {}) => repo.createTask({ title, plan_date, sort_key: Number(title.replace(/\D/g, '')) || 0, ...extra })
    await mk('p1 today', TODAY)
    await mk('p2 today hi', TODAY, { priority: 3 })
    await mk('p3 overdue', '2026-10-07')
    await mk('p4 overdue done', '2026-10-07', { completed_at: '2026-10-07T12:00:00.000Z' })
    await mk('p5 long overdue', '2026-09-20')
    await mk('p6 tomorrow', '2026-10-10')
    await mk('p7 later', '2026-10-15')
    await repo.createTask({ title: 'timed', start_at: '2026-10-09T09:00:00.000Z' })
    await repo.captureToInbox('in1')
    await repo.captureToInbox('in2 done')
    await repo.updateTask((await db.tasks.filter((t) => t.title === 'in2 done').first())!.id, { completed_at: '2026-10-09T10:00:00.000Z' })
    await repo.captureToInbox('s9', { someday: true })
    await repo.captureToInbox('s8 hi', { someday: true, priority: 2 })
  }
  const titles = (rows: Task[]) => rows.map((t) => t.title)

  it("today = today's items + unfinished overdue, priority desc then sort_key; completed overdue excluded", async () => {
    await seed()
    expect(titles(await plannedFor(TODAY, TODAY))).toEqual(['p2 today hi', 'p1 today', 'p3 overdue', 'p5 long overdue'])
  })
  it('a past day keeps only its finished items; a future day shows all of its own', async () => {
    await seed()
    expect(titles(await plannedFor('2026-10-07', TODAY))).toEqual(['p4 overdue done'])
    expect(titles(await plannedFor('2026-10-10', TODAY))).toEqual(['p6 tomorrow'])
  })
  it('a range: every day keyed, overdue (also from before the range) rolled onto today', async () => {
    await seed()
    const w = await plannedRange('2026-10-05', '2026-10-11', TODAY)
    expect(Object.keys(w)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
    expect(titles(w['2026-10-09'])).toEqual(['p2 today hi', 'p1 today', 'p3 overdue', 'p5 long overdue'])
    expect(titles(w['2026-10-07'])).toEqual(['p4 overdue done'])
    expect(titles(w['2026-10-10'])).toEqual(['p6 tomorrow'])
    const next = await plannedRange('2026-10-12', '2026-10-18', TODAY) // today outside: nothing rolls in
    expect(titles(next['2026-10-15'])).toEqual(['p7 later'])
    expect(Object.values(next).flat()).toHaveLength(1)
  })
  it('inbox count = unfinished inbox items only; Someday in the inbox order', async () => {
    await seed()
    expect(await inboxCount()).toBe(1)
    expect(titles(await somedayList())).toEqual(['s8 hi', 's9'])
  })
  it('the live hooks follow writes', async () => {
    await seed()
    const count = renderHook(() => useInboxCount())
    const today = renderHook(() => usePlanned(TODAY, TODAY))
    const week = renderHook(() => usePlannedRange('2026-10-05', '2026-10-11', TODAY))
    const some = renderHook(() => useSomeday())
    await waitFor(() => expect(count.result.current).toBe(1))
    await waitFor(() => expect(today.result.current).toHaveLength(4))
    await waitFor(() => expect(some.result.current).toHaveLength(2))
    const in1 = (await db.tasks.filter((t) => t.title === 'in1').first())!
    await act(async () => void (await repo.planForDay(in1.id, TODAY)))
    await waitFor(() => expect(count.result.current).toBe(0))
    await waitFor(() => expect(today.result.current?.map((t) => t.title)).toContain('in1'))
    await waitFor(() => expect(week.result.current?.[TODAY]).toHaveLength(5))
    for (const h of [count, today, week, some]) h.unmount()
  })
})

describe('export / import', () => {
  it('round-trips plan_date, someday and estimated (and the derived kinds)', async () => {
    const p = await repo.captureToInbox('Planned', { plan_date: '2026-10-12' })
    const s = await repo.captureToInbox('Someday', { someday: true })
    const i = await repo.captureToInbox('Unestimated')
    const file = await exportAll()
    expect(file.tasks.find((t) => t.id === p.id)).toMatchObject({ plan_date: '2026-10-12', someday: false, estimated: false })
    expect(file.tasks.find((t) => t.id === s.id)).toMatchObject({ someday: true })
    expect(file.tasks.every((t) => !('_kind' in t))).toBe(true)
    useDatabase(new OptimoDB(`if-import-${Math.random()}`))
    await db.open()
    expect(await importAll(JSON.parse(JSON.stringify(file)))).toBe(3)
    expect(await db.tasks.get(p.id)).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12', estimated: false })
    expect(await db.tasks.get(s.id)).toMatchObject({ _kind: 'someday', someday: true })
    expect(await db.tasks.get(i.id)).toMatchObject({ _kind: 'inbox', estimated: false })
    expect((await db.outbox.toArray()).find((o) => o.id === p.id)?.payload).toMatchObject({ plan_date: '2026-10-12' })
  })

  it('an export from before arc 7 imports with the column defaults', async () => {
    const old = { app: 'optimo', version: 1, exported_at: '2026-09-01T00:00:00.000Z', categories: [], exceptions: [], settings: [],
      tasks: [{ id: '0199a000-0000-7000-8000-0000000000e1', title: 'Old', notes: '', category_id: null, priority: 0, start_at: null, duration_min: 30, all_day: false, completed_at: null, subtasks: [], reminders: [], sort_key: 1, rrule: null, dtstart: null, series_id: null, deleted_at: null, field_ts: { title: 1 }, device_id: null }] }
    await importAll(old as never)
    expect(await db.tasks.get('0199a000-0000-7000-8000-0000000000e1')).toMatchObject({ _kind: 'inbox', plan_date: null, someday: false, estimated: true })
  })
})
