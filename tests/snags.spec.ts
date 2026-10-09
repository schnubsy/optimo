// Arc-1 design snags #1–#12 (label `snag`), one regression case each. Assertions are behavioural (text, geometry,
// computed state) so they survive the arc-2 restyle.
import { test, expect, type Page } from '@playwright/test'
import { CAT, openApp, seedDay, seedTask, quickAdd } from './support/app'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)
const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
const block = (page: Page, id: string) => page.locator(`[data-testid="block"][data-id="${id}"]`)
async function showInbox(page: Page) {
  if (await isMobile(page)) await page.getByTestId('tab-backlog').click()
}

test.describe('snags #1–#12', () => {
  test('#1 late is located on the board, not only counted', async ({ page, context }) => {
    const now = new Date()
    test.skip(now.getHours() < 2, 'needs an ended block earlier today')
    let id = ''
    await openApp(page, context, {
      seed: (s) => {
        id = seedTask(s, { title: 'Send the invoice', start_at: new Date(now.getTime() - 90 * 60_000).toISOString(), duration_min: 30, category_id: CAT.work }).id
      },
    })
    const b = block(page, id)
    await b.scrollIntoViewIfNeeded()
    await expect(b).toHaveAttribute('data-late', 'true')
    await expect(b.getByTestId('chip')).toHaveAccessibleName(/, late/)
    // the cue is text, not colour alone (arc 6: in the meta line)
    await expect(b.locator('.node-meta')).toContainText('late')
  })

  test('#2 priority is a label, not an unlabeled inner rule', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const deep = block(page, ids!.deep)
    await deep.scrollIntoViewIfNeeded()
    expect(await deep.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
    await expect(deep.getByTestId('chip')).toHaveAccessibleName(/P1/)
  })

  test('#3 inbox category reads as a whole name, never cut mid-word', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await showInbox(page)
    // arc 6: the meta line is full width (`duration · category`), so the short-code column is gone
    const cat = page.getByTestId('inbox-row').filter({ hasText: 'Book flights' }).getByTestId('inbox-cat')
    await expect(cat).toHaveText('Personal')
  })

  // arc 6 slice 4: the plan/free figures and dotted free rules left with the old grid (mockup 10 has none) — free time
  // now reads as the bare spine between a day's nodes, from its first node to its last
  test('#4 week: every day shows its spine between the first and last node', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await setView(page, 'week')
    await expect(page.getByTestId('week-spine')).toHaveCount(7)
    for (const h of await page.getByTestId('week-spine').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThan(100)
  })

  test('#5 resting "Synced" does not spend the signal colour', async ({ page, context }) => {
    await openApp(page, context)
    const [dot, signal, ink3] = await page.getByTestId('sync-badge').evaluate((el) => {
      const probe = document.createElement('i')
      document.body.append(probe)
      probe.style.background = 'var(--signal)'
      const sig = getComputedStyle(probe).backgroundColor
      probe.style.background = 'var(--ink-3)'
      const i3 = getComputedStyle(probe).backgroundColor
      probe.remove()
      return [getComputedStyle(el.querySelector('i')!).backgroundColor, sig, i3]
    })
    expect(dot).not.toBe(signal)
    expect(dot).toBe(ink3)
  })

  test('#6 mobile chrome stays within its budget; the syntax hint shows only while typing', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'iphone-15', 'mobile chrome')
    await openApp(page, context, { seed: seedDay })
    // arc 2: the strip is replaced by the faded header (112pt + safe area) and a floating bar the board scrolls under
    expect((await page.getByTestId('header').boundingBox())!.height).toBeLessThanOrEqual(131 + 60)
    await expect(page.getByTestId('quickadd')).toHaveCount(0)
    // arc 6: the FAB opens the create wizard; its parse chips appear only once something parses
    const field = await quickAdd(page)
    await expect(page.getByTestId('wizard-parse')).toBeEmpty()
    await field.fill('Lunch at 1pm')
    await expect(page.getByTestId('wizard-parse')).toContainText('13:00')
  })

  test('#7 the spine never runs through the free-time sentence', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    // arc 6: free time is a sentence in the text column, right of the spine (no hour lines cross it)
    const say = page.getByTestId('free-row').locator('.gap-say').first()
    await say.scrollIntoViewIfNeeded()
    const spine = (await page.getByTestId('spine').first().boundingBox())!
    expect((await say.boundingBox())!.x).toBeGreaterThan(spine.x + spine.width + 24)
  })

  test('#8 no native checkboxes in the editor or focus — subtasks toggle on their own chip', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0)
    const sub = dialog.getByRole('button', { name: 'Mark Rollback done' })
    await expect(sub).toHaveAttribute('aria-pressed', 'false')
    await sub.click()
    await expect(sub).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ view: 'focus', focusId: id }), ids!.plan)
    await expect(page.getByTestId('focus')).toBeVisible()
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0)
  })

  test('#9 focus hero shows time left; elapsed is secondary', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, {
      seed: (s) => (id = seedTask(s, { title: 'Draft the brief', start_at: new Date(Date.now() + 3 * 3600_000).toISOString(), duration_min: 90, category_id: CAT.work }).id),
    })
    await page.evaluate((i) => (window as any).__optimo.ui.getState().set({ view: 'focus', focusId: i }), id)
    // 90 min block not yet running → the hero counts down from 90:00
    await expect(page.getByTestId('focus-timer')).toHaveText(/^(90:00|89:5\d)$/)
    await expect(page.getByTestId('focus-sub')).toContainText('of 90 min')
  })

  test('#10 place sheet: header carries duration and priority; no band behind the dim', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await showInbox(page)
    const inboxTop = (await page.getByTestId('inbox').boundingBox())!.y
    const paneTop = (await page.locator('.pane').boundingBox())!.y
    expect(Math.abs(inboxTop - paneTop)).toBeLessThanOrEqual(1)
    await page.getByTestId('inbox-row').filter({ hasText: 'Book flights' }).getByTestId('place').click()
    await expect(page.getByTestId('place-meta')).toHaveText('0:30, P1')
  })

  test('#11 month arrows sit together after the title', async ({ page, context }) => {
    await openApp(page, context)
    await setView(page, 'month')
    const h = (await page.locator('#month-h').boundingBox())!
    const prev = (await page.getByRole('button', { name: 'Previous month' }).boundingBox())!
    const next = (await page.getByRole('button', { name: 'Next month' }).boundingBox())!
    expect(prev.x).toBeGreaterThan(h.x + h.width - 1)
    expect(next.x - (prev.x + prev.width)).toBeLessThan(16)
  })

  test('#12 settings day bounds follow the 12/24 h clock', async ({ page, context }) => {
    await openApp(page, context)
    await setView(page, 'settings')
    const start = page.getByTestId('set-day-start')
    await expect(start.locator('option:checked')).toHaveText('06:00')
    await page.getByTestId('set-clock').getByRole('button', { name: /12 h/ }).click()
    await expect(start.locator('option:checked')).toHaveText('6:00 AM')
    await start.selectOption({ label: '7:30 AM' })
    await expect.poll(() => page.evaluate(async () => (await (window as any).__optimo.db.settings.get('me'))?.data?.day_start)).toBe(450)
  })
})
