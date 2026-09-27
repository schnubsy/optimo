// Two-step sign-in (press sends a 6-digit code, not a link): email → code → verify.
// Pure reducer so the step logic is unit-tested apart from React and Supabase.

export type SignInPhase = 'idle' | 'sending' | 'code-sent' | 'verifying' | 'error'
export type SignInStep = 'email' | 'code'

export type SignInState = { phase: SignInPhase; step: SignInStep; email: string; message: string }

export type SignInEvent =
  | { type: 'send'; email: string }
  | { type: 'sent' }
  | { type: 'verify' }
  | { type: 'fail'; message: string }
  | { type: 'back' }

export const initialSignIn: SignInState = { phase: 'idle', step: 'email', email: '', message: '' }

export const WRONG_CODE = "That code didn't match. Try again or resend."

export function signInReducer(s: SignInState, e: SignInEvent): SignInState {
  switch (e.type) {
    case 'send': // first send from the email step, or "Resend code" from the code step
      if (s.phase === 'sending' || s.phase === 'verifying') return s
      return { ...s, phase: 'sending', email: e.email, message: '' }
    case 'sent':
      if (s.phase !== 'sending') return s
      return { ...s, phase: 'code-sent', step: 'code', message: `Code sent to ${s.email}.` }
    case 'verify':
      if (s.step !== 'code' || s.phase === 'sending' || s.phase === 'verifying') return s
      return { ...s, phase: 'verifying', message: '' }
    case 'fail':
      if (s.phase !== 'sending' && s.phase !== 'verifying') return s
      return { ...s, phase: 'error', message: e.message }
    case 'back':
      if (s.phase === 'sending' || s.phase === 'verifying') return s
      return { ...initialSignIn, email: s.email }
  }
}

/** Strip whitespace (and any other non-digits a paste brings along); cap at 6. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
