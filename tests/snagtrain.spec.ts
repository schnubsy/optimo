// snag train 2026-10 — Issues #15-#27 (label `snag`), raised by the arc-2 slice-7 Eye LITE critique
// (docs/evidence/arc2-slice-7-design-critique.md). One behavioural case per slice; evidence captures are
// gated on EVIDENCE=1 (same convention as design2.spec.ts).
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, seedTask } from './support/app'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)

test.describe('snag train 2026-10', () => {
  // === slice 1 (Fixes #15) — now-pill hides the hour numeral ===
  test('#15 the now-pill never leaves the hour numeral peeking out', async ({ page, context }) => {
    const now = new Date()
    now.setHours(15, 6, 0, 0) // 6 min past the hour: inside the 12-min mask window
    await page.clock.install({ time: now })
    await openApp(page, context, {
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const masked = page.locator('[data-testid="hour-label"][data-hour="15"]')
    const clear = page.locator('[data-testid="hour-label"][data-hour="13"]')
    await masked.scrollIntoViewIfNeeded()
    await expect(page.getByTestId('now-line')).toBeVisible()
    expect(await masked.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
    expect(await clear.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  })

  test('#15 evidence: day view with the now-pill masking the hour', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const now = new Date()
    now.setHours(15, 4, 0, 0)
    await page.clock.install({ time: now })
    await openApp(page, context, {
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const px = (await isMobile(page)) ? 66 : 72
    await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y), 14 * px)
    await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-1-day-${info.project.name}.png` })
  })
})
