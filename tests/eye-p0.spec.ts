// arc 6 slice 9b — regression guards for the Eye LITE P0s (docs/evidence/arc6-eye-lite.md).
import { test, expect, type Page } from '@playwright/test'
import { openApp, openCreateWizard } from './support/app'

const token = (page: Page, prop: 'color' | 'backgroundColor', v: string) =>
  page.evaluate(([p, name]) => {
    const i = document.createElement('i')
    ;(i.style as unknown as Record<string, string>)[p] = `var(${name})`
    document.body.append(i)
    const c = getComputedStyle(i)[p as 'color']
    i.remove()
    return c
  }, [prop, v] as const)

test.describe('Eye LITE P0 guards', () => {

  async function toWhen(page: Page) {
    await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context0!, { at: '08:00', theme: 'dark' })
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ clock24: false }))
    await openCreateWizard(page) // arc 7 slice 8: FAB → capture → Details…
    await page.getByTestId('wizard-title').fill('Watch a movie at 8pm for 1.5h')
    await page.getByTestId('wizard-continue').click()
  }
  let context0: import('@playwright/test').BrowserContext | null = null
  test.beforeEach(({ context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'phone geometry')
    context0 = context
  })

  test('P0-1/7: rows below the wheel pill continue from the end; unselected duration presets are grey', async ({ page }) => {
    await toWhen(page)
    const rows = page.getByTestId('time-wheel').getByRole('option')
    await expect(rows.filter({ hasText: '9:45 PM' })).toHaveCount(1)
    await expect(rows.filter({ hasText: '7:45 PM' })).toHaveCount(1)
    await expect(rows.filter({ hasText: /^8:15 PM$/ })).toHaveCount(0)
    const off = page.getByTestId('duration-chip').filter({ hasText: /^30$/ })
    expect(await off.evaluate((e) => getComputedStyle(e).color)).toBe(await token(page, 'color', '--ink-on-tint-muted'))
  })

  test('P0-2/3: the duration sheet covers the whole editor, sits 6 px off the bottom and is an opaque card', async ({ page }) => {
    await toWhen(page)
    await page.getByTestId('duration-more').click()
    await page.waitForFunction(() => document.getAnimations().length === 0)
    const wrap = (await page.locator('.dur-wrap').boundingBox())!
    expect(wrap.y).toBeLessThanOrEqual(0)
    expect(wrap.height).toBeGreaterThanOrEqual(873)
    const sheet = (await page.getByTestId('duration-sheet').boundingBox())!
    expect(Math.abs(874 - (sheet.y + sheet.height) - 6)).toBeLessThanOrEqual(2)
    expect(await page.getByTestId('duration-sheet').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(await token(page, 'backgroundColor', '--card'))
  })

  test('P0-4/5: week discs are 40 px; the peek row sits inside the narrower card', async ({ page, context }) => {
    await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context, { at: '08:00', theme: 'dark' })
    await page.getByTestId('tab-timeline').click() // the active tab collapses the panel
    await expect(page.getByTestId('panel-sheet')).toHaveAttribute('data-detent', 'week')
    await page.waitForFunction(() => document.getAnimations().length === 0)
    const disc = (await page.locator('.wnode').first().boundingBox())!
    expect(Math.round(disc.width)).toBe(40)
    const chip = (await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-chip"]').boundingBox())!
    const ring = (await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-ring"]').boundingBox())!
    expect(Math.abs(chip.x + chip.width / 2 - 68)).toBeLessThanOrEqual(3)
    expect(Math.abs(ring.x + ring.width / 2 - 343)).toBeLessThanOrEqual(3)
  })
})
