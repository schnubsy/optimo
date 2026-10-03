// Arc 2 slice 6 — the Family Wing launcher (dist/optimo.html, built by build-press.mjs): gated by the vendored
// family gate — signed out it shows the Family Wing sign-in, with a granted session it shows the optimo card.
// Hermetic: spaces.json and the press GoTrue / PostgREST calls are routed; nothing reaches the network.
import { test, expect, type BrowserContext } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

const SUPA = /https:\/\/eepjhpyziczrxvirczio\.supabase\.co\//

async function wing(context: BrowserContext, opts: { granted: boolean }) {
  const calls: string[] = []
  await context.route(/\/optimo\/spaces\.json$/, (r) => r.fulfill({ json: { v: 2, personal: [], family: ['optimo.html'] } }))
  await context.route(SUPA, (r) => {
    const u = new URL(r.request().url())
    calls.push(`${r.request().method()} ${u.pathname}`)
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    if (u.pathname === '/rest/v1/press_access_apps') return r.fulfill({ headers: cors, json: [{ page: 'optimo.html', gated: true }] })
    if (u.pathname === '/rest/v1/rpc/press_access_has') return r.fulfill({ headers: cors, json: opts.granted })
    if (u.pathname === '/rest/v1/rpc/press_access_touch') return r.fulfill({ status: 204, headers: cors })
    return r.fulfill({ status: 404, headers: cors, json: {} })
  })
  return calls
}

const session = () => ({
  access_token: 'fake.jwt.token',
  refresh_token: 'fake-refresh',
  expires_at: Date.now() + 3600_000,
  email: 'mark@family.example',
  name: 'Mark',
})

test.describe('press Family Wing launcher (optimo.html)', () => {
  test('signed out: the Family Wing sign-in, no card', async ({ page, context }) => {
    await wing(context, { granted: false })
    await page.goto('./optimo.html')
    await expect(page.locator('#fg-email')).toBeVisible()
    await expect(page.getByRole('button', { name: /Send me a code/ })).toBeVisible()
    await expect(page.getByTestId('optimo-card')).toBeHidden()
  })

  test('granted session: the card, one link to the app, axe clean', async ({ page, context }) => {
    const calls = await wing(context, { granted: true })
    await context.addInitScript((s) => localStorage.setItem('press:family:v1', JSON.stringify(s)), session())
    await page.goto('./optimo.html')
    const card = page.getByTestId('optimo-card')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading')).toHaveText('optimo — one timeline for the day')
    await expect(card.getByRole('link', { name: 'Open optimo' })).toHaveAttribute('href', 'https://schnubsy.github.io/optimo/')
    await expect(page.locator('#fg-email')).toHaveCount(0)
    expect(calls).toContain('POST /rest/v1/rpc/press_access_has')
    const v = (await new AxeBuilder({ page }).analyze()).violations.filter((x) => ['serious', 'critical'].includes(x.impact ?? ''))
    expect(v).toEqual([])
  })

  test('a session without a grant for optimo still gets the sign-in (RLS-backed grant check)', async ({ page, context }) => {
    await wing(context, { granted: false })
    await context.addInitScript((s) => localStorage.setItem('press:family:v1', JSON.stringify(s)), session())
    await page.goto('./optimo.html')
    await expect(page.getByTestId('optimo-card')).toBeHidden()
    await expect(page.locator('#fg-email, #fg-signout').first()).toBeVisible()
  })

  test('granted session + ?return=<optimo URL> → straight back to optimo (arc 5a return-to)', async ({ page, context, baseURL }) => {
    await wing(context, { granted: true })
    await context.addInitScript((s) => localStorage.setItem('press:family:v1', JSON.stringify(s)), session())
    await context.route(/\/optimo\/\?view=week$/, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>optimo</title><h1>back in optimo</h1>' }))
    const origin = new URL(baseURL!).origin
    await page.goto('./optimo.html?return=' + encodeURIComponent(origin + '/optimo/?view=week'))
    await expect(page).toHaveURL(origin + '/optimo/?view=week')
  })

  test('?return= to anywhere else is ignored — the card shows, no redirect', async ({ page, context }) => {
    await wing(context, { granted: true })
    await context.addInitScript((s) => localStorage.setItem('press:family:v1', JSON.stringify(s)), session())
    await page.goto('./optimo.html?return=' + encodeURIComponent('https://evil.example/optimo/'))
    await expect(page.getByTestId('optimo-card')).toBeVisible()
    expect(new URL(page.url()).pathname).toMatch(/optimo\.html$/)
  })

  test('evidence: launcher card', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    await wing(context, { granted: true })
    await context.addInitScript((s) => localStorage.setItem('press:family:v1', JSON.stringify(s)), session())
    await page.goto('./optimo.html')
    await expect(page.getByTestId('optimo-card')).toBeVisible()
    await page.screenshot({ path: `docs/evidence/arc2-slice-6-card-${info.project.name}.png` })
  })
})
