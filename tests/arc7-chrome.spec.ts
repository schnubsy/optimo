// arc 7 slice 3 — chrome, wizard, settings bugs (QA baseline 2026-10-09): header at 1024, docked wizard action, settings
// fields inside their cards, iPhone header only on the Timeline, week/month stepping, tz ranking, Esc in child sheets,
// inbox-mode suggestions, named completion toast, axe on ③ + Settings.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { openApp, openCreateWizard, seedDay } from './support/app'

const EVIDENCE = !!process.env.EVIDENCE
const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
const ui = (page: Page, patch: Record<string, unknown>) => page.evaluate((p) => (window as any).__optimo.ui.getState().set(p), patch)
const uiDate = (page: Page) => page.evaluate(() => (window as any).__optimo.ui.getState().date as string)
const isDesktop = (name: string) => name === 'desktop'
const wizard = (page: Page) => page.getByTestId('wizard')
const serious = async (page: Page, include?: string) => {
  const b = new AxeBuilder({ page })
  if (include) b.include(include)
  return (await b.analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}
const plusDays = (k: string, n: number) => {
  const d = new Date(`${k}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The box lies inside the viewport, clear of the simulated home-indicator inset, and nothing covers its centre. */
async function fullyVisible(page: Page, testid: string, bottomInset = 0) {
  const el = page.getByTestId(testid)
  await expect(el).toBeVisible()
  const vp = page.viewportSize()!
  const b = (await el.boundingBox())!
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5)
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height - bottomInset + 0.5)
  const hit = await page.evaluate(([x, y, id]) => !!document.elementFromPoint(x as number, y as number)?.closest(`[data-testid="${id}"]`), [b.x + b.width / 2, b.y + b.height / 2, testid])
  expect(hit, `${testid} is covered at its centre`).toBe(true)
}

/** iPhone: the arc-7 QA size (402×874) with the 34 px home-indicator inset simulated (Chromium reports env() = 0). */
async function phoneSize(page: Page, name: string) {
  if (isDesktop(name)) return 0
  await page.setViewportSize({ width: 402, height: 874 })
  await page.evaluate(() => document.documentElement.style.setProperty('--wiz-safe-b', '34px'))
  return 34
}

async function openCreate(page: Page) {
  await openCreateWizard(page) // arc 7 slice 8: FAB / N capture in one line; Details… is the wizard
}

test.describe('arc 7 slice 3 — desktop header', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop pane header')

  test('at 1024×768 AI + Settings are fully on screen; quick-add collapses to a "+" that opens the command line', async ({ page, context }) => {
    await openApp(page, context, { at: '10:00', seed: (s) => void seedDay(s) })
    for (const w of [1024, 1280, 1440]) {
      await page.setViewportSize({ width: w, height: w === 1024 ? 768 : 800 })
      await fullyVisible(page, 'hdr-plan')
      await fullyVisible(page, 'hdr-settings')
      await fullyVisible(page, 'sync-badge')
      // the placeholder shown is one of ours and fits whole (never clipped mid-word)
      const fits = await page.getByTestId('quickadd').evaluate((el: HTMLInputElement) => {
        const cs = getComputedStyle(el)
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        return ctx.measureText(el.placeholder).width <= el.clientWidth
      })
      expect(fits, `placeholder fits at ${w}`).toBe(true)
    }
    await page.setViewportSize({ width: 1024, height: 768 })
    const qa = (await page.getByTestId('pane-qa').boundingBox())!
    expect(qa.width).toBeLessThanOrEqual(48)
    if (EVIDENCE) await page.screenshot({ path: 'docs/evidence/arc7-slice-3-desktop-1024-header.png' })
    await page.getByTestId('quickadd').click()
    const open = (await page.getByTestId('quickadd').boundingBox())!
    expect(open.width).toBeGreaterThan(300)
    await page.getByTestId('quickadd').fill('Buy stamps')
    await page.getByTestId('quickadd').press('Enter')
    await expect(page.getByTestId('toast')).toContainText('Buy stamps')
    // the open command line stays for the next item; Esc folds it back to the "+" and the buttons are uncovered
    await page.getByTestId('quickadd').press('Escape')
    expect((await page.getByTestId('pane-qa').boundingBox())!.width).toBeLessThanOrEqual(48)
    await fullyVisible(page, 'hdr-settings')
  })

  test('‹ › step a day in Day, 7 days in Week, a month in Month; one set of arrows; no false Day on Plan/Settings (#52)', async ({ page, context }) => {
    await openApp(page, context, { at: '10:00' })
    const start = await uiDate(page)
    await page.getByTestId('hdr-next').click()
    expect(await uiDate(page)).toBe(plusDays(start, 1))
    await ui(page, { view: 'week' })
    await expect(page.getByRole('button', { name: 'Next week' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Previous week' })).toHaveCount(1)
    const w0 = await uiDate(page)
    await page.getByRole('button', { name: 'Next week' }).click()
    expect(await uiDate(page)).toBe(plusDays(w0, 7))
    await page.getByRole('button', { name: 'Previous week' }).click()
    expect(await uiDate(page)).toBe(w0)
    await ui(page, { view: 'month' })
    await expect(page.getByRole('button', { name: 'Next month' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Next month' }).click()
    const m = new Date(`${w0}T12:00:00`)
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    expect(await uiDate(page)).toBe(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`)
    const seg = page.getByTestId('segmented').getByRole('tab')
    await expect(seg.filter({ hasText: 'Month' })).toHaveAttribute('aria-selected', 'true')
    for (const id of ['hdr-plan', 'hdr-settings']) {
      await page.getByTestId(id).click()
      await expect(page.getByTestId('segmented').locator('[aria-selected="true"]')).toHaveCount(0)
    }
  })
})

