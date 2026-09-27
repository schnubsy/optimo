import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../sync/remote'
import { WRONG_CODE, isCompleteCode, normalizeCode } from './signinMachine'

export type AuthState = { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; session: Session }

export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>(() => (supabase() ? { status: 'loading' } : { status: 'signed-out' }))
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let alive = true
    sb.auth.getSession().then(({ data }) => {
      if (alive) setState(data.session ? { status: 'signed-in', session: data.session } : { status: 'signed-out' })
    })
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      setState(session ? { status: 'signed-in', session } : { status: 'signed-out' })
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])
  return state
}

/** Ask press to email a one-time code. press's template sends a 6-digit code; `emailRedirectTo` stays so a
 *  link-style template would still land here (the onAuthStateChange path above picks that session up). */
export async function sendSignInCode(email: string): Promise<string | null> {
  const sb = supabase()
  if (!sb) return 'Sync is not configured for this build.'
  const redirect = new URL(import.meta.env.BASE_URL, location.origin).toString()
  // sign-ups are OFF in press by design — never try to create a user
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: false } })
  return error ? error.message : null
}

/** Verify the emailed code; on success supabase-js stores the session and useSession flips to signed-in. */
export async function verifySignInCode(email: string, code: string): Promise<string | null> {
  const sb = supabase()
  if (!sb) return 'Sync is not configured for this build.'
  const token = normalizeCode(code)
  if (!isCompleteCode(token)) return 'Enter the 6 digits from your email.'
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' })
  if (!error) return null
  // wrong and expired codes both come back as otp_expired / 403 "Token has expired or is invalid"
  if (error.code === 'otp_expired' || error.status === 403 || /expired|invalid/i.test(error.message)) return WRONG_CODE
  return error.message
}

export async function signOut() {
  await supabase()?.auth.signOut()
}
