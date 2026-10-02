// snag train 2026-10 — Issues #15-#27 (label `snag`), raised by the arc-2 slice-7 Eye LITE critique
// (docs/evidence/arc2-slice-7-design-critique.md). One behavioural case per slice; evidence captures are
// gated on EVIDENCE=1 (same convention as design2.spec.ts).
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, seedDay, seedTask } from './support/app'
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
})