test.describe('arc 7 slice 3 — wizard', () => {
  test('the primary action is fully visible on ① ② ③ (create) and ③ (edit); the edit title reads whole', async ({ page, context }, info) => {
    let ids: ReturnType<typeof seedDay>['ids'] | undefined
    await openApp(page, context, { at: '10:00', seed: (s) => (ids = seedDay(s).ids) })
    const inset = await phoneSize(page, info.project.name)
    await openCreate(page)
    await page.getByTestId('wizard-title').fill('Write the migration plan at 3pm')
    await settled(page)
    await fullyVisible(page, 'wizard-continue', inset)
    await page.getByTestId('wizard-continue').click()
    await expect(wizard(page)).toHaveAttribute('data-step', '2')
    await settled(page)
    await fullyVisible(page, 'wizard-continue', inset)
    await page.getByTestId('wizard-continue').click()
    await expect(wizard(page)).toHaveAttribute('data-step', '3')
    await settled(page)
    await fullyVisible(page, 'wizard-create', inset)
    // the whole ③ body scrolls above the docked button (the notes field can reach view)
    await page.getByTestId('details-notes').scrollIntoViewIfNeeded()
    await fullyVisible(page, 'wizard-create', inset)
    await page.getByTestId('wizard-create').click()
    await expect(wizard(page)).toHaveCount(0)

    await ui(page, { editingId: ids!.plan })
    await expect(wizard(page)).toHaveAttribute('data-step', '3')
    await settled(page)
    await fullyVisible(page, 'wizard-save', inset)
    const title = page.getByTestId('wizard-title')
    await expect(title).toHaveValue('Write the migration plan')
    const whole = await title.evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)
    expect(whole, 'edit title shown whole').toBe(true)
    // desktop: a dialog sized to the viewport, not cut at the bottom
    const box = (await wizard(page).boundingBox())!
    const vp = page.viewportSize()!
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5)
    if (isDesktop(info.project.name)) {
      expect(box.width).toBeGreaterThan(440)
      expect(box.height).toBeLessThanOrEqual(vp.height - 64 + 0.5)
    }
    if (EVIDENCE) await page.screenshot({ path: `docs/evidence/arc7-slice-3-wizard3-${isDesktop(info.project.name) ? 'desktop' : 'iphone'}.png` })
    // Delete still reachable by scrolling; Save stays docked
    await page.getByTestId('details-delete').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('details-delete')).toBeInViewport()
    await fullyVisible(page, 'wizard-save', inset)
  })

  test('time-zone search ranks the city prefix first ("Lon" → London) with a single focus ring', async ({ page, context }) => {
    await openApp(page, context, { at: '10:00' })
    await openCreate(page)
    await page.getByTestId('wizard-title').fill('Call Dana')
    await page.getByTestId('wizard-continue').click()
    await page.getByTestId('time-more').click()
    await page.getByTestId('more-timezone').click()
    await expect(page.getByTestId('tz-picker')).toBeVisible()
    const search = page.getByTestId('tz-search')
    await search.fill('Lon')
    await expect(page.getByTestId('tz-option').first()).toContainText('London')
    await search.fill('new york')
    await expect(page.getByTestId('tz-option').first()).toContainText('New York')
    // the field draws no ring of its own inside the focused pill (the old double border)
    await expect(search).toBeFocused()
    expect(await search.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
  })

  test('Escape in a child sheet closes only that sheet — no Discard prompt', async ({ page, context }) => {
    await openApp(page, context, { at: '10:00' })
    await openCreate(page)
    await page.getByTestId('wizard-title').fill('Water the plants at 6pm')
    await page.getByTestId('wizard-continue').click()
    // ② ••• menu and the Duration sheet
    await page.getByTestId('time-more').click()
    await expect(page.getByTestId('time-menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('time-menu')).toHaveCount(0)
    await page.getByTestId('duration-more').click()
    await expect(page.getByTestId('duration-sheet')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('duration-sheet')).toHaveCount(0)
    await expect(page.getByTestId('wizard-discard')).toHaveCount(0)
    await page.getByTestId('wizard-continue').click()
    // ③ Repeat: with focus inside the sheet, and after a tap on its heading has dropped focus to <body>
    for (const blur of [false, true]) {
      await page.getByTestId('details-repeat').click()
      await expect(page.getByTestId('repeat-sheet')).toBeVisible()
      if (blur) await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('repeat-sheet')).toHaveCount(0)
      await expect(page.getByTestId('wizard-discard')).toHaveCount(0)
      await expect(wizard(page)).toHaveAttribute('data-step', '3')
    }
    // with no child sheet open, Escape still asks to discard the typed task
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('wizard-discard')).toBeVisible()
  })

  test('the inbox-mode wizard offers no timed suggestions; a pick stays unscheduled', async ({ page, context }) => {
    await openApp(page, context, { at: '10:00' })
    await page.evaluate(() => (window as any).__optimo.ui.getState().openWizard('inbox'))
    await expect(wizard(page)).toHaveAttribute('data-mode', 'inbox')
    const sugg = page.getByTestId('suggestion')
    await expect(sugg.first()).toBeVisible()
    for (const s of await sugg.all()) {
      await expect(s).toHaveAttribute('data-timed', 'false')
      await expect(s.locator('.sugg-meta')).not.toContainText(/\d:\d\d/)
    }
    await sugg.first().click()
    await expect(wizard(page)).toHaveAttribute('data-step', '3')
    await expect(wizard(page)).toHaveAttribute('data-mode', 'inbox')
    await expect(page.getByTestId('details-inbox')).toBeVisible()
  })

  test('completing from the editor names the task in the toast', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids'] | undefined
    await openApp(page, context, { at: '10:00', seed: (s) => (ids = seedDay(s).ids) })
    await ui(page, { editingId: ids!.overlap })
    await page.getByTestId('wizard-complete').click()
    await expect(page.getByTestId('toast')).toContainText('Done · Review pull request')
  })

  test('axe: wizard ③ (create + edit) and the ③ zone row — no serious/critical; no duplicate banner landmark', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids'] | undefined
    await openApp(page, context, { at: '10:00', theme: 'dark', seed: (s) => (ids = seedDay(s).ids) })
    await openCreate(page)
    await page.getByTestId('wizard-title').fill('Review budget at 4pm')
    await page.getByTestId('wizard-continue').click()
    await page.getByTestId('wizard-continue').click()
    await expect(wizard(page)).toHaveAttribute('data-step', '3')
    await settled(page)
    expect(await serious(page)).toEqual([])
    const all = (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)
    expect(all).not.toContain('landmark-no-duplicate-banner')
    await page.getByTestId('wizard-close').click()
    await page.getByTestId('wizard-discard').getByRole('button', { name: 'Discard' }).click()
    // a zoned task: the time row wraps the zone instead of truncating it
    await page.evaluate((id) => (window as any).__optimo.repo.updateTask(id, { tz: 'Asia/Kolkata' }), ids!.plan)
    await ui(page, { editingId: ids!.plan })
    await expect(page.getByTestId('details-tz')).toBeVisible()
    await settled(page)
    const row = (await page.getByTestId('details-time').boundingBox())!
    const tz = (await page.getByTestId('details-tz').boundingBox())!
    expect(tz.x + tz.width).toBeLessThanOrEqual(row.x + row.width)
    expect(tz.y + tz.height).toBeLessThanOrEqual(row.y + row.height + 0.5)
    expect(await serious(page)).toEqual([])
  })

  test('Duration "Reset" passes AA in light and dark; "Change to All-Day" fits the ••• menu', async ({ page, context }) => {
    await openApp(page, context, { at: '10:00', theme: 'light' })
    await openCreate(page)
    await page.getByTestId('wizard-title').fill('Stretch')
    await page.getByTestId('wizard-continue').click()
    await page.getByTestId('time-more').click()
    const menu = (await page.getByTestId('time-menu').boundingBox())!
    const label = (await page.getByTestId('more-allday').locator('span').boundingBox())!
    expect(label.x + label.width).toBeLessThanOrEqual(menu.x + menu.width - 8)
    await page.keyboard.press('Escape')
    await page.getByTestId('duration-more').click()
    await expect(page.getByTestId('duration-sheet')).toBeVisible()
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as any).__optimo.repo.updateSettings({ theme: t }), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await settled(page)
      expect(await serious(page, '[data-testid="duration-sheet"]')).toEqual([])
    }
  })
})

