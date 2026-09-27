// Two devices, one task, different fields edited offline → both converge on the merged row (docs/spec.md §5).
// Hermetic: both contexts talk to one FakeSupabase (tests/support) that runs the same merge as planner_merge().
import { test, expect, type Page } from '@playwright/test'
import { FakeSupabase, trackErrors } from './support/fakeSupabase'

const T = '01900000-0000-7000-8000-000000000001'

async function edit(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(([id, p]) => (window as any).__optimo.repo.updateTask(id, p), [T, patch] as const)
}
const row = (page: Page) => page.evaluate((id) => (window as any).__optimo.db.tasks.get(id), T)

test.describe('sync convergence', () => {
  test('two contexts edit different fields offline and converge within 5 s', async ({ browser, baseURL }, info) => {
    test.skip(info.project.name !== 'desktop', 'protocol test; runs once')
    const server = new FakeSupabase()
    server.upsert('planner_tasks', {
      id: T, title: 'Write the migration plan', notes: '', start_at: '2026-09-26T14:00:00.000Z', duration_min: 90,
      deleted_at: null, field_ts: { title: 1, notes: 1, start_at: 1, duration_min: 1, deleted_at: 1 },
    })

    const ctxA = await browser.newContext({ baseURL })
    const ctxB = await browser.newContext({ baseURL })
    await server.attach(ctxA, { pollMs: 1500 })
    await server.attach(ctxB, { pollMs: 1500 })
    const a = await ctxA.newPage()
    const b = await ctxB.newPage()
    const errs = [...[a, b].map(trackErrors)]
    await Promise.all([a.goto('./'), b.goto('./')])
    for (const p of [a, b]) await expect.poll(async () => (await row(p))?.title, { timeout: 5000 }).toBe('Write the migration plan')
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')

    const shots = info.outputPath('badge')
    await a.getByTestId('sync-badge').screenshot({ path: `${shots}-synced.png` })

    await ctxA.setOffline(true)
    await ctxB.setOffline(true)
    await edit(a, { title: 'Write the migration plan v2' })
    await edit(b, { notes: 'include rollback' })
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'offline')
    await expect(a.getByTestId('sync-badge')).toContainText('1 queued')
    await a.getByTestId('sync-badge').screenshot({ path: `${shots}-offline.png` })

    const t0 = Date.now()
    await ctxA.setOffline(false)
    await ctxB.setOffline(false)
    for (const p of [a, b]) {
      await expect
        .poll(async () => {
          const r = await row(p)
          return r && `${r.title} / ${r.notes}`
        }, { timeout: 5000 })
        .toBe('Write the migration plan v2 / include rollback')
    }
    const elapsed = Date.now() - t0
    expect(server.task(T)).toMatchObject({ title: 'Write the migration plan v2', notes: 'include rollback' })
    await expect(a.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await expect(b.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await b.getByTestId('sync-badge').screenshot({ path: `${shots}-reconverged.png` })
    info.annotations.push({ type: 'converged_ms', description: String(elapsed) })
    console.log(`converged in ${elapsed} ms; server requests=${server.requests}; unexpected=${server.unexpected.length}`)
    expect(server.unexpected).toEqual([])
    expect(errs.flat()).toEqual([])
    await ctxA.close()
    await ctxB.close()
  })

  test('an online edit reaches the other device through realtime (poll disabled)', async ({ browser, baseURL }, info) => {
    test.skip(info.project.name !== 'desktop', 'protocol test; runs once')
    const server = new FakeSupabase()
    server.upsert('planner_tasks', { id: T, title: 'Standup', deleted_at: null, field_ts: { title: 1, deleted_at: 1 } })
    const ctxA = await browser.newContext({ baseURL })
    const ctxB = await browser.newContext({ baseURL })
    await server.attach(ctxA, { pollMs: 600_000 })
    await server.attach(ctxB, { pollMs: 600_000 })
    const a = await ctxA.newPage()
    const b = await ctxB.newPage()
    await Promise.all([a.goto('./'), b.goto('./')])
    for (const p of [a, b]) await expect.poll(async () => (await row(p))?.title, { timeout: 5000 }).toBe('Standup')
    await b.waitForTimeout(300) // let B's channel finish joining
    await edit(a, { title: 'Standup, platform team' })
    await expect.poll(async () => (await row(b))?.title, { timeout: 3000 }).toBe('Standup, platform team')
    await ctxA.close()
    await ctxB.close()
  })

  test('signed-out users see only the sign-in screen, and the magic link request is sent', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await page.goto('./')
    await expect(page.getByRole('heading', { name: /optimo/ })).toBeVisible()
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByRole('button', { name: 'Send sign-in link' }).click()
    await expect(page.getByRole('status')).toContainText('Link sent')
    expect(server.unexpected).toEqual([])
  })
})
