// arc 6 slice 9 — captures of every mocked state (docs/design/2026-10-09-mockups/01–10) at 402×874, dark + light, for
// the Eye LITE side-by-side (docs/evidence/arc6-eye-lite.md). EVIDENCE-gated: `EVIDENCE=1 npx playwright test tests/eye.spec.ts`.
import { test, expect, type Page } from '@playwright/test'
import { at, openApp } from './support/app'

const settle = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
const shot = (page: Page, n: string, theme: string) => page.screenshot({ path: `docs/evidence/arc6-eye-${n}-${theme}.png` })

for (const theme of ['dark', 'light'] as const)
  test(`mocked states (${theme})`, async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE || info.project.name !== 'iphone-15', 'set EVIDENCE=1 (iPhone)')
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context, { at: '08:00', theme })
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ day_start: 540, day_end: 1350, clock24: false }))
    await expect(page.getByTestId('anchor').first()).toHaveAttribute('data-start', '540')
    await settle(page)
    await shot(page, '01-day-empty', theme)

    // 07 inbox (empty)
    await page.getByTestId('tab-backlog').click()
    await settle(page)
    await shot(page, '07-inbox-empty', theme)
    await page.getByTestId('tab-timeline').click()

    // 04 ① title + suggestions
    await page.getByTestId('fab').click()
    await settle(page)
    await shot(page, '04-new-task-title', theme)
    // 02 ② when
    await page.getByTestId('wizard-title').fill('Watch a movie at 8pm for 1.5h #errands')
    await page.getByTestId('wizard-continue').click()
    await settle(page)
    await shot(page, '02-new-task-when', theme)
    // 05 the ••• menu
    await page.getByTestId('time-more').click()
    await settle(page)
    await shot(page, '05-time-more-menu', theme)
    await page.keyboard.press('Escape')
    // 03 the duration sheet
    await page.getByTestId('duration-more').click()
    await settle(page)
    await shot(page, '03-duration-sheet', theme)
    await page.keyboard.press('Escape')
    // 06 ③ details
    await page.getByTestId('wizard-continue').click()
    await settle(page)
    await shot(page, '06-new-task-details', theme)
    await page.getByTestId('wizard-create').click()
    await expect(page.getByTestId('wizard')).toHaveCount(0)

    // 08 day with a block, 09 the bookend done
    await page.getByTestId('toast').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined)
    await page.getByTestId('timeline').evaluate((el) => (el.scrollTop = 0))
    await settle(page)
    await shot(page, '08-day-with-block', theme)
    await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-ring"]').click()
    await page.getByTestId('toast').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined)
    await settle(page)
    await shot(page, '09-day-done-state', theme)
    await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-ring"]').click()

    // 10 week overview (panel collapsed): past days filled, today + future on --node
    for (let d = -5; d <= 1; d++) if (d) await page.evaluate(([s]) => (window as any).__optimo.repo.createTask({ title: 'Read', start_at: s, duration_min: 30, category_id: '0190a000-0000-7000-8000-000000000007' }), [at('13:00', d)])
    await page.getByTestId('tab-timeline').click() // the active tab toggles the detent
    await settle(page)
    await shot(page, '10-week-overview', theme)
  })
