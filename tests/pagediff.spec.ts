// Snag-train PRE-PR page-diff gate — captures each view from the branch build (vite preview) and from the
// CURRENT-LIVE Pages build with the same seeded day, frozen clock and theme, at both projects (1280×800 desktop,
// iPhone 15). The pixel diff itself runs in press's `tools/page-diff.mjs` (`diffPngs`, 2% threshold) — see
// scripts/page-diff-gate.mjs. Gated on PAGEDIFF=<dir>; skipped in the gauntlet.
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { FakeSupabase } from './support/fakeSupabase'
import { seedDay } from './support/app'

const DIR = process.env.PAGEDIFF
const LIVE = 'https://schnubsy.github.io/optimo/'
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

async function open(page: Page, context: BrowserContext, url: string) {
  const server = new FakeSupabase()
  seedDay(server)
  await server.attach(context)
  const now = new Date()
  now.setHours(10, 30, 0, 0)
  await page.clock.install({ time: now })
  await page.goto(url)
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
  await expect.poll(() => page.evaluate(async () => {
    const o = (window as any).__optimo
    return (await o.db.categories.count()) >= 8 && (await o.db.outbox.count()) === 0
  })).toBe(true)
  await page.addStyleTag({ content: FREEZE })
}

const set = (page: Page, s: Record<string, unknown>) => page.evaluate((x) => (window as any).__optimo.ui.getState().set(x), s)

test.describe('page-diff gate captures', () => {
  test.skip(!DIR, 'set PAGEDIFF=<dir> to capture branch vs live')

  for (const [side, url] of [['branch', './'], ['live', LIVE]] as const) {
    test(`${side}: day, week, month, inbox, settings, quick-add`, async ({ page, context }, info) => {
      await open(page, context, url)
      const shot = async (view: string) => {
        await page.waitForTimeout(300)
        await page.screenshot({ path: `${DIR}/${view}-${info.project.name}-${side}.png` })
      }
      const mobile = await page.evaluate(() => matchMedia('(max-width: 899px)').matches)
      await shot('day')
      await set(page, { view: 'week', mobileTab: 'board' })
      await shot('week')
      await set(page, { view: 'month', mobileTab: 'board' })
      await shot('month')
      if (mobile) {
        await set(page, { view: 'day', mobileTab: 'backlog' })
        await shot('inbox')
        await set(page, { mobileTab: 'board' })
      }
      await set(page, { view: 'settings', mobileTab: 'board' })
      await shot('settings')
      await set(page, { view: 'day', mobileTab: 'board' })
      let field = page.getByTestId('quickadd')
      if (!(await field.isVisible())) {
        await page.getByTestId('fab').click() // arc 6: the FAB opens the create wizard (title keeps the parser)
        field = page.getByTestId('wizard-title')
      }
      await field.fill('Dentist tomorrow 3pm 30m every weekday')
      await shot('quickadd')
    })
  }
})
