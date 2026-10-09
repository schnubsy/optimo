// arc 3 slice 13 — the Plan tab end to end against the hermetic server: the REAL plan-day handler runs in-process
// (tests/support/fakeSupabase.ts) over a scripted Messages API (tests/fake/planPorts.ts). Desktop + iPhone 15, axe.
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { CAT, at, openApp, seedTask } from './support/app'
import type { FakeSupabase } from './support/fakeSupabase'
import { FAKE_SOURCE } from './fake/planPorts'

const live = (s: FakeSupabase) => {
  s.ai = true
  s.planFn = true
}
async function openPlan(page: Page) {
  const tab = page.getByTestId('tab-plan')
  if (await tab.isVisible()) await tab.click()
  else await page.getByTestId('hdr-plan').click()
  await expect(page.getByTestId('plan')).toBeVisible()
}
async function ask(page: Page, intent: string) {
  await page.getByTestId('plan-intent').fill(intent)
  await page.getByTestId('plan-go').click()
}
const titles = (page: Page) =>
  page.evaluate(async () => ((await (window as any).__optimo.db.tasks.toArray()) as { title: string; deleted_at: string | null; start_at: string }[]).filter((t) => !t.deleted_at))

test.describe('Plan tab (arc 3)', () => {
  test('not connected: no function deployed → a plain notice and disabled controls', async ({ page, context }) => {
    const { server } = await openApp(page, context, { at: '08:00' })
    await openPlan(page)
    await ask(page, 'Forecast draft, swim, email')
    await expect(page.getByTestId('plan-down')).toContainText('Planner isn’t connected yet')
    await expect(page.getByTestId('plan-intent')).toBeDisabled()
    await expect(page.getByTestId('plan-go')).toBeDisabled()
    expect(server.planCalls).toHaveLength(0) // the gateway 404'd before the handler
  })

  test('not connected: function deployed but 004 not applied → same notice; core sync stays green', async ({ page, context }) => {
    const { server, errors } = await openApp(page, context, { at: '08:00', seed: (s) => (s.planFn = true) })
    await openPlan(page)
    await ask(page, 'Forecast draft, swim, email')
    await expect(page.getByTestId('plan-down')).toContainText('Planner isn’t connected yet')
    expect(server.planCalls[0]).toMatchObject({ action: 'propose', status: 503 })
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    // the browser logs the 503 itself; anything else is a bug
    expect(errors.filter((e) => !/status of 503/.test(e))).toEqual([])
  })

  test('offline → "You’re offline", controls disabled', async ({ page, context }) => {
    await openApp(page, context, { at: '08:00', seed: live })
    await openPlan(page)
    await context.setOffline(true)
    await expect(page.getByTestId('plan-down')).toContainText('offline')
    await expect(page.getByTestId('plan-go')).toBeDisabled()
    await context.setOffline(false)
    await expect(page.getByTestId('plan-down')).toHaveCount(0)
  })

  test('propose → untick one → accept some: ghosts on the day, tasks through the outbox, plan accepted, learn fired', async ({ page, context }) => {
    const { server, errors } = await openApp(page, context, { at: '08:00', seed: live })
    await openPlan(page)
    await ask(page, 'Finish the forecast draft, swim, clear email')
    await expect(page.getByTestId('plan-block')).toHaveCount(3)
    await expect(page.getByTestId('plan-ghost')).toHaveCount(3)
    await expect(page.getByTestId('plan-notes')).toContainText('more than the free time holds')
    await expect(page.getByTestId('plan-block').first()).toContainText('freshest hours') // the why
    await page.getByTestId('plan-tick').nth(1).click()
    await expect(page.getByTestId('plan-accept-some')).toHaveText('Accept 2 ticked')
    await page.getByTestId('plan-accept-some').click()
    await expect(page.getByTestId('toast')).toContainText('Added 2 blocks')
    const ts = (await titles(page)).map((t) => t.title)
    expect(ts).toEqual(expect.arrayContaining(['Focus: Finish the forecast draft', 'Admin & email']))
    expect(ts).not.toContain('Walk + reset')
    await expect.poll(() => [...server.rows.planner_ai_plans.values()][0]?.status).toBe('accepted')
    await expect.poll(() => server.rows.planner_tasks.size).toBeGreaterThanOrEqual(2)
    await expect.poll(() => server.planCalls.map((c) => c.action)).toContain('learn')
    const learn = server.planCalls.find((c) => c.action === 'learn')!
    expect((learn.body.accepted_task_ids as string[]).length).toBe(2)
    expect((learn.body.rejected as { title: string }[])[0].title).toBe('Walk + reset')
    expect(errors).toEqual([])
  })

  test('edit a block before accepting: the task carries the edit; learn sees the diff', async ({ page, context }) => {
    const { server } = await openApp(page, context, { at: '08:00', seed: live })
    await openPlan(page)
    await ask(page, 'Forecast draft')
    await page.getByTestId('plan-edit').first().click()
    await page.getByTestId('plan-edit-title').fill('Forecast draft v2')
    await page.getByTestId('plan-edit-time').fill('09:30')
    await page.getByTestId('plan-edit-dur').fill('75')
    await page.getByTestId('plan-edit-save').click()
    await expect(page.getByTestId('plan-block').first()).toContainText('09:30–10:45')
    await page.getByTestId('plan-accept-all').click()
    await expect(page.getByTestId('toast')).toContainText('Added 3 blocks')
    const t = (await titles(page)).find((x) => x.title === 'Forecast draft v2')!
    expect(t.start_at).toBe(at('09:30'))
    await expect.poll(() => server.planCalls.find((c) => c.action === 'learn')?.body.edits).toHaveLength(1)
  })

  test('auto: the day is written at once; Undo tombstones exactly those tasks', async ({ page, context }) => {
    let keep: { id: string }
    await openApp(page, context, { at: '08:00', seed: (s) => (live(s), (keep = seedTask(s, { title: 'Standup, platform team', start_at: at('11:00'), category_id: CAT.meet }))) })
    await openPlan(page)
    await page.getByTestId('plan-mode-auto').click()
    await ask(page, 'Forecast draft, swim, email')
    await expect(page.getByTestId('toast')).toContainText('Planned 3 blocks')
    expect((await titles(page)).length).toBe(4)
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await titles(page)).map((t) => t.title)).toEqual(['Standup, platform team'])
    expect((await titles(page))[0]).toBeTruthy()
    void keep!
  })

  test('research: sources and their cited snippet are shown with the plan', async ({ page, context }) => {
    const { server } = await openApp(page, context, { at: '08:00', seed: live })
    await openPlan(page)
    await page.getByTestId('plan-research').check()
    await ask(page, 'Swim at the harbour pool, then the forecast')
    const src = page.getByTestId('plan-sources')
    await expect(src.getByRole('link', { name: FAKE_SOURCE.title })).toHaveAttribute('href', FAKE_SOURCE.url)
    await expect(src).toContainText(FAKE_SOURCE.cited)
    expect(server.planCalls[0].body.research).toBe(true)
  })

  test('questions are answered inline and re-plan the same plan row; clashes are marked', async ({ page, context }) => {
    const { server } = await openApp(page, context, { at: '08:00', seed: (s) => (live(s), seedTask(s, { title: 'Dentist', start_at: at('09:30'), duration_min: 30, category_id: CAT.errand })) })
    await openPlan(page)
    await ask(page, 'Forecast, email — can admin move?')
    await expect(page.getByTestId('plan-questions')).toContainText('Is the 13:30 admin block movable')
    await expect(page.getByTestId('plan-clash').first()).toContainText('Dentist')
    await page.getByTestId('plan-answer').fill('Yes, keep it short')
    await page.getByTestId('plan-replan').click()
    await expect(page.getByTestId('plan-block').nth(2)).toContainText('Admin & email (short)')
    expect(server.rows.planner_ai_plans.size).toBe(1)
  })

  test('AI-P0-1: planning Tomorrow moves the whole app to tomorrow — header, timeline and the accepted tasks agree', async ({ page, context }) => {
    await openApp(page, context, { at: '08:00', seed: live })
    await openPlan(page)
    await page.getByTestId('plan-day-tomorrow').click()
    const tomorrow = await page.evaluate(() => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return { day: d.getDate(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
    })
    await expect(page.getByTestId('hdr-title')).toContainText(String(tomorrow.day))
    await expect(page.locator('.plan-day')).toHaveAttribute('aria-label', `Timeline for ${tomorrow.key}`)
    await ask(page, 'Forecast draft, swim, email')
    await expect(page.getByTestId('plan-block')).toHaveCount(3)
    await page.getByTestId('plan-accept-all').click()
    await expect(page.getByTestId('toast')).toContainText(`Added 3 blocks to`)
    await expect.poll(async () => (await titles(page)).map((t) => t.start_at).sort()).toEqual([at('09:00', 1), at('10:30', 1), at('13:30', 1)].sort())
    // back to today: tomorrow's proposal steps aside instead of drawing ghosts on the wrong day
    await page.getByTestId('plan-day-today').click()
    await expect(page.getByTestId('plan-ghost')).toHaveCount(0)
  })

  for (const theme of ['light', 'dark'] as const)
    test(`axe clean with a proposal open (${theme}) + evidence`, async ({ page, context }, info) => {
      await openApp(page, context, { at: '08:00', theme, seed: (s) => (live(s), seedTask(s, { title: 'Standup, platform team', start_at: at('11:00'), duration_min: 30, category_id: CAT.meet })) })
      await openPlan(page)
      await page.getByTestId('plan-research').check()
      await ask(page, 'Finish the forecast draft before lunch, swim, clear email?')
      await expect(page.getByTestId('plan-block')).toHaveCount(3)
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
      const r = await new AxeBuilder({ page }).include('[data-testid="plan"]').analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
      if (process.env.EVIDENCE) {
        await page.screenshot({ path: `docs/evidence/ai-planner-slice-13-plan-${info.project.name}-${theme}.png` })
        await page.getByTestId('plan-sources').scrollIntoViewIfNeeded()
        await page.screenshot({ path: `docs/evidence/ai-planner-slice-13-plan-card-${info.project.name}-${theme}.png` })
        await page.locator('.plan-day').scrollIntoViewIfNeeded()
        await page.screenshot({ path: `docs/evidence/ai-planner-slice-13-plan-ghosts-${info.project.name}-${theme}.png` })
      }
    })
})
