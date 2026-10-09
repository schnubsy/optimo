// snag train 2026-10 — Issues #15-#27 (label `snag`), raised by the arc-2 slice-7 Eye LITE critique
// (docs/evidence/arc2-slice-7-design-critique.md). One behavioural case per slice; evidence captures are
// gated on EVIDENCE=1 (same convention as design2.spec.ts).
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { CAT, at, openApp, quickAdd, seedDay, seedTask } from './support/app'
import { ACTIVITY, CHROME } from '../src/icons/set'
import { FAKE_PASSWORD, FAKE_USER } from './fake/caldav'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)

test.describe('snag train 2026-10', () => {
  // === slice 1 (Fixes #15) — now-pill hides the hour numeral ===
  test('#15 the now-pill never leaves the hour numeral peeking out', async ({ page, context }) => {
    const now = new Date()
    now.setHours(15, 6, 0, 0) // 6 min past the hour: inside the 12-min mask window
    await page.clock.install({ time: now })
    await openApp(page, context, {
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const masked = page.locator('[data-testid="hour-label"][data-hour="15"]')
    const clear = page.locator('[data-testid="hour-label"][data-hour="13"]')
    await masked.scrollIntoViewIfNeeded()
    await expect(page.getByTestId('now-line')).toBeVisible()
    expect(await masked.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
    expect(await clear.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  })

  test('#15 evidence: day view with the now-pill masking the hour', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const now = new Date()
    now.setHours(15, 4, 0, 0)
    await page.clock.install({ time: now })
    await openApp(page, context, {
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const px = (await isMobile(page)) ? 66 : 72
    await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y), 14 * px)
    await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-1-day-${info.project.name}.png` })
  })

  // === slice 2 (Fixes #16) — Week/Timeline tab glyphs redrawn so they no longer misread ===
  test('#16 ui-week and ui-timeline glyphs are redrawn and distinct from each other', () => {
    expect(CHROME['ui-week']).not.toContain('rx="1.5"/><rect x="9.75"') // the old three-loose-capsules shape
    expect(CHROME['ui-timeline']).not.toContain('M5.5 4h13A2.5') // the old note/message-card shape
    expect(CHROME['ui-week']).not.toBe(CHROME['ui-timeline'])
  })

  test('#16 evidence: Day view tab bar shows the redrawn Week and Timeline glyphs', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    test.skip(info.project.name !== 'iphone-15', 'floating tab bar is mobile-only')
    await openApp(page, context)
    await page.locator('.tabbar').screenshot({ path: `docs/evidence/snag-train-2026-10-slice-2-tabbar-${info.project.name}.png` })
  })

  // === slice 3 (Fixes #17) — activity glyphs illegible at 13px ===
  test('#17 food-plate, care-mirror, meeting-handshake, family-heart-people are redrawn', () => {
    expect(ACTIVITY['food-plate']).not.toContain('rect x="1.8" y="4"') // the old plain bars ("IOI")
    expect(ACTIVITY['care-mirror']).not.toContain('a3.5 3.5 0 0 0-1 2.5') // the old lollipop stick
    expect(ACTIVITY['meeting-handshake']).toContain('fill-rule="evenodd"') // keeps one counter-cut
    expect(ACTIVITY['family-heart-people']).not.toMatch(/circle cx="17" cy="5.5"/) // the old small heart head is gone
    // care-mirror must stay visually distinct from errand-pin (both read as "circle on a stem" otherwise)
    expect(ACTIVITY['care-mirror']).not.toBe(ACTIVITY['errand-pin'])
  })

  // === slice 4 (Fixes #18) — calendar events get their own glyph + a ring that is never a category hue ===
  test('#18 iCloud events use the ui-calendar glyph with the calendar\'s own ring colour', async ({ page, context }) => {
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('settings')
    const form = page.getByTestId('calendar-connect')
    await form.getByLabel('Apple ID').fill(FAKE_USER)
    await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
    await form.getByRole('button', { name: 'Connect iCloud' }).click()
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await setView('day')
    const ev = page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist check-up' })
    await ev.scrollIntoViewIfNeeded()
    const chip = ev.locator('.evt-chip')
    await expect(chip.locator('svg')).toHaveAttribute('data-icon', 'ui-calendar')
    // the fake CalDAV server's "Home" calendar is #5B8DEF — the chip ring must read that colour, not a category hue
    expect(await chip.evaluate((el) => getComputedStyle(el).boxShadow)).toContain('91, 141, 239')
  })

  test('#18 evidence: Day view timeline with an iCloud event (desktop + iPhone-15)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('settings')
    const form = page.getByTestId('calendar-connect')
    await form.getByLabel('Apple ID').fill(FAKE_USER)
    await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
    await form.getByRole('button', { name: 'Connect iCloud' }).click()
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await setView('day')
    const ev = page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist check-up' })
    await ev.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-4-timeline-${info.project.name}.png` })
  })

  // === slice 5 (Fixes #19) — event details on iPhone are a read-only bottom sheet ===
  test('#19 event details: bottom sheet on iPhone (scrim + Esc close it), popover stays on desktop', async ({ page, context }, info) => {
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('settings')
    const form = page.getByTestId('calendar-connect')
    await form.getByLabel('Apple ID').fill(FAKE_USER)
    await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
    await form.getByRole('button', { name: 'Connect iCloud' }).click()
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await setView('day')
    const ev = page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist check-up' })
    await ev.scrollIntoViewIfNeeded()
    await ev.getByRole('button', { name: /Dentist check-up/ }).click()
    const details = page.getByTestId('event-details')
    await expect(details).toBeVisible()
    if (info.project.name === 'iphone-15') {
      await expect(details).toHaveClass(/evt-sheet/)
      await expect(page.locator('.sheet-wrap .grabber')).toBeVisible()
      // Esc closes it
      await page.keyboard.press('Escape')
      await expect(details).toHaveCount(0)
      await ev.getByRole('button', { name: /Dentist check-up/ }).click()
      await expect(page.getByTestId('event-details')).toBeVisible()
      // scrim-tap closes it
      await page.locator('.sheet-wrap').click({ position: { x: 5, y: 5 } })
      await expect(page.getByTestId('event-details')).toHaveCount(0)
    } else {
      await expect(details).toHaveClass(/evt-pop/)
      await expect(page.locator('.sheet-wrap')).toHaveCount(0)
    }
  })

  test('#19 evidence: event details sheet on iPhone-15', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    test.skip(info.project.name !== 'iphone-15', 'the bottom sheet is mobile-only')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('settings')
    const form = page.getByTestId('calendar-connect')
    await form.getByLabel('Apple ID').fill(FAKE_USER)
    await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
    await form.getByRole('button', { name: 'Connect iCloud' }).click()
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await setView('day')
    const ev = page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist check-up' })
    await ev.scrollIntoViewIfNeeded()
    await ev.getByRole('button', { name: /Dentist check-up/ }).click()
    await expect(page.getByTestId('event-details')).toBeVisible()
    await page.screenshot({ path: 'docs/evidence/snag-train-2026-10-slice-5-event-sheet-iphone-15.png' })
  })

  // === slice 6 (Fixes #20) — settings group labels fully inside the card on iPhone ===
  test('#20 settings group labels sit fully inside their card, not straddling the top edge', async ({ page, context }) => {
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context)
    await setView('settings')
    for (const testid of ['set-theme', 'set-snap', 'set-push', 'set-week', 'set-clock']) {
      const card = page.getByTestId(testid)
      const label = card.locator('h3')
      const cardBox = (await card.boundingBox())!
      const labelBox = (await label.boundingBox())!
      expect(labelBox.y).toBeGreaterThanOrEqual(cardBox.y - 1)
    }
    // Organise / Data fieldsets use the same h3 + aria-labelledby pattern
    const organise = page.getByRole('group', { name: 'Organise' })
    await expect(organise).toBeVisible()
    const data = page.getByRole('group', { name: 'Data' })
    await expect(data).toBeVisible()
  })

  test('#20 evidence: Settings on iPhone-15', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context)
    await setView('settings')
    await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-6-settings-${info.project.name}.png`, fullPage: true })
  })

  // === slice 7 (Fixes #21) — the settings scroller clears the floating tab bar ===
  test('#21 the build-number row scrolls fully clear of the floating tab bar on iPhone', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the floating tab bar is mobile-only')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context)
    await setView('settings')
    expect(await page.locator('.page.settings').evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto')
    const build = page.locator('.settings .build')
    await build.scrollIntoViewIfNeeded()
    const buildBox = (await build.boundingBox())!
    const barBox = (await page.locator('.tabbar').boundingBox())!
    expect(buildBox.y + buildBox.height).toBeLessThanOrEqual(barBox.y)
  })

  test('#21 evidence: settings scrolled to the build row, clear of the tab bar (iPhone-15)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    test.skip(info.project.name !== 'iphone-15', 'the floating tab bar is mobile-only')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context)
    await setView('settings')
    await page.locator('.settings .build').scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/evidence/snag-train-2026-10-slice-7-settings-bottom-iphone-15.png' })
  })

  // === slice 8 (Fixes #22) — Week view edges: no sliver on iPhone, no flush-right on desktop ===
  test('#22 Week: mobile 3-day columns exactly fill the space the sticky rail leaves (no sliver)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the 3-day mobile week is mobile-only')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('week')
    const railWidth = (await page.locator('.week.m .wrail').boundingBox())!.width
    const colWidth = (await page.locator('.week.m .wcol').first().boundingBox())!.width
    const viewport = page.viewportSize()!.width
    // the rail + 3 columns must account for the full viewport — within 1px of rounding, so there is no
    // unfilled sliver of a 4th day left over after a snap scroll (the old 42px constant left ~10px spare)
    expect(Math.abs(railWidth + 3 * colWidth - viewport)).toBeLessThan(1)
  })

  test('#22 Week: desktop Sun column stays clear of the window edge', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop-only layout')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('week')
    expect(await page.locator('.wbody').evaluate((el) => getComputedStyle(el).paddingRight)).not.toBe('0px')
  })

  test('#22 evidence: Week view edges, desktop + iPhone-15', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('week')
    await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-8-week-${info.project.name}.png` })
  })

  // === slice 9 (Fixes #23) — quick-add glyph chip meets the 44px hit target on iPhone ===
  test('#23 the quick-add glyph chip is at least 44x44 inside the mobile sheet', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the FAB bottom sheet is mobile-only')
    await openApp(page, context)
    const field = await quickAdd(page)
    await field.fill('Lunch with Sam at 1pm')
    const chip = page.getByTestId('parse-icon')
    await expect(chip).toBeVisible()
    const box = (await chip.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  })

  test('#23 evidence: quick-add sheet with the 44px glyph chip (iPhone-15)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    test.skip(info.project.name !== 'iphone-15', 'the FAB bottom sheet is mobile-only')
    await openApp(page, context)
    await (await quickAdd(page)).fill('Lunch with Sam at 1pm')
    await expect(page.getByTestId('parse-icon')).toBeVisible()
    await page.screenshot({ path: 'docs/evidence/snag-train-2026-10-slice-9-quickadd-iphone-15.png' })
  })

  // === slice 10 (Fixes #24) — evidence gap: post-chrome captures ===
  // A2-P1-10 noted there were no post-slice-3 iPhone captures of Week / Inbox / Month / the editor, and no
  // desktop dark Day capture. This slice extends the capture list, shot against the current (post-slice-9) build.
  for (const theme of ['light', 'dark'] as const)
    test(`#24 evidence (${theme}): week / inbox / month / editor on iPhone-15`, async ({ page, context }, info) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      test.skip(info.project.name !== 'iphone-15', 'post-chrome mobile captures')
      const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
      let ids: ReturnType<typeof seedDay>['ids']
      await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), theme })
      await setView('week')
      await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-10-week-iphone-15-${theme}.png` })
      await page.evaluate(() => (window as any).__optimo.ui.getState().set({ mobileTab: 'backlog' }))
      await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-10-inbox-iphone-15-${theme}.png` })
      await page.evaluate(() => (window as any).__optimo.ui.getState().set({ mobileTab: 'board' }))
      await setView('month')
      // #31: capture only after the month live query has painted today's category dots
      await expect(page.locator('.mday.today .dots i').first()).toBeVisible()
      await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-10-month-iphone-15-${theme}.png` })
      await setView('day')
      await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.locator('[data-testid="sheet-category"] button').first()).toBeVisible()
      await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-10-editor-iphone-15-${theme}.png` })
    })

  test('#24 evidence: Day view, desktop dark', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    test.skip(info.project.name !== 'desktop', 'desktop dark capture')
    await openApp(page, context, { seed: seedDay, theme: 'dark' })
    await page.screenshot({ path: 'docs/evidence/snag-train-2026-10-slice-10-day-desktop-dark.png' })
  })

  // === slice 11 (Fixes #25) — launcher card: rounded type + a working dark variant ===
  async function wing(context: BrowserContext) {
    await context.route(/\/optimo\/spaces\.json$/, (r) => r.fulfill({ json: { v: 2, personal: [], family: ['optimo.html'] } }))
    await context.route(/https:\/\/eepjhpyziczrxvirczio\.supabase\.co\//, (r) => {
      const u = new URL(r.request().url())
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
      if (u.pathname === '/rest/v1/press_access_apps') return r.fulfill({ headers: cors, json: [{ page: 'optimo.html', gated: true }] })
      if (u.pathname === '/rest/v1/rpc/press_access_has') return r.fulfill({ headers: cors, json: true })
      if (u.pathname === '/rest/v1/rpc/press_access_touch') return r.fulfill({ status: 204, headers: cors })
      return r.fulfill({ status: 404, headers: cors, json: {} })
    })
    await context.addInitScript((s) => localStorage.setItem('press:family:v1', JSON.stringify(s)), {
      access_token: 'fake.jwt.token',
      refresh_token: 'fake-refresh',
      expires_at: Date.now() + 3600_000,
      email: 'mark@family.example',
      name: 'Mark',
    })
  }

  test('#25 the launcher card heading uses the rounded voice, not the heavy system face', async ({ page, context }) => {
    await wing(context)
    await page.goto('./optimo.html')
    const h1 = page.getByTestId('optimo-card').getByRole('heading')
    await expect(h1).toBeVisible()
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/ui-rounded/)
  })

  test('#25 the launcher card has a working dark variant', async ({ page, context }) => {
    await wing(context)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./optimo.html')
    const card = page.getByTestId('optimo-card')
    await expect(card).toBeVisible()
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await expect(card).toBeVisible()
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bg).not.toBe(lightBg)
  })

  for (const theme of ['light', 'dark'] as const)
    test(`#25 evidence (${theme}): launcher card`, async ({ page, context }, info) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      await wing(context)
      await page.emulateMedia({ colorScheme: theme })
      await page.goto('./optimo.html')
      await expect(page.getByTestId('optimo-card')).toBeVisible()
      await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-11-launcher-card-${info.project.name}-${theme}.png` })
    })

  // === slice 12 (Fixes #26) — brand mark: off the red-squircle/toggle register ===
  test('#26 evidence: the regenerated brand mark + PWA icons', async ({ page }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    test.skip(info.project.name !== 'desktop', 'one static capture is enough')
    const { readFileSync } = await import('node:fs')
    const svg = readFileSync('src/icons/brand.svg', 'utf8')
    const b64 = (p: string) => `data:image/png;base64,${readFileSync(p).toString('base64')}`
    await page.setContent(`<body style="margin:0;display:flex;gap:12px;padding:12px;background:#ddd">
      <div style="width:192px;height:192px">${svg}</div>
      <img src="${b64('public/icons/icon-192.png')}" width="96" height="96">
      <img src="${b64('public/icons/maskable-512.png')}" width="96" height="96">
      <img src="${b64('public/icons/apple-touch-icon.png')}" width="96" height="96">
    </body>`)
    await page.screenshot({ path: 'docs/evidence/snag-train-2026-10-slice-12-brand-mark.png' })
  })

  // === slice 13 (Fixes #27) — running pill's elapsed sweep has a flat trailing edge ===
  test('#27 the elapsed sweep has a flat trailing edge, not a nested rounded block', async ({ page, context }) => {
    const now = new Date()
    now.setHours(14, 30, 0, 0) // inside the 14:00-15:30 "Write the migration plan" block
    await page.clock.install({ time: now })
    await openApp(page, context, {
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const pill = page.locator('[data-testid="block"][data-running="true"]')
    await pill.scrollIntoViewIfNeeded()
    const elapsed = pill.locator('.elapsed')
    await expect(elapsed).toBeVisible()
    const radii = await elapsed.evaluate((el) => {
      const s = getComputedStyle(el)
      return { tl: s.borderTopLeftRadius, tr: s.borderTopRightRadius, bl: s.borderBottomLeftRadius, br: s.borderBottomRightRadius }
    })
    expect(radii.tr).toBe('0px')
    expect(radii.br).toBe('0px')
    expect(radii.tl).not.toBe('0px') // the leading edge keeps the pill's own radius
    expect(radii.bl).not.toBe('0px')
  })

  test('#27 evidence: running pill with a flat-edged elapsed sweep (Day view)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const now = new Date()
    now.setHours(14, 30, 0, 0)
    await page.clock.install({ time: now })
    await openApp(page, context, {
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const pill = page.locator('[data-testid="block"][data-running="true"]')
    await pill.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `docs/evidence/snag-train-2026-10-slice-13-running-pill-${info.project.name}.png` })
  })
  // === slice 14 — Eye LITE P0s (docs/evidence/snag-train-2026-10-slice-14-design-critique.md) ===
  test('ST-P0-1 the iPhone event sheet sits above the floating tab bar, not trapped under it', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the bottom sheet is mobile-only')
    const setView = (v: string) => page.evaluate((x) => (window as any).__optimo.ui.getState().set({ view: x, mobileTab: 'board' }), v)
    await openApp(page, context, { seed: seedDay })
    await setView('settings')
    const form = page.getByTestId('calendar-connect')
    await form.getByLabel('Apple ID').fill(FAKE_USER)
    await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
    await form.getByRole('button', { name: 'Connect iCloud' }).click()
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await setView('day')
    const ev = page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist check-up' })
    await ev.scrollIntoViewIfNeeded()
    await ev.getByRole('button', { name: /Dentist check-up/ }).click()
    await expect(page.getByTestId('event-details')).toBeVisible()
    const onTop = await page.evaluate(() => {
      const r = document.querySelector('.tabbar')!.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !!hit?.closest('.sheet-wrap')
    })
    expect(onTop).toBe(true)
    await page.getByTestId('event-details').getByRole('button', { name: 'Close' }).click()
    await expect(page.getByTestId('event-details')).toHaveCount(0)
  })

  test('ST-P0-2 no settings group uses a native legend; Reminders + Calendars labels sit inside their cards', async ({ page, context }) => {
    await openApp(page, context)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'settings', mobileTab: 'board' }))
    await expect(page.locator('.settings legend')).toHaveCount(0)
    for (const name of ['Reminders', 'Calendars']) {
      const group = page.getByRole('group', { name })
      await expect(group).toBeVisible()
      const card = (await group.boundingBox())!
      const label = (await group.locator(':scope > h3').boundingBox())!
      expect(label.y).toBeGreaterThanOrEqual(card.y + 8)
    }
  })
})
