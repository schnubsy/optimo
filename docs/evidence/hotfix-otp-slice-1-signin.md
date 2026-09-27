# hotfix-otp · slice 1 — code entry on the sign-in screen (2026-09-27)

Gauntlet `hotfix-otp-s1` (20260927-093040): **GREEN**
- unit 81/81 (new: `tests/unit/signin.test.ts` — step machine idle → sending → code-sent → verifying → error/back, code normalisation)
- Playwright 68 passed / 26 skipped (desktop + iPhone 15, axe inside) — new `tests/signin.spec.ts` (6 × 2):
  send code → 6 digits → day view (auto-submit) · pasted "424 242" verifies · wrong code → "That code didn't match.
  Try again or resend." then right code signs in · resend hits the fake's 60 s 429 message, sends after the window ·
  "Use a different email" → step 1 · axe clean on both steps
- Lighthouse desktop perf 100 / a11y 100 · mobile perf 98 / a11y 100

Fake server (`tests/support/fakeSupabase.ts`): `/auth/v1/verify` accepts only `otpCode` (403 `otp_expired` otherwise,
as GoTrue does for wrong and expired codes); `/auth/v1/otp` returns press's 429 resend-window message inside 60 s.

Screenshots (both steps, dark + light): `hotfix-otp-slice-1-{email,code}-{dark,light}-{desktop,iphone-15}.png`.
No press Auth settings touched; `emailRedirectTo` kept so a link-style template still signs in via onAuthStateChange.
