// arc 6 slice 6 — the create wizard ① title + suggestions → ② when (wheel, ••• menu, duration sheet) → ③ (stub).
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { CAT, openApp } from './support/app'

const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
const wizard = (page: Page) => page.getByTestId('wizard')

/** FAB on iPhone, `N` on desktop. */
async function openWizard(page: Page) {
  const fab = page.getByTestId('fab')
  if (await fab.isVisible()) await fab.click()
  else await page.keyboard.press('n')
  await expect(wizard(page)).toHaveAttribute('data-step', '1')
  await expect(page.getByTestId('wizard-title')).toBeFocused()
}
const clock12 = (page: Page) => page.evaluate(() => (window as any).__optimo.repo.updateSettings({ clock24: false }))
const taskByTitle = (page: Page, title: string) =>
  page.evaluate(async (t) => {
    const row = (await (window as any).__optimo.db.tasks.toArray()).find((x: any) => x.title === t)
    return row ? { ...row, hour: row.start_at ? new Date(row.start_at).getHours() : null, minute: row.start_at ? new Date(row.start_at).getMinutes() : null } : null
  }, title)

test.describe('create wizard', () => {
  test('typed title → ② pre-filled from the parser → ③ Create → the block exists at 20:00 for 90 min', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await clock12(page)
    await openWizard(page)
    await expect(page.getByTestId('wizard-continue')).toBeDisabled()
    await page.getByTestId('wizard-title').fill('Movie night at 8pm for 1.5h')
    await expect(page.getByTestId('wizard-parse-when')).toHaveText('8:00 PM–9:30 PM')
    await expect(page.getByTestId('wizard-parse-duration')).toHaveText('1 hr, 30 min')
    await page.getByTestId('wizard-title').press('Enter')
    await expect(wizard(page)).toHaveAttribute('data-step', '2')
    await expect(page.getByTestId('wizard-title')).toHaveValue('Movie night')
    await expect(page.getByTestId('time-pill')).toHaveText('8:00–9:30 PM')
    await expect(page.getByTestId('wizard-meta')).toHaveText('8:00–9:30 PM (1 hr, 30 min)')
    await expect(page.locator('[data-testid="duration-chip"][aria-pressed="true"]')).toHaveText('1.5h')
    await expect(page.getByTestId('wizard-date')).toContainText('Today')
    await page.getByTestId('wizard-continue').click()
    await expect(wizard(page)).toHaveAttribute('data-step', '3')
    await page.getByTestId('wizard-create').click()
    await expect(wizard(page)).toHaveCount(0)
    await expect(page.getByTestId('toast')).toContainText('Movie night')
    await expect(page.locator('[data-testid="block"][data-start="1200"][data-duration="90"]')).toBeAttached()
    const t = await taskByTitle(page, 'Movie night')
    expect(t).toMatchObject({ hour: 20, minute: 0, duration_min: 90, all_day: false })
  })

  test('tapping a suggestion fills title, glyph + category, time and duration', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await clock12(page)
    await openWizard(page)
    const sugg = page.getByTestId('suggestion')
    await expect(sugg).toHaveCount(5) // our seed set (no history)
    await page.getByTestId('wizard-title').fill('mov')
    await expect(sugg).toHaveCount(1)
    const icon = await sugg.locator('svg').getAttribute('data-icon')
    expect(icon).toBeTruthy()
    await sugg.click()
    await expect(wizard(page)).toHaveAttribute('data-step', '2')
    await expect(page.getByTestId('wizard-title')).toHaveValue('Movie night')
    await expect(page.getByTestId('wizard-glyph')).toHaveAttribute('data-icon', icon!)
    await expect(wizard(page)).toHaveAttribute('data-category', CAT.personal)
    await expect(page.getByTestId('time-pill')).toHaveText('8:00–9:30 PM')
    await expect(page.locator('[data-testid="duration-chip"][aria-pressed="true"]')).toHaveText('1.5h')
  })

  test('suggestions learn from the last 60 days (mode start, median duration, category)', async ({ page, context }) => {
    const { seedTask, at } = await import('./support/app')
    await openApp(page, context, {
      at: '09:00',
      seed: (s) => {
        seedTask(s, { title: 'Swim', start_at: at('06:30', -3), duration_min: 45, category_id: CAT.health })
        seedTask(s, { title: 'swim', start_at: at('06:30', -2), duration_min: 60, category_id: CAT.health })
        seedTask(s, { title: 'Swim', start_at: at('07:00', -1), duration_min: 30, category_id: CAT.health })
      },
    })
    await clock12(page)
    await openWizard(page)
    await expect(page.getByTestId('suggestion')).toHaveCount(1)
    await expect(page.getByTestId('suggestion')).toContainText('6:30–7:15 AM (45 min)')
  })

  test('Add to Inbox from the ••• menu lands the task in the inbox', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await openWizard(page)
    await page.getByTestId('wizard-title').fill('Sort the receipts')
    await page.getByTestId('wizard-continue').click()
    await page.getByTestId('time-more').click()
    await expect(page.getByRole('menu', { name: 'Time options' })).toBeVisible()
    await expect(page.getByRole('menuitem')).toHaveText(['Change Day', 'Set Timezone', 'Change to All-Day', 'Add to Inbox', 'Time Picker'])
    await page.getByRole('menuitem', { name: 'Add to Inbox' }).click()
    await expect(wizard(page)).toHaveAttribute('data-step', '3')
    await expect(wizard(page)).toHaveAttribute('data-mode', 'inbox')
    await expect(page.getByTestId('details-inbox')).toBeVisible()
    await page.getByTestId('wizard-create').click()
    await expect(wizard(page)).toHaveCount(0)
    await expect.poll(() => taskByTitle(page, 'Sort the receipts')).toMatchObject({ start_at: null, _kind: 'inbox' })
  })

  test('Change to All-Day hides the wheel; Set Timezone is a stub until slice 7', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await openWizard(page)
    await page.getByTestId('wizard-title').fill('Holiday')
    await page.getByTestId('wizard-continue').click()
    await page.getByTestId('time-more').click()
    await page.getByRole('menuitem', { name: 'Set Timezone' }).click()
    await expect(page.getByTestId('toast')).toContainText('Timezone')
    await page.getByTestId('time-more').click()
    await page.getByRole('menuitem', { name: 'Change to All-Day' }).click()
    await expect(page.getByTestId('time-wheel')).toHaveCount(0)
    await expect(page.getByTestId('wizard-allday')).toBeVisible()
    await expect(page.getByTestId('wizard-meta')).toHaveText('All day')
  })

  test('duration presets: remove one, Reset, add one — persisted across reloads', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    const toStep2 = async () => {
      await openWizard(page)
      await page.getByTestId('wizard-title').fill('Read')
      await page.getByTestId('wizard-continue').click()
      await expect(wizard(page)).toHaveAttribute('data-step', '2')
    }
    const quick = page.getByTestId('duration-chip')
    await toStep2()
    await expect(quick).toHaveText(['1', '15', '30', '45', '1h', '1.5h'])
    await page.getByTestId('duration-more').click()
    const sheet = page.getByTestId('duration-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId('duration-hours')).toBeFocused()
    await expect(sheet.getByTestId('preset')).toHaveText(['1m', '15m', '30m', '45m', '1h', '1h 30m'])
    await sheet.getByRole('button', { name: 'Remove 1m preset' }).click()
    await expect(sheet.getByTestId('preset')).toHaveCount(5)
    await expect(quick).toHaveText(['15', '30', '45', '1h', '1.5h'])

    await page.reload()
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await toStep2()
    await expect(quick).toHaveText(['15', '30', '45', '1h', '1.5h'])
    await page.getByTestId('duration-more').click()
    await sheet.getByTestId('presets-reset').click()
    await expect(sheet.getByTestId('preset')).toHaveCount(6)
    // wheel to 2 h 30 min (default 30 min) and save it as a preset
    await sheet.getByTestId('duration-hours').focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('wizard-meta')).toContainText('(2 hr, 30 min)')
    await sheet.getByTestId('preset-add').click()
    await expect(sheet.getByTestId('preset')).toHaveText(['1m', '15m', '30m', '45m', '1h', '1h 30m', '2h 30m'])
    await sheet.getByRole('button', { name: 'Close duration' }).click()
    await expect(sheet).toHaveCount(0)
    await expect(page.locator('[data-testid="duration-chip"][aria-pressed="true"]')).toHaveText('2.5h')

    await page.reload()
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await toStep2()
    await expect(quick).toHaveText(['1', '15', '30', '45', '1h', '1.5h', '2.5h'])
    expect(await page.evaluate(async () => (await (window as any).__optimo.db.settings.get('me')).data.duration_presets)).toEqual([1, 15, 30, 45, 60, 90, 150])
  })

  test('the time wheel is keyboard-operable (↓ ↓ = +30 min, Home / End)', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await clock12(page)
    await openWizard(page)
    await page.getByTestId('wizard-title').fill('Read at 9am')
    await page.getByTestId('wizard-continue').click()
    const pill = page.getByTestId('time-pill')
    await expect(pill).toHaveText('9:00–9:30 AM')
    await page.getByTestId('time-wheel').focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(pill).toHaveText('9:30–10:00 AM')
    await expect(page.getByTestId('time-wheel')).toHaveAttribute('aria-activedescendant', 'tw-38')
    await page.keyboard.press('ArrowUp')
    await expect(pill).toHaveText('9:15–9:45 AM')
    await page.keyboard.press('Home')
    await expect(pill).toHaveText('12:00–12:30 AM')
    // the scroller follows the value
    await expect.poll(() => page.getByTestId('time-wheel').evaluate((el) => el.scrollTop)).toBe(0)
  })

  test('X with a title asks to discard; Keep editing keeps it; empty closes at once', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await openWizard(page)
    await page.getByTestId('wizard-close').click()
    await expect(wizard(page)).toHaveCount(0)

    await openWizard(page)
    await page.getByTestId('wizard-title').fill('Half a thought')
    await page.getByTestId('wizard-close').click()
    const dlg = page.getByRole('alertdialog', { name: 'Discard this task?' })
    await expect(dlg).toBeVisible()
    await dlg.getByRole('button', { name: 'Keep editing' }).click()
    await expect(dlg).toHaveCount(0)
    await expect(page.getByTestId('wizard-title')).toHaveValue('Half a thought')
    await page.keyboard.press('Escape')
    await expect(dlg).toBeVisible()
    await dlg.getByRole('button', { name: 'Discard' }).click()
    await expect(wizard(page)).toHaveCount(0)
    expect(await taskByTitle(page, 'Half a thought')).toBeNull()
  })

  test('axe clean on ① and ② (dark)', async ({ page, context }, info) => {
    if (info.project.name === 'iphone-15') await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context, { at: '09:00', theme: 'dark' })
    await clock12(page)
    await openWizard(page)
    await settled(page)
    expect(await axe(page)).toEqual([])
    if (process.env.EVIDENCE && info.project.name === 'iphone-15') await page.screenshot({ path: 'docs/evidence/arc6-slice-6-wizard-1.png' })
    await page.getByTestId('suggestion').filter({ hasText: 'Movie night' }).click()
    await expect(wizard(page)).toHaveAttribute('data-step', '2')
    await settled(page)
    expect(await axe(page)).toEqual([])
    if (process.env.EVIDENCE && info.project.name === 'iphone-15') {
      await page.screenshot({ path: 'docs/evidence/arc6-slice-6-wizard-2.png' })
      await page.getByTestId('duration-more').click()
      await settled(page)
      await page.screenshot({ path: 'docs/evidence/arc6-slice-6-wizard-duration.png' })
    }
  })
})
