import { useState, type FormEvent } from 'react'
import { sendMagicLink } from '../auth/session'
import './signin.css'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const err = await sendMagicLink(email.trim())
    if (err) {
      setState('error')
      setMsg(err)
    } else {
      setState('sent')
      setMsg(`Link sent to ${email.trim()}. Open it on this device to sign in.`)
    }
  }

  return (
    <main className="signin">
      <div className="signin-card">
        <h1>
          optimo<span aria-hidden="true">_</span>
        </h1>
        <p className="signin-lede">One timeline for the day. Sign in with a one-time email link.</p>
        <form onSubmit={submit}>
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
          <button type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
        <p className={`signin-msg ${state}`} role="status" aria-live="polite">
          {msg}
        </p>
      </div>
    </main>
  )
}
