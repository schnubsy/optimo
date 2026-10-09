// Arc 2 slice 3 — floating chrome: header fade, pill tab bar + FAB on iPhone, segmented control on desktop,
// glyphs + keyword auto-suggest in quick-add and the editor.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { CAT, at, openApp, quickAdd, row, seedDay, seedTask } from './support/app'

const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))

test.describe('iPhone chrome', () => {
  test.beforeEach(({ browserName: _b }, info) => test.skip(info.project.name !== 'iphone-15', 'iPhone chrome'))

  test('tab bar and FAB float (fixed), do not overlap, keep ≥ 44px targets; header has no border', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    const bar = page.getByTestId('tabbar')
    const fab = page.getByTestId('fab')
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
    expect(await fab.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
    const b = (await bar.boundingBox())!
    const f = (await fab.boundingBox())!
    expect(b.x + b.width).toBeLessThanOrEqual(f.x) // side by side, no overlap
    expect(f.width).toBeGreaterThanOrEqual(56)
    for (const t of await bar.getByRole('tab').all()) {
      const box = (await t.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    await expect(bar.getByRole('tab')).toHaveCount(5) // Inbox · Timeline · Week · Plan · Settings (arc 3 shows the reserved Plan column)
    const hdr = page.getByTestId('header')
    expect(await hdr.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('0px')
    expect(await hdr.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
  })

  test('the last hour of the day is reachable beneath the bar', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { seed: (s) => (id = seedTask(s, { title: 'Wind down', start_at: at('22:00'), duration_min: 60, category_id: CAT.home }).id) })
    await page.getByTestId('timeline').evaluate((el) => (el.scrollTop = el.scrollHeight))
    const pill = page.locator(`[data-testid="block"][data-id="${id}"]`)
    await expect(pill).toBeVisible()
    const p = (await pill.boundingBox())!
    const b = (await page.getByTestId('tabbar').boundingBox())!
    expect(p.y + p.height).toBeLessThanOrEqual(b.y) // not covered by the floating bar
  })

  test('the timeline scrolls beneath the header and the bar (full-height scroller)', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    const tl = (await page.getByTestId('timeline').boundingBox())!
    const vp = page.viewportSize()!
    expect(tl.y).toBeLessThanOrEqual(1)
    expect(tl.y + tl.height).toBeGreaterThanOrEqual(vp.height - 1)
  })

  test('FAB opens quick-add with focus in the field; adding closes it', async ({ page, context }) => {
    await openApp(page, context)
    await page.getByTestId('fab').click()
    await expect(page.getByTestId('quickadd-sheet')).toBeVisible()
    await expect(page.getByTestId('quickadd')).toBeFocused()
    await page.getByTestId('quickadd').fill('Dentist at 4pm')
    await expect(page.getByTestId('parse-icon')).toHaveAttribute('data-icon', 'health-pill')
    await page.getByTestId('quickadd').press('Enter')
    await expect(page.getByTestId('quickadd-sheet')).toHaveCount(0)
    await expect(page.locator('[data-testid="block"]', { hasText: 'Dentist' })).toBeVisible()
  })

  test('tabs switch views, and arrow keys move between tabs', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await page.getByTestId('tab-week').click()
    await expect(page.getByTestId('week-col').first()).toBeVisible()
    await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('inbox')).toBeVisible()
    await page.getByTestId('tab-settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByTestId('tab-settings').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('tab-plan')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('plan')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('tab-week')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('tab-week')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('timeline')).toBeVisible()
  })

  test('increased contrast / reduced transparency → an opaque bar, no blur', async ({ page, context }) => {
    await page.emulateMedia({ contrast: 'more' })
    await openApp(page, context)
    const bar = page.getByTestId('tabbar')
    expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none')
    expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/\/ 0\.8|, 0\.8\)/)
  })

  test('date strip picks a day; the title opens the month', async ({ page, context }) => {
    await openApp(page, context)
    const days = page.getByTestId('header').locator('.hdr-day')
    await expect(days).toHaveCount(7)
    const other = days.filter({ hasNot: page.locator('[aria-pressed="true"]') }).first()
    await days.nth(0).click()
    await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: /open month/ }).click()
    await expect(page.getByTestId('month-day').first()).toBeVisible()
    void other
  })

  for (const theme of ['light', 'dark'] as const)
    test(`axe clean with the floating chrome (${theme})`, async ({ page, context }) => {
      await openApp(page, context, { seed: seedDay, theme })
      expect(await serious(page)).toEqual([])
      await page.getByTestId('fab').click()
      expect(await serious(page)).toEqual([])
    })

  for (const theme of ['light', 'dark'] as const)
    test(`evidence: iPhone chrome (${theme})`, async ({ page, context }) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      await openApp(page, context, { seed: seedDay, theme })
      await page.getByTestId('timeline').evaluate((el) => (el.scrollTop = 10 * 66))
      await page.screenshot({ path: `docs/evidence/arc2-slice-3-iphone-day-${theme}.png` })
      await page.getByTestId('fab').click()
      await (await quickAdd(page)).fill('Gym every weekday at 7am')
      await page.screenshot({ path: `docs/evidence/arc2-slice-3-iphone-quickadd-${theme}.png` })
    })
})

