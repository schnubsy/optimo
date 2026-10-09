// Arc 2 slice 3 — floating chrome: header fade, pill tab bar + FAB on iPhone, segmented control on desktop,
// glyphs + keyword auto-suggest in quick-add and the editor.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { CAT, at, commitWizard, openApp, quickAdd, row, seedDay, seedTask } from './support/app'

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
    await expect(bar.getByRole('tab')).toHaveCount(4) // arc 6: Inbox · Timeline · AI · Settings
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

  test('FAB opens the create wizard with focus in the title; creating closes it', async ({ page, context }) => {
    await openApp(page, context)
    await page.getByTestId('fab').click()
    await expect(page.getByTestId('wizard')).toBeVisible()
    await expect(page.getByTestId('wizard-title')).toBeFocused()
    await page.getByTestId('wizard-title').fill('Dentist at 4pm')
    await expect(page.getByTestId('wizard-glyph')).toHaveAttribute('data-icon', 'health-pill')
    await commitWizard(page)
    await expect(page.getByTestId('wizard')).toHaveCount(0)
    await expect(page.locator('[data-testid="block"]', { hasText: 'Dentist' })).toBeVisible()
  })

  test('tabs switch views, and arrow keys move between tabs', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('inbox')).toBeVisible()
    await page.getByTestId('tab-settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByTestId('tab-settings').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('tab-plan')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('plan')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('tab-timeline')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('tab-timeline')).toBeFocused()
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
    for (const id of ['stat-planned', 'stat-free', 'stat-done', 'stat-unplaced']) await expect(page.getByTestId('header').getByTestId(id)).toHaveCount(0) // the inbox rail owns "in inbox" now (slice 5)
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

// arc 6 slice 5 — the 4-tab floating bar, the 58px FAB and the inbox screen (mockups 01 · 07, 2026-10-09).
test.describe('arc 6 tab bar', () => {
  const iphone = (info: { project: { name: string } }) => test.skip(info.project.name !== 'iphone-15', 'iPhone chrome')
  /** resolve a colour token to the computed string the browser paints for it */
  const token = (page: Page, v: string) =>
    page.evaluate((name) => {
      const p = document.createElement('i')
      p.style.backgroundColor = `var(${name})`
      document.body.append(p)
      const c = getComputedStyle(p).backgroundColor
      p.remove()
      return c
    }, v)
  const css = (page: Page, testid: string, prop: 'color' | 'backgroundColor', sel?: string) => {
    const l = page.getByTestId(testid)
    return (sel ? l.locator(sel) : l).evaluate((el, p) => getComputedStyle(el)[p], prop)
  }
  const wizard = (page: Page) => page.evaluate(() => (window as any).__optimo.ui.getState().wizard as { mode: string } | null)

  test('exactly four tabs — Inbox · Timeline · AI · Settings — with filled glyphs', async ({ page, context }, info) => {
    iphone(info)
    await openApp(page, context, { theme: 'dark' })
    const tabs = page.getByTestId('tabbar').getByRole('tab')
    await expect(tabs).toHaveCount(4)
    expect((await tabs.allTextContents()).map((t) => t.trim())).toEqual(['Inbox', 'Timeline', 'AI', 'Settings'])
    await expect(page.getByTestId('tab-plan').locator('svg')).toHaveAttribute('data-icon', 'ui-ai')
    for (const svg of await tabs.locator('svg').all()) expect(await svg.getAttribute('fill')).toBe('currentColor')
    await expect(page.getByTestId('tab-week')).toHaveCount(0)
  })

  test('the active tab sits on the --tab-active pill with an accent label', async ({ page, context }, info) => {
    iphone(info)
    await openApp(page, context, { theme: 'dark' })
    const active = page.getByTestId('tab-timeline')
    await expect(active).toHaveAttribute('aria-selected', 'true')
    const box = (await page.getByTestId('tab-active-pill').boundingBox())!
    expect(Math.abs(box.width - 76)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - 52)).toBeLessThanOrEqual(1)
    expect(await css(page, 'tab-active-pill', 'backgroundColor')).toBe(await token(page, '--tab-active'))
    expect(await css(page, 'tab-timeline', 'color', '.tab-l')).toBe(await token(page, '--accent'))
    // an inactive tab has no pill and reads in --ink
    expect(await css(page, 'tab-settings', 'backgroundColor', '.tab-pill')).toBe('rgba(0, 0, 0, 0)')
    expect(await css(page, 'tab-settings', 'color', '.tab-l')).toBe(await token(page, '--ink'))
  })

  test('geometry: 60px bar 16px from the left, 58px FAB 16px from the right on the same centre line', async ({ page, context }, info) => {
    iphone(info)
    await openApp(page, context)
    const vp = page.viewportSize()!
    const b = (await page.getByTestId('tabbar').boundingBox())!
    const f = (await page.getByTestId('fab').boundingBox())!
    expect(Math.abs(b.height - 60)).toBeLessThanOrEqual(1)
    expect(Math.abs(b.x - 16)).toBeLessThanOrEqual(1)
    expect(Math.abs(f.width - 58)).toBeLessThanOrEqual(1)
    expect(Math.abs(f.height - 58)).toBeLessThanOrEqual(1)
    expect(Math.abs(vp.width - (f.x + f.width) - 16)).toBeLessThanOrEqual(1)
    expect(Math.abs(b.y + b.height / 2 - (f.y + f.height / 2))).toBeLessThanOrEqual(1)
    expect(b.x + b.width).toBeLessThan(f.x) // side by side, never overlapping
  })

  test('the FAB opens the new-task wizard (timeline mode), not the quick-add sheet', async ({ page, context }, info) => {
    iphone(info)
    await openApp(page, context)
    await page.getByTestId('fab').click()
    await expect.poll(() => wizard(page)).toMatchObject({ mode: 'timeline' })
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('quickadd-sheet')).toHaveCount(0)
  })

  test('inbox empty state: title, tray and the New Inbox Task pill → wizard in inbox mode', async ({ page, context }, info) => {
    iphone(info)
    await openApp(page, context, { theme: 'dark' })
    await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('tab-backlog')).toHaveAttribute('aria-selected', 'true')
    const h = page.getByRole('heading', { name: 'Inbox' })
    await expect(h).toBeVisible()
    expect(await h.evaluate((el) => getComputedStyle(el).fontSize)).toBe('30px')
    await expect(page.getByTestId('inbox-empty')).toBeVisible()
    const pill = page.getByTestId('new-inbox-task')
    await expect(pill).toHaveText('New Inbox Task')
    expect(Math.abs((await pill.boundingBox())!.height - 56)).toBeLessThanOrEqual(1)
    expect(await css(page, 'new-inbox-task', 'backgroundColor')).toBe(await token(page, '--accent-tint'))
    const tray = (await page.getByTestId('inbox-empty').locator('.inbox-tray svg').boundingBox())!
    expect(Math.abs(tray.width - 110)).toBeLessThanOrEqual(1)
    const vh = page.viewportSize()!.height
    expect(Math.abs(tray.y + tray.height / 2 - vh * 0.42)).toBeLessThanOrEqual(vh * 0.03)
    await pill.click()
    await expect.poll(() => wizard(page)).toMatchObject({ mode: 'inbox' })
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('inbox rows: node disc, ring completes the task, disc opens the editor; Place stays', async ({ page, context }, info) => {
    iphone(info)
    let id = ''
    await openApp(page, context, { seed: (s) => (id = seedTask(s, { title: 'Renew passport', start_at: null, duration_min: 45, category_id: CAT.errand }).id) })
    await page.getByTestId('tab-backlog').click()
    const r = page.locator(`[data-testid="inbox-row"][data-id="${id}"]`)
    await expect(r).toContainText('45 min · Errands')
    const disc = (await r.locator('.irow-chip').boundingBox())!
    expect(Math.abs(disc.width - 56)).toBeLessThanOrEqual(1)
    await expect(r.getByTestId('place')).toBeVisible()
    await expect(page.getByTestId('inbox-empty')).toHaveCount(0)
    await r.locator('.irow-chip').click()
    await expect.poll(() => page.evaluate(() => (window as any).__optimo.ui.getState().editingId)).toBe(id)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ editingId: null }))
    await r.getByTestId('inbox-ring').click()
    await expect.poll(async () => (await row(page, id)).completed_at).not.toBeNull()
    await expect(r).toHaveClass(/\bdone\b/)
    await expect(r.getByTestId('inbox-ring')).toHaveAttribute('aria-pressed', 'true')
  })

  for (const theme of ['dark', 'light'] as const)
    test(`axe clean on the inbox screen, empty and with rows (${theme})`, async ({ page, context }, info) => {
      iphone(info)
      await openApp(page, context, { theme })
      await page.getByTestId('tab-backlog').click()
      await expect(page.getByTestId('inbox-empty')).toBeVisible()
      expect(await serious(page)).toEqual([])
      await page.evaluate(() => (window as any).__optimo.repo.createTask({ title: 'Book flights', duration_min: 30, start_at: null }))
      await expect(page.getByTestId('inbox-row')).toHaveCount(1)
      expect(await serious(page)).toEqual([])
    })

  test('desktop: the inbox rail header carries the "in inbox" count', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop rail')
    await openApp(page, context, { seed: seedDay })
    await expect(page.getByTestId('inbox').getByTestId('stat-unplaced')).toHaveText('4')
    await expect(page.getByTestId('inbox').locator('.hd')).toContainText('4 in inbox')
  })

  test('evidence: tab bar + inbox empty state (iPhone 15, dark)', async ({ page, context }, info) => {
    iphone(info)
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context, { theme: 'dark' })
    await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('inbox-empty')).toBeVisible()
    await page.waitForFunction(() => document.getAnimations().length === 0)
    await page.screenshot({ path: 'docs/evidence/arc6-slice-5-tabbar-inbox.png' })
  })
})
