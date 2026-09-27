import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../sync/remote'

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

export async function sendMagicLink(email: string): Promise<string | null> {
  const sb = supabase()
  if (!sb) return 'Sync is not configured for this build.'
  const redirect = new URL(import.meta.env.BASE_URL, location.origin).toString()
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } })
  return error ? error.message : null
}

export async function signOut() {
  await supabase()?.auth.signOut()
}
