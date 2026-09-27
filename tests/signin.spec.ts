// Two-step sign-in against the hermetic fake: press emails a 6-digit code (shared template), optimo verifies it.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { FakeSupabase, trackErrors } from './support/fakeSupabase'

const EMAIL = 'mark@optimo.invalid'

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

async function toCodeStep(page: Page) {
  await page.goto('./')
  await expect(page.getByLabel(/6-digit code/)).toHaveCount(0) // no code field until a code has been sent
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByRole('status')).toHaveText(`Code sent to ${EMAIL}.`)
  await expect(page.getByLabel('Enter the 6-digit code from your email')).toBeFocused()
}

test.describe('sign in with the emailed code', () => {
  test('send code → type 6 digits → lands on the day view (auto-submit)', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    const errors = trackErrors(page)
    await toCodeStep(page)
    expect(server.otpSends).toEqual([EMAIL])
    await page.getByLabel('Enter the 6-digit code from your email').pressSequentially(server.otpCode)
    await expect(page.getByTestId('timeline')).toBeVisible()
    await expect(page.getByRole('heading', { name: /optimo/ })).toHaveCount(0)
    expect(server.unexpected).toEqual([])
    expect(errors).toEqual([])
  })

  test('a pasted code with a space verifies too', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await toCodeStep(page)
    await page.getByLabel('Enter the 6-digit code from your email').fill(`${server.otpCode.slice(0, 3)} ${server.otpCode.slice(3)}`)
    await expect(page.getByTestId('timeline')).toBeVisible()
  })

  test('wrong code shows the error and keeps the code step; the right code then signs in', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await toCodeStep(page)
    const input = page.getByLabel('Enter the 6-digit code from your email')
    await input.pressSequentially('000000')
    await expect(page.getByRole('status')).toHaveText("That code didn't match. Try again or resend.")
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    await axeClean(page)
    await input.pressSequentially(server.otpCode)
    await expect(page.getByTestId('timeline')).toBeVisible()
  })

  test('resend respects the 60 s cooldown message; after the window it sends again', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await toCodeStep(page)
    await page.getByRole('button', { name: 'Resend code' }).click()
    await expect(page.getByRole('status')).toContainText(/only request this after \d+ seconds/)
    expect(server.otpSends).toHaveLength(1)
    server.lastOtpAt -= 61_000 // the window passes
    await page.getByRole('button', { name: 'Resend code' }).click()
    await expect(page.getByRole('status')).toHaveText(`Code sent to ${EMAIL}.`)
    expect(server.otpSends).toHaveLength(2)
  })

  test('"Use a different email" returns to step 1 with the address kept', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await toCodeStep(page)
    await page.getByRole('button', { name: 'Use a different email' }).click()
    await expect(page.getByLabel('Email')).toHaveValue(EMAIL)
    await expect(page.getByLabel(/6-digit code/)).toHaveCount(0)
  })

  test('both steps are axe clean', async ({ context, page }) => {
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    await page.goto('./')
    await axeClean(page)
    await toCodeStep(page)
    await axeClean(page)
  })

  test('evidence: both steps, dark + light', async ({ context, page }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    const server = new FakeSupabase()
    await server.attach(context, { signedIn: false })
    for (const theme of ['dark', 'light'] as const) {
      await page.goto('./')
      await page.evaluate((t) => localStorage.setItem('optimo.theme', t), theme)
      server.lastOtpAt = 0
      await page.reload()
      await page.getByLabel('Email').fill(EMAIL)
      await page.screenshot({ path: `docs/evidence/hotfix-otp-slice-1-email-${theme}-${info.project.name}.png` })
      await page.getByRole('button', { name: 'Send code' }).click()
      await page.getByLabel('Enter the 6-digit code from your email').pressSequentially('123')
      await page.screenshot({ path: `docs/evidence/hotfix-otp-slice-1-code-${theme}-${info.project.name}.png` })
    }
  })
})