test.describe('desktop chrome', () => {
  test.beforeEach(({ browserName: _b }, info) => test.skip(info.project.name !== 'desktop', 'desktop chrome'))

  test('the segmented pill switches views, with ← → cycling', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    const seg = page.getByTestId('segmented')
    await seg.getByRole('tab', { name: 'Week' }).click()
    await expect(page.getByTestId('week-col')).toHaveCount(7)
    await seg.getByRole('tab', { name: 'Week' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(seg.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('month-day').first()).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('timeline')).toBeVisible()
    await expect(page.getByTestId('tabbar')).toHaveCount(0)
    await expect(page.getByTestId('fab')).toHaveCount(0)
  })

  test('quick-add previews the suggested glyph; choosing another is remembered for that title', async ({ page, context }) => {
    await openApp(page, context)
    const qa = await quickAdd(page)
    await qa.fill('Guitar practice at 7pm')
    await expect(page.getByTestId('parse-icon')).toHaveAttribute('data-icon', 'creative-music')
    await page.getByTestId('parse-icon').click()
    await page.getByTestId('glyph-picker').getByRole('button', { name: 'rest-sofa' }).click()
    await expect(page.getByTestId('parse-icon')).toHaveAttribute('data-icon', 'rest-sofa')
    await qa.press('Enter')
    const pill = page.locator('[data-testid="block"]', { hasText: 'Guitar practice' })
    await pill.scrollIntoViewIfNeeded()
    await expect(pill.getByTestId('chip').locator('svg')).toHaveAttribute('data-icon', 'rest-sofa')
    expect(await page.evaluate(async () => (await (window as any).__optimo.db.settings.get('me')).data.iconOverrides)).toEqual({ 'guitar practice': 'rest-sofa' })
  })

  test('quick-add without #category takes the suggested one', async ({ page, context }) => {
    await openApp(page, context)
    const qa = await quickAdd(page)
    await qa.fill('Gym at 6pm')
    await expect(page.getByTestId('parse-category')).toHaveText('Health')
    await qa.press('Enter')
    const t = page.locator('[data-testid="block"]', { hasText: 'Gym' })
    await t.scrollIntoViewIfNeeded()
    expect((await row(page, (await t.getAttribute('data-id'))!)).category_id).toBe(CAT.health)
  })

  test('editor icon picker searches names + keywords and sets the pill glyph', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
    await page.getByTestId('sheet-icon').click()
    await page.getByTestId('glyph-picker').getByRole('searchbox').fill('passport')
    await expect(page.getByTestId('glyph-picker').getByRole('button')).toHaveCount(0)
    await page.getByTestId('glyph-picker').getByRole('searchbox').fill('flight')
    await page.getByTestId('glyph-picker').getByRole('button', { name: 'travel-plane' }).click()
    await page.keyboard.press('Escape')
    const pill = page.locator(`[data-testid="block"][data-id="${ids!.plan}"]`)
    await pill.scrollIntoViewIfNeeded()
    await expect(pill.getByTestId('chip').locator('svg')).toHaveAttribute('data-icon', 'travel-plane')
  })

  test('evidence: icon sheet', async ({ page, context }) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    await openApp(page, context)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'icons' }))
    await page.screenshot({ path: 'docs/evidence/arc2-slice-3-icon-sheet-desktop.png', fullPage: true })
  })
})

