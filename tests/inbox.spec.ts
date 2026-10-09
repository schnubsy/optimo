// Inbox + quick-add + Place: capture → inbox, drag/Place → timeline, unschedule back.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { openApp, row, seedDay, quickAdd, commitWizard } from './support/app'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)
async function showInbox(page: Page) {
  if (await isMobile(page)) await page.getByTestId('tab-backlog').click()
}
async function showBoard(page: Page) {
  if (await isMobile(page)) await page.getByTestId('tab-timeline').click()
}
const inboxRow = (page: Page, title: string) => page.getByTestId('inbox-row').filter({ hasText: title })

test.describe('inbox & quick-add', () => {
  test('quick-add shows a parse preview, then captures to the inbox', async ({ page, context }) => {
    const { errors } = await openApp(page, context, { seed: seedDay })
    const qa = (await quickAdd(page))
    await qa.fill('Book train tickets for 20m #errands !!')
    if (await isMobile(page)) {
      // iPhone: the FAB's wizard previews the parse as chips; no time typed → ② → ••• Add to Inbox
      await expect(page.getByTestId('wizard-parse')).toContainText('20 min')
      await expect(page.getByTestId('wizard-parse')).toContainText('Errands')
      await commitWizard(page, { inbox: true })
    } else {
      await expect(page.getByTestId('parse-row')).toContainText('Book train tickets')
      await expect(page.getByTestId('parse-row')).toContainText('inbox')
      await expect(page.getByTestId('parse-row')).toContainText('Errands')
      await expect(page.getByTestId('parse-row')).toContainText('P2')
      await qa.press('Enter')
      await expect(qa).toHaveValue('')
    }
    await showInbox(page)
    const r = inboxRow(page, 'Book train tickets')
    await expect(r).toBeVisible()
    await expect(r).toContainText('20 min · Errands · P2') // arc 6 meta: duration · category
    expect(errors).toEqual([])
  })

  test('quick-add with a time lands on the timeline ("Lunch with Sam at 1pm")', async ({ page, context }) => {
    await openApp(page, context)
    const qa = (await quickAdd(page))
    await qa.fill('Coffee with Sam at 1pm')
    if (await isMobile(page)) {
      await expect(page.getByTestId('wizard-parse-when')).toHaveText('13:00–13:30')
      await commitWizard(page)
    } else {
      await expect(page.getByTestId('parse-row')).toContainText('13:00–13:30')
      await qa.press('Enter')
    }
    const b = page.locator('[data-testid="block"]', { hasText: 'Coffee with Sam' })
    await expect(b).toHaveAttribute('data-start', String(13 * 60))
  })

  test('Tab opens the parsed fields in the create wizard', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard')
    await openApp(page, context)
    await page.keyboard.press('/')
    await page.keyboard.type('Pay rent tomorrow 9am for 15m')
    await page.keyboard.press('Tab')
    const w = page.getByTestId('wizard')
    await expect(w).toBeVisible()
    await expect(page.getByTestId('wizard-title')).toHaveValue('Pay rent')
    await expect(w).toHaveAttribute('data-start', String(9 * 60))
    await expect(w).toHaveAttribute('data-duration', '15')
    const tomorrow = await page.evaluate(() => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    await expect(w).toHaveAttribute('data-date', tomorrow)
  })

  test('Place fills the earliest free slot that fits', async ({ page, context }) => {
    let inbox: ReturnType<typeof seedDay>['inbox']
    // pin the clock mid-morning: run late in the evening, the earliest free slot falls on tomorrow's board
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    await page.clock.install({ time: now })
    const { errors } = await openApp(page, context, { seed: (s) => (inbox = seedDay(s).inbox) })
    await showInbox(page)
    await inboxRow(page, 'Read chapter 4').getByTestId('place').click()
    const picker = page.getByTestId('place-picker')
    await expect(picker).toBeVisible()
    const first = picker.getByTestId('slot').first()
    await expect(first).toContainText('earliest')
    const label = (await first.locator('.mono').first().textContent())!.trim()
    await first.click()
    await expect(picker).toHaveCount(0)
    await expect.poll(async () => (await row(page, inbox!.ch4)).start_at).not.toBeNull()
    const d = new Date((await row(page, inbox!.ch4)).start_at)
    expect(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`).toBe(label)
    await showBoard(page)
    await expect(page.locator('[data-testid="block"]', { hasText: 'Read chapter 4' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('drag inbox → timeline schedules; drag block → inbox unschedules (desktop)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'mobile uses Place (no cross-tab drag, by design)')
    let s: ReturnType<typeof seedDay>
    const { errors } = await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    const tl = page.getByTestId('timeline')
    await tl.evaluate((el) => (el.scrollTop = 16 * 72))
    const src = (await inboxRow(page, 'Reply to Ellen').locator('.irow-main').boundingBox())!
    const inner = (await page.locator('.tl-inner').boundingBox())!
    const targetY = inner.y + 17 * 72 + 10 // 17:00 + a little
    await page.mouse.move(src.x + 40, src.y + 10)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(src.x + 40 + ((inner.x + 200 - src.x - 40) * i) / 12, src.y + 10 + ((targetY - src.y - 10) * i) / 12)
    await expect(page.getByTestId('drop-ghost')).toBeVisible()
    await page.mouse.up()
    await expect.poll(async () => (await row(page, s!.inbox.ellen)).start_at).not.toBeNull()
    const d = new Date((await row(page, s!.inbox.ellen)).start_at)
    expect(d.getHours()).toBe(17)
    await expect(inboxRow(page, 'Reply to Ellen')).toHaveCount(0)

    // and back: drag the new block onto the inbox rail
    const blk = (await page.locator(`[data-testid="block"][data-id="${s!.inbox.ellen}"] .blk-main`).boundingBox())!
    const rail = (await page.getByTestId('inbox').boundingBox())!
    await page.mouse.move(blk.x + 20, blk.y + 5)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(blk.x + 20 + ((rail.x + 150 - blk.x - 20) * i) / 12, blk.y + 5 + ((rail.y + 300 - blk.y - 5) * i) / 12)
    await page.mouse.up()
    await expect.poll(async () => (await row(page, s!.inbox.ellen)).start_at).toBeNull()
    await expect(inboxRow(page, 'Reply to Ellen')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('unschedule from the editor (mobile path)', async ({ page, context }) => {
    let s: ReturnType<typeof seedDay>
    await openApp(page, context, { seed: (x) => (s = seedDay(x)), at: '12:00' })
    const b = page.locator(`[data-testid="block"][data-id="${s!.ids.guitar}"] .blk-main`)
    await b.scrollIntoViewIfNeeded()
    await b.click()
    await b.click()
    await page.getByRole('switch', { name: 'On the timeline (off = inbox)' }).click()
    await page.getByTestId('sheet-save').click()
    await expect.poll(async () => (await row(page, s!.ids.guitar)).start_at).toBeNull()
    await showInbox(page)
    await expect(inboxRow(page, 'Guitar practice')).toBeVisible()
  })

  test('drag a row onto another reorders within the inbox (desktop)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop rail')
    await openApp(page, context, { seed: seedDay })
    // two P0 rows: add another, then move it above "Read chapter 4"
    await (await quickAdd(page)).fill('Sort the garage')
    await (await quickAdd(page)).press('Enter')
    const titles = () => page.getByTestId('inbox-row').locator('.it').allTextContents()
    await expect.poll(titles).toEqual(['Book flights for October', 'Reply to Ellen re budget', 'Renew car registration', 'Read chapter 4', 'Sort the garage'])
    const from = (await inboxRow(page, 'Sort the garage').locator('.irow-main').boundingBox())!
    const to = (await inboxRow(page, 'Read chapter 4').boundingBox())!
    await page.mouse.move(from.x + 30, from.y + 20)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + 30, from.y + 20 + (to.y + 12 - from.y - 20) * (i / 8))
    await page.mouse.up()
    await expect.poll(titles).toEqual(['Book flights for October', 'Reply to Ellen re budget', 'Renew car registration', 'Sort the garage', 'Read chapter 4'])
  })

  test('categories page + icon sheet are axe clean; icon set has ≥ 40 original glyphs', async ({ page, context }, info) => {
    await openApp(page, context)
    await setView(page, 'categories')
    await expect(page.getByTestId('category-row')).toHaveCount(8)
    let r = await new AxeBuilder({ page }).analyze()
    expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
    await setView(page, 'icons')
    const n = await page.getByTestId('icon-sheet').locator('li').count()
    expect(n).toBeGreaterThanOrEqual(40)
    r = await new AxeBuilder({ page }).analyze()
    expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
    if (process.env.EVIDENCE && info.project.name === 'desktop') await page.screenshot({ path: 'docs/evidence/arc1-slice-4-icon-sheet.png', fullPage: true })
  })

  test('evidence screenshots', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    await openApp(page, context, { seed: seedDay })
    await (await quickAdd(page)).fill('Gym every weekday for 1h #health !!')
    await page.getByTestId('timeline').evaluate((el) => (el.scrollTop = 6.5 * 72))
    await page.screenshot({ path: `docs/evidence/arc1-slice-4-inbox-${info.project.name}.png` })
    if (await isMobile(page)) {
      await showInbox(page)
      await page.getByTestId('place').first().click()
      await expect(page.getByTestId('place-picker')).toBeVisible()
      await page.screenshot({ path: `docs/evidence/arc1-slice-4-place-${info.project.name}.png` })
    }
  })
})

async function setView(page: Page, view: string) {
  await page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
}
