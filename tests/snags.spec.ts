// Arc-1 design snags #1–#12 (label `snag`), one regression case each. Assertions are behavioural (text, geometry,
// computed state) so they survive the arc-2 restyle.
import { test, expect, type Page } from '@playwright/test'
import { CAT, openApp, seedDay, seedTask } from './support/app'

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
    await expect(b.locator('.blk-main')).toHaveAccessibleName(/, late/)
    // the cue is text, not colour alone
    expect(await b.locator('.time b').evaluate((el) => getComputedStyle(el, '::after').content)).toContain('late')
  })

  test('#2 priority is a label, not an unlabeled inner rule', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const deep = block(page, ids!.deep)
    await deep.scrollIntoViewIfNeeded()
    expect(await deep.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
    await expect(deep.locator('.blk-main')).toHaveAccessibleName(/P1/)
  })

  test('#3 inbox category reads as a whole short code, never cut mid-word', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await showInbox(page)
    const cat = page.getByTestId('inbox-row').filter({ hasText: 'Book flights' }).getByTestId('inbox-cat')
    await expect(cat).toHaveText('Pers')
    expect(await cat.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  })

  test('#4 week header says which figure is planned; free time shows in the grid', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await setView(page, 'week')
    await expect(page.getByTestId('week-hours').first()).toContainText(/\d+h\d\d plan · \d+h\d\d free/)
    expect(await page.getByTestId('week-free').count()).toBeGreaterThan(0)
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

  test('#6 mobile chrome: one strip row, hint only while typing', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'iphone-15', 'mobile chrome')
    await openApp(page, context, { seed: seedDay })
    await expect(page.getByTestId('stat-unplaced')).toHaveCount(0)
    expect((await page.locator('.strip').boundingBox())!.height).toBeLessThanOrEqual(44 + 60) // one 40px row + safe-area top
    const rows = await page.locator('.strip .cell').evaluateAll((els) => new Set(els.map((e) => { const r = e.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 8) })).size)
    expect(rows).toBe(1)
    await expect(page.getByTestId('parse-row')).toBeHidden()
    await page.getByTestId('quickadd').focus()
    await expect(page.getByTestId('parse-row')).toBeVisible()
  })

  test('#7 hour lines do not run through the free-time label', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    // arc 2: free time is a dotted rule with an opaque sage label pill that sits above the dashed hour lines
    const label = page.getByTestId('free-row').filter({ has: page.locator('.free-label') }).first().locator('.free-label')
    await label.scrollIntoViewIfNeeded()
    expect(await label.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
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
