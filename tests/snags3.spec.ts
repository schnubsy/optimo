// arc 3 slices 2–10 — snag Issues #29–#37 (label `snag`), raised by the snag-train 2026-10 slice-14 Eye LITE critique
// (docs/evidence/snag-train-2026-10-slice-14-design-critique.md). One behavioural case per Issue.
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, seedDay, seedTask } from './support/app'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)

test.describe('snags #29–#37 (arc 3)', () => {
  test('#29 the iPhone inbox has no desktop drag hint under the tab bar; desktop keeps it', async ({ page, context }) => {
    await openApp(page, context, { seed: (s) => seedDay(s) })
    const mobile = await isMobile(page)
    if (mobile) await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('inbox-row').first()).toBeVisible()
    const ft = page.locator('.backlog .ft')
    if (mobile) await expect(ft).toBeHidden()
    else await expect(ft).toBeVisible()
  })

  test('#31 the editor mounts with its Category row already filled (no empty-row flash)', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    // record how many category chips the sheet has in the very mutation that inserts it
    await page.evaluate(() => {
      const w = window as any
      w.__chipsAtMount = null
      new MutationObserver((_, obs) => {
        const row = document.querySelector('[data-testid="sheet-category"]')
        if (row && w.__chipsAtMount === null) {
          w.__chipsAtMount = row.querySelectorAll('button').length
          obs.disconnect()
        }
      }).observe(document.body, { childList: true, subtree: true })
    })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => (window as any).__chipsAtMount)).toBeGreaterThanOrEqual(8)
  })

  for (const theme of ['light', 'dark'] as const)
    test(`#31 Month paints today's category dots (${theme})`, async ({ page, context }) => {
      await openApp(page, context, { seed: (s) => seedDay(s), theme })
      await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'month', mobileTab: 'board' }))
      await expect(page.locator('.mday.today .dots i')).toHaveCount(4)
      await expect(page.locator('.mday.today .dots em')).toHaveText('+6')
    })

  test('#32 the now line stops at a running pill instead of striking its title', async ({ page, context }) => {
    await openApp(page, context, {
      at: '14:30',
      seed: (s) => seedTask(s, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work }),
    })
    const pill = page.locator('[data-testid="block"][data-running="true"]')
    await pill.scrollIntoViewIfNeeded()
    const line = page.getByTestId('now-line')
    await expect(line).toBeVisible()
    // what is painted where the now line crosses the middle of the pill: the pill, not the line
    const hit = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="block"][data-running="true"]')!.getBoundingClientRect()
      const nl = document.querySelector('[data-testid="now-line"]') as HTMLElement
      const l = nl.getBoundingClientRect()
      nl.style.pointerEvents = 'auto' // hit-testing skips pointer-events:none; the paint order is what we ask about
      nl.style.height = '2px'
      const el = document.elementFromPoint(p.left + p.width / 2, l.top + 1)
      return { inPill: !!el?.closest('[data-testid="block"]'), lineInside: l.top > p.top && l.top < p.bottom }
    })
    expect(hit.lineInside).toBe(true)
    expect(hit.inPill).toBe(true)
    if (process.env.EVIDENCE) {
      await page.evaluate(() => ((document.querySelector('[data-testid="now-line"]') as HTMLElement).style.cssText += ';pointer-events:none;height:0'))
      await page.screenshot({ path: `docs/evidence/ai-planner-slice-5-running-pill-${test.info().project.name}.png` })
    }
  })
})
