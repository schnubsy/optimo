import { useReducer, useRef, useState, type FormEvent } from 'react'
import { sendSignInCode, verifySignInCode } from '../auth/session'
import { initialSignIn, isCompleteCode, normalizeCode, signInReducer } from '../auth/signinMachine'
import './signin.css'

export function SignIn() {
  const [s, dispatch] = useReducer(signInReducer, initialSignIn)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)
  const busy = s.phase === 'sending' || s.phase === 'verifying'

  async function send(to: string) {
    if (busy) return
    dispatch({ type: 'send', email: to })
    const err = await sendSignInCode(to)
    if (err) dispatch({ type: 'fail', message: err })
    else {
      dispatch({ type: 'sent' })
      setCode('')
    }
  }

  async function verify(value: string) {
    if (busy || !isCompleteCode(value)) return
    dispatch({ type: 'verify' })
    const err = await verifySignInCode(s.email, value)
    // success unmounts this screen via onAuthStateChange; only failures land here
    if (err) {
      dispatch({ type: 'fail', message: err })
      setCode('')
      requestAnimationFrame(() => codeRef.current?.focus())
    }
  }

  function onCode(raw: string) {
    const next = normalizeCode(raw)
    setCode(next)
    if (isCompleteCode(next)) void verify(next) // auto-submit on the 6th digit (typed or pasted)
  }

  const msgClass = s.phase === 'error' ? 'error' : ''

  return (
    <main className="signin">
      <div className="signin-card">
        <h1>
          optimo<span aria-hidden="true">_</span>
        </h1>
        <p className="signin-lede">One timeline for the day. Sign in with a one-time code from your email.</p>
        {s.step === 'email' ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              void send(email.trim())
            }}
          >
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <button type="submit" disabled={busy}>
              {s.phase === 'sending' ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              void verify(code)
            }}
          >
            <p className="signin-sent">
              Sent to <strong>{s.email}</strong>{' '}
              <button type="button" className="signin-link" onClick={() => dispatch({ type: 'back' })} disabled={busy}>
                Use a different email
              </button>
            </p>
            <label htmlFor="code">Enter the 6-digit code from your email</label>
            <input
              id="code"
              ref={codeRef}
              className="signin-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={12}
              autoFocus
              value={code}
              onChange={(e) => onCode(e.target.value)}
              placeholder="000000"
              aria-describedby="signin-msg"
            />
            <button type="submit" disabled={busy || !isCompleteCode(code)}>
              {s.phase === 'verifying' ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="signin-secondary" onClick={() => void send(s.email)} disabled={busy}>
              {s.phase === 'sending' ? 'Sending…' : 'Resend code'}
            </button>
          </form>
        )}
        <p id="signin-msg" className={`signin-msg ${msgClass}`} role="status" aria-live="polite">
          {s.message}
        </p>
      </div>
    </main>
  )
}
