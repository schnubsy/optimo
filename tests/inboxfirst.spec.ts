// Arc 7 slice 7 — inbox-first data end to end on the hermetic fake: plan_date / someday / estimated converge between
// two devices; a server without db/008 never wedges sync (rows re-sent in full once it lands); the Dexie v5 upgrade of
// a 5k library on real IndexedDB. Data-only (repo calls through window.__optimo) — the UI slices own the screens.
import { test, expect, type Page } from '@playwright/test'
import { FakeSupabase, trackErrors } from './support/fakeSupabase'

/* eslint-disable @typescript-eslint/no-explicit-any */
const repo = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__optimo.repo[f as string](...(a as unknown[])), [fn, args] as const)
const row = (page: Page, id: string) => page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)

test.describe('inbox-first data', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'protocol test; runs once'))

  test('plan_date / someday / estimated converge between two devices (field-level, place as a unit)', async ({ browser, baseURL }) => {
    const server = new FakeSupabase()
    const ctxA = await browser.newContext({ baseURL })
    const ctxB = await browser.newContext({ baseURL })
    await server.attach(ctxA, { pollMs: 1500 })
    await server.attach(ctxB, { pollMs: 1500 })
    const a = await ctxA.newPage()
    const b = await ctxB.newPage()
    const errs = [a, b].map(trackErrors)
    await Promise.all([a.goto('./'), b.goto('./')])
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')

    const t = await repo(a, 'captureToInbox', 'Renew passport')
    expect(t).toMatchObject({ _kind: 'inbox', estimated: false })
    await repo(a, 'planForDay', t.id, '2026-10-12')
    await expect.poll(async () => (await row(b, t.id))?._kind, { timeout: 5000 }).toBe('planned')
    expect(await row(b, t.id)).toMatchObject({ plan_date: '2026-10-12', someday: false, estimated: false })
    expect(server.task(t.id)).toMatchObject({ plan_date: '2026-10-12', someday: false, estimated: false })

    await repo(b, 'toSomeday', t.id)
    await repo(b, 'setEstimate', t.id, 45)
    await expect.poll(async () => (await row(a, t.id))?._kind, { timeout: 5000 }).toBe('someday')
    expect(await row(a, t.id)).toMatchObject({ plan_date: null, someday: true, estimated: true, duration_min: 45 })

    await repo(a, 'updateTask', t.id, { start_at: '2026-10-12T15:00:00.000Z' })
    await expect.poll(async () => (await row(b, t.id))?._kind, { timeout: 5000 }).toBe('sched')
    expect(await row(b, t.id)).toMatchObject({ plan_date: null, someday: false })
    expect(server.task(t.id)).toMatchObject({ plan_date: null, someday: false, start_at: '2026-10-12T15:00:00.000Z' })
    expect(server.unexpected).toEqual([])
    expect(errs.flat()).toEqual([])
    await ctxA.close()
    await ctxB.close()
  })

  test('a server without db/008 never wedges sync; the rows go up in full once 008 lands', async ({ browser, baseURL }) => {
    const server = new FakeSupabase()
    server.inboxCols = false
    const ctx = await browser.newContext({ baseURL })
    await server.attach(ctx, { pollMs: 1500 })
    const a = await ctx.newPage()
    const errs = trackErrors(a)
    await a.goto('./')
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')

    const t = await repo(a, 'captureToInbox', 'Book flights', { plan_date: '2026-10-14' })
    await expect.poll(() => server.task(t.id)?.title, { timeout: 5000 }).toBe('Book flights')
    expect(server.task(t.id)).not.toHaveProperty('plan_date')
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced') // nothing pending, no error
    expect(await row(a, t.id)).toMatchObject({ _kind: 'planned', plan_date: '2026-10-14' }) // the pull kept the local day

    server.inboxCols = true // the orchestrator applies 008
    await expect.poll(() => server.task(t.id)?.plan_date, { timeout: 6000 }).toBe('2026-10-14')
    expect(server.task(t.id)).toMatchObject({ estimated: false, someday: false })
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    expect(server.unexpected).toEqual([])
    // the only console noise allowed is the browser's own log of the expected 400s (PGRST204 push, 42703 probe)
    expect(errs.filter((e) => !/status of 400 \(Bad Request\)/.test(e))).toEqual([])
    await ctx.close()
  })

  test('Dexie v4 → v5 upgrade of a 5 000-task library on real IndexedDB', async ({ page }, info) => {
    const server = new FakeSupabase()
    await server.attach(page.context())
    await page.goto('./')
    await page.waitForFunction(() => !!(window as any).__optimo)
    const r = await page.evaluate(async () => {
      const Optimo = (window as any).__optimo.db.constructor
      const Dexie = Object.getPrototypeOf(Optimo)
      const name = `upgrade-${Math.random()}`
      const v4 = new Dexie(name)
      v4.version(4).stores({
        tasks: 'id, start_at, category_id, series_id, _kind, [_kind+sort_key], [_kind+start_at]',
        categories: 'id, sort_key', exceptions: '[series_id+occurrence_date], series_id, task_id', settings: 'id',
        outbox: '++seq, [table+id]', meta: 'key', events: 'id, start_at, account_id', aiPlans: 'id, plan_date', aiProfile: 'id',
      })
      await v4.open()
      await v4.table('tasks').bulkPut(Array.from({ length: 5000 }, (_, i) => ({
        id: `t${i}`, title: `Task ${i}`, start_at: i % 2 ? new Date(Date.UTC(2026, 9, 1 + (i % 30), 8)).toISOString() : null,
        rrule: null, series_id: null, deleted_at: null, _kind: i % 2 ? 'sched' : 'inbox', sort_key: i, field_ts: { title: 1 },
      })))
      v4.close()
      const t0 = performance.now()
      const db = new Optimo(name)
      await db.open()
      const ms = Math.round(performance.now() - t0)
      const out = {
        ms, verno: db.verno, count: await db.tasks.count(),
        inbox: await db.tasks.where('[_kind+sort_key]').between(['inbox', -Infinity], ['inbox', Infinity]).count(),
        filled: await db.tasks.filter((t: any) => t.plan_date === null && t.someday === false && t.estimated === true && !('plan_date' in t.field_ts)).count(),
      }
      db.close()
      return out
    })
    console.log(`v4→v5 upgrade of 5000 tasks: ${r.ms} ms`)
    info.annotations.push({ type: 'upgrade_ms', description: String(r.ms) })
    expect(r).toMatchObject({ verno: 5, count: 5000, inbox: 2500, filled: 5000 })
    expect(r.ms).toBeLessThan(5000)
  })
})
