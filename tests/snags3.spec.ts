// arc 3 slices 2–10 — snag Issues #29–#37 (label `snag`), raised by the snag-train 2026-10 slice-14 Eye LITE critique
// (docs/evidence/snag-train-2026-10-slice-14-design-critique.md). One behavioural case per Issue.
import { test, expect, type Page } from '@playwright/test'
import { openApp, seedDay } from './support/app'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)

test.describe('snags #29–#37 (arc 3)', () => {
  test('#29 the iPhone inbox has no desktop drag hint under the tab bar; desktop keeps it', async ({ page, context }) => {
    await openApp(page, context, { seed: (s) => seedDay(s) })
    const mobile = await isMobile(page)
    if (mobile) await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('inbox-row').first()).toBeVisible()
    const ft = page.locator('.backlog .ft')
    if (mobile) await expect(ft).toBeHidden()
    else await expect(ft).toBeVisible()
  })
})
