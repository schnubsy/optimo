// arc 3 slice 14 — learning + Settings → Planning: default mode / research persist (synced settings), accepting a plan
// teaches the profile (plan-day `learn` → planner_ai_profile → sync → Settings summary), Reset tombstones it.
import { test, expect, type Page } from '@playwright/test'
import { openApp } from './support/app'
import type { FakeSupabase } from './support/fakeSupabase'

const live = (s: FakeSupabase) => {
  s.ai = true
  s.planFn = true
}
const go = async (page: Page, view: 'settings' | 'plan') => {
  const tab = page.getByTestId(`tab-${view}`)
  if (await tab.isVisible()) await tab.click()
  else await page.getByTestId(view === 'plan' ? 'hdr-plan' : 'tab-settings').or(page.getByRole('button', { name: 'Settings' })).first().click()
}
const settings = (s: FakeSupabase) => [...s.rows.planner_settings.values()][0]?.data as Record<string, unknown> | undefined

test.describe('Planning settings + learning (arc 3)', () => {
  test('default mode and research are synced settings; the Plan tab opens with them, after a reload too', async ({ page, context }) => {
    const { server } = await openApp(page, context, { at: '08:00', seed: live })
    await go(page, 'settings')
    const card = page.getByTestId('set-planning')
    await card.getByTestId('set-plan-mode').getByRole('button', { name: /Auto/ }).click()
    await card.getByTestId('set-plan-research').getByRole('button', { name: 'On by default' }).click()
    await expect.poll(() => settings(server)?.plan_mode).toBe('auto')
    await expect.poll(() => settings(server)?.plan_research).toBe(true)
    await page.reload()
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await go(page, 'plan')
    await expect(page.getByTestId('plan-mode-auto')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('plan-research')).toBeChecked()
    await expect(page.getByTestId('plan-go')).toHaveText('Plan my day')
  })

  test('accepting a plan fires learn; the distilled style shows in Settings; Reset tombstones it', async ({ page, context }) => {
    const { server } = await openApp(page, context, { at: '08:00', seed: live })
    await go(page, 'settings')
    await expect(page.getByTestId('set-learned')).toContainText('Nothing yet')
    await go(page, 'plan')
    await page.getByTestId('plan-intent').fill('Forecast draft, swim, email')
    await page.getByTestId('plan-go').click()
    await page.getByTestId('plan-accept-all').click()
    await expect.poll(() => server.planCalls.filter((c) => c.action === 'learn').map((c) => c.status)).toEqual([200])
    await go(page, 'settings')
    const learned = page.getByTestId('set-learned')
    await expect(learned).toContainText('Day shape: deep work before 11, admin after lunch')
    await expect(learned).toContainText('Focus blocks: about 75 min')
    await expect(learned).toContainText('From 1 accepted plan.')
    if (process.env.EVIDENCE) {
      await page.getByTestId('set-planning').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `docs/evidence/ai-planner-slice-14-planning-settings-${test.info().project.name}.png` })
    }
    await learned.getByTestId('learned-reset').click()
    await expect(learned).toContainText('Nothing yet')
    await expect.poll(() => [...server.rows.planner_ai_profile.values()][0]?.deleted_at).not.toBeNull()
  })
})