// Arc 6 slice 2 — header + date strip (mockups 01 / 08 / 10): title grammar, accent disc, mini-chips, no stats line.
test.describe('arc 6 header', () => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const settle = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
  /** A token as the browser resolves it, in the header's own cascade. */
  const resolved = (page: Page, prop: 'color' | 'backgroundColor', token: string) =>
    page.getByTestId('header').evaluate(
      (h, [p, t]) => {
        const probe = document.createElement('span')
        probe.style[p as 'color'] = `var(${t})`
        h.appendChild(probe)
        const c = getComputedStyle(probe)[p as 'color']
        probe.remove()
        return c
      },
      [prop, token],
    )
  const accent = (page: Page) => resolved(page, 'color', '--accent')
  const oneTask = (s: Parameters<typeof seedTask>[0]) => {
    seedTask(s, { title: 'Watch a movie', start_at: at('20:00'), duration_min: 90, category_id: CAT.personal })
  }

  test('title reads "Month D, YYYY" with the year in the accent; no stats line', async ({ page, context }, info) => {
    await openApp(page, context, { at: '09:00', seed: oneTask })
    const today = await page.evaluate(() => {
      const d = new Date()
      return [d.getMonth(), d.getDate(), d.getFullYear()]
    })
    const mobile = info.project.name === 'iphone-15'
    const title = page.getByTestId('hdr-title')
    await expect(title).toHaveText(`${MONTHS[today[0]]} ${today[1]}, ${today[2]}${mobile ? ' ›' : ''}`)
    const year = page.getByTestId('hdr-year')
    await expect(year).toHaveText(`${today[2]}${mobile ? ' ›' : ''}`)
    expect(await year.evaluate((e) => getComputedStyle(e).color)).toBe(await accent(page))
    expect(await title.locator('.hdr-md').evaluate((e) => getComputedStyle(e).color)).toBe(await resolved(page, 'color', '--ink'))
    await expect(page.locator('.hdr-stats')).toHaveCount(0)
    for (const id of ['stat-planned', 'stat-free', 'stat-done', 'stat-unplaced']) await expect(page.getByTestId(id)).toHaveCount(0)
  })

  test.describe('iPhone strip', () => {
    test.beforeEach(({ browserName: _b }, info) => test.skip(info.project.name !== 'iphone-15', 'mobile strip'))

    test('the selected day sits on a 32px accent disc', async ({ page, context }) => {
      await openApp(page, context, { at: '09:00' })
      await settle(page)
      const sel = page.locator('[data-testid="strip-day"][aria-pressed="true"]')
      await expect(sel).toHaveCount(1)
      const [bg, w, h, ink] = await sel.locator('b').evaluate((e) => {
        const cs = getComputedStyle(e)
        const r = e.getBoundingClientRect()
        return [cs.backgroundColor, r.width, r.height, cs.color] as const
      })
      expect(bg).toBe(await accent(page))
      expect(Math.abs(w - 32)).toBeLessThanOrEqual(1)
      expect(Math.abs(h - 32)).toBeLessThanOrEqual(1)
      expect(ink).toBe(await resolved(page, 'color', '--ink-on-accent'))
      // the other days have no disc
      const other = page.locator('[data-testid="strip-day"][aria-pressed="false"] b').first()
      expect(await other.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    })

    test('a day with one timed task shows 3 mini-chips: wake bookend, the task, lights-out bookend', async ({ page, context }) => {
      await openApp(page, context, { at: '09:00', seed: oneTask })
      const day = page.locator('[data-testid="strip-day"][aria-pressed="true"]')
      const chips = day.getByTestId('mini-chip')
      await expect(chips).toHaveCount(3)
      await expect(chips.first()).toHaveAttribute('data-icon', 'rest-alarm')
      await expect(chips.last()).toHaveAttribute('data-icon', 'rest-moon')
      await expect(chips.first()).toHaveClass(/cat-accent/)
      await expect(chips.nth(1)).toHaveClass(/cat-personal/)
      await expect(chips.last()).toHaveClass(/cat-errand/)
      const a = (await chips.nth(0).boundingBox())!
      const b = (await chips.nth(1).boundingBox())!
      expect(Math.abs(b.width - 12)).toBeLessThanOrEqual(0.5)
      expect(Math.round(b.x - (a.x + a.width))).toBe(-3) // −3px overlap
      // the glyph takes the category glyph colour on a --node disc
      expect(await chips.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(await resolved(page, 'backgroundColor', '--node'))
      // a quiet day keeps just the bookends
      await expect(page.locator('[data-testid="strip-day"][aria-pressed="false"]').first().getByTestId('mini-chip')).toHaveCount(2)
    })

    test('a busy day caps the chips at 4 then +n', async ({ page, context }) => {
      await openApp(page, context, { at: '09:00', seed: seedDay })
      const day = page.locator('[data-testid="strip-day"][aria-pressed="true"]')
      await expect(day.getByTestId('mini-chip')).toHaveCount(4)
      // seedDay = 10 timed tasks + 2 bookends → 4 shown, 8 more
      await expect(day.getByTestId('mini-more')).toHaveText('+8')
    })

    test('header is 131px tall at 402px wide, on the canvas, borderless; title on the 24px pad', async ({ page, context }) => {
      await page.setViewportSize({ width: 402, height: 874 })
      await openApp(page, context, { at: '09:00', seed: oneTask })
      await settle(page)
      const hdr = page.getByTestId('header')
      const box = (await hdr.boundingBox())!
      expect(Math.abs(box.height - 131)).toBeLessThanOrEqual(1)
      expect(await hdr.evaluate((h) => getComputedStyle(h).backgroundColor)).toBe(await resolved(page, 'backgroundColor', '--canvas'))
      expect(await hdr.evaluate((h) => getComputedStyle(h).borderBottomWidth)).toBe('0px')
      const t = (await page.getByTestId('hdr-title').boundingBox())!
      expect(Math.abs(t.x - 24)).toBeLessThanOrEqual(1)
      // the sync state is a 12px dot at the header's right edge
      const sb = (await hdr.getByTestId('sync-badge').boundingBox())!
      expect(Math.abs(sb.width - 12)).toBeLessThanOrEqual(0.5)
      expect(402 - (sb.x + sb.width)).toBeLessThanOrEqual(17)
    })

    test('evidence: arc 6 header (dark, 402×874)', async ({ page, context }) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      await page.setViewportSize({ width: 402, height: 874 })
      await openApp(page, context, {
        at: '09:00',
        theme: 'dark',
        seed: (s) => {
          seedTask(s, { title: 'Watch a movie', start_at: at('20:00'), duration_min: 90, category_id: CAT.personal })
          seedTask(s, { title: 'Morning run', start_at: at('07:00', -1), duration_min: 45, category_id: CAT.health })
          seedTask(s, { title: 'Groceries', start_at: at('17:00', 1), duration_min: 60, category_id: CAT.errand })
        },
      })
      await settle(page)
      await page.screenshot({ path: 'docs/evidence/arc6-slice-2-header.png' })
    })
  })
})
