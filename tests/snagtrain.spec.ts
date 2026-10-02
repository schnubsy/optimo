// snag train 2026-10 — Issues #15-#27 (label `snag`), raised by the arc-2 slice-7 Eye LITE critique
// (docs/evidence/arc2-slice-7-design-critique.md). One behavioural case per slice; evidence captures are
// gated on EVIDENCE=1 (same convention as design2.spec.ts).
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, seedTask } from './support/app'
import { ACTIVITY, CHROME } from '../src/icons/set'

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
})
