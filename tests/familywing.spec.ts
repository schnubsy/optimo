// Arc 5a slice 1 — the Family Wing is optimo's only sign-in. A Family Wing session (press:family:v1) opens optimo
// straight away; no session sends you to optimo's launcher card on press with ?return=<this URL>; a session without
// the optimo grant gets the "ask Mark" page. No OTP screen exists any more.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { FakeSupabase, fakeSession, trackErrors } from './support/fakeSupabase'

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

const OTP_UI = 'input[type=email], input[autocomplete="one-time-code"]'

test.describe('Family Wing sign-in', () => {
  test('signed in on the Family Wing → straight into the day view, grant checked for optimo.html', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context)
    const errors = trackErrors(page)
    await page.goto('./')
    await expect(page.getByTestId('timeline')).toBeVisible()
    await expect(page.locator(OTP_UI)).toHaveCount(0)
    expect(server.accessChecks).toContain('optimo.html')
    expect(server.unexpected).toEqual([])
    expect(errors).toEqual([])
  })

  test('signed out → the Family Wing launcher with return-to = this optimo URL', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    const landed: string[] = []
    await context.route('https://schnubsy.github.io/press/**', (r) => {
      landed.push(r.request().url())
      return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Family Wing</title><h1>Family Wing</h1>' })
    })
    await page.goto('./?view=week')
    await expect(page).toHaveURL(/^https:\/\/schnubsy\.github\.io\/press\/optimo\.html\?return=/)
    const ret = new URL(landed[0]).searchParams.get('return')
    expect(ret).toMatch(/\/optimo\/\?view=week$/)
    expect(server.accessChecks).toEqual([])
  })

  test('?stay holds the handover page (Lighthouse) with a Family Wing link that drops ?stay from the return', async ({ context, page }) => {
    await new FakeSupabase().attach(context, { signedIn: false })
    await page.goto('./?stay')
    const link = page.getByTestId('to-family-wing').getByRole('link', { name: 'Go to the Family Wing' })
    await expect(link).toHaveAttribute('href', /press\/optimo\.html\?return=.*%2Foptimo%2F$/)
    await page.waitForTimeout(300)
    expect(new URL(page.url()).pathname).toBe('/optimo/')
    await axeClean(page)
  })

  test('signed in without the optimo grant → the ask-Mark page with a link back to the Family Wing', async ({ context, page }) => {
    const server = new FakeSupabase()
    server.access = false
    await server.attach(context)
    await page.goto('./')
    const gate = page.getByTestId('no-access')
    await expect(gate).toContainText("optimo isn't switched on for you yet — ask Mark.")
    await expect(gate.getByRole('link', { name: 'Back to the Family Wing' })).toHaveAttribute('href', 'https://schnubsy.github.io/press/index.html?view=family')
    await expect(page.getByTestId('timeline')).toHaveCount(0)
    await expect(page.locator(OTP_UI)).toHaveCount(0)
    await axeClean(page)
  })

  test("a device holding optimo's old session moves it into the Family Wing record — no bounce", async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await context.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('sb-eepjhpyziczrxvirczio-auth-token', JSON.stringify(s))
        sessionStorage.setItem('seeded', '1')
      }
    }, fakeSession())
    await page.goto('./')
    await expect(page.getByTestId('timeline')).toBeVisible()
    const keys = await page.evaluate(() => ({ legacy: localStorage.getItem('sb-eepjhpyziczrxvirczio-auth-token'), press: localStorage.getItem('press:family:v1') }))
    expect(keys.legacy).toBeNull()
    expect(JSON.parse(keys.press!).refresh_token).toBe('fake-refresh')
  })

  test('evidence: ask-Mark page', async ({ context, page }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    const server = new FakeSupabase()
    server.access = false
    await server.attach(context)
    await page.goto('./')
    await expect(page.getByTestId('no-access')).toBeVisible()
    await page.screenshot({ path: `docs/evidence/arc5a-slice-1-no-access-${info.project.name}.png` })
  })
})