test.describe('arc 7 slice 3 — settings + iPhone header', () => {
  test('Settings fields sit inside their cards (1024 / 1280 / iPhone); axe clean', async ({ page, context }, info) => {
    await openApp(page, context, { at: '10:00' })
    const widths = isDesktop(info.project.name) ? [1024, 1280, 1440] : [402]
    if (!isDesktop(info.project.name)) await page.setViewportSize({ width: 402, height: 874 })
    await ui(page, { view: 'settings', mobileTab: 'board' })
    await expect(page.locator('#set-h')).toBeVisible()
    for (const w of widths) {
      if (isDesktop(info.project.name)) await page.setViewportSize({ width: w, height: 800 })
      const bad = await page.locator('.settings .set-row').evaluateAll((rows) =>
        rows.flatMap((r) => {
          const rr = r.getBoundingClientRect()
          return [...r.querySelectorAll(':scope > select, :scope > input:not([type=file]), :scope > span, :scope > h3')]
            .filter((f) => (f as HTMLElement).offsetParent)
            .map((f) => ({ f: f.getBoundingClientRect(), t: (f as HTMLElement).dataset.testid ?? f.tagName }))
            .filter(({ f }) => f.right > rr.right + 0.5 || f.left < rr.left - 0.5)
            .map(({ t }) => t)
        }),
      )
      expect(bad, `fields overflowing their cards at ${w}`).toEqual([])
      if (EVIDENCE && w === 1280) {
        await page.locator('#set-day').scrollIntoViewIfNeeded()
        await page.screenshot({ path: 'docs/evidence/arc7-slice-3-settings-1280.png' })
      }
    }
    expect(await serious(page)).toEqual([])
  })

  test('iPhone: the date header + strip show on Timeline only; Inbox has a page h1', async ({ page, context }, info) => {
    test.skip(isDesktop(info.project.name), 'iPhone chrome')
    await openApp(page, context, { at: '10:00' })
    await page.setViewportSize({ width: 402, height: 874 })
    await expect(page.getByTestId('header')).toBeVisible()
    await page.getByTestId('tab-plan').click()
    await expect(page.getByTestId('header')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Plan' })).toBeInViewport()
    expect((await new AxeBuilder({ page }).analyze()).violations.map((x) => x.id)).not.toContain('page-has-heading-one')
    await page.getByTestId('tab-settings').click()
    await expect(page.getByTestId('header')).toHaveCount(0)
    await expect(page.getByTestId('strip-day')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeInViewport()
    await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('header')).toHaveCount(0)
    const v = (await new AxeBuilder({ page }).analyze()).violations.map((x) => x.id)
    expect(v).not.toContain('page-has-heading-one')
    await page.getByTestId('tab-timeline').click()
    await expect(page.getByTestId('header')).toBeVisible()
    await expect(page.getByTestId('strip-day')).toHaveCount(7)
  })
})
