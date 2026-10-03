import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../sync/remote'

// optimo has no sign-in of its own (arc 5a): the session is the Family Wing's (src/auth/pressSession.ts), and access is
// press's grant for the launcher page — the same check FamilyGate.require('optimo.html') makes.
export const ACCESS_PAGE = 'optimo.html'
const ACCESS_CACHE = 'optimo.access'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'no-access'; email: string }
  | { status: 'signed-in'; session: Session }

/** press_access_has('optimo.html'): true / false from the server; on a network failure the last known answer for this
 *  user (the PWA must still open offline), defaulting to allowed — RLS stays the lock either way. */
export async function checkAccess(session: Session): Promise<boolean> {
  const sb = supabase()
  const key = `${ACCESS_CACHE}:${session.user.id}`
  if (!sb) return true
  try {
    const { data, error } = await sb.rpc('press_access_has', { page: ACCESS_PAGE })
    if (error) throw error
    const ok = data === true
    try {
      localStorage.setItem(key, ok ? '1' : '0')
    } catch {
      /* storage full / private mode */
    }
    return ok
  } catch {
    return localStorage.getItem(key) !== '0'
  }
}

export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>(() => (supabase() ? { status: 'loading' } : { status: 'signed-out' }))
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let alive = true
    let checked: string | null = null
    const apply = async (session: Session | null) => {
      if (!session) {
        checked = null
        if (alive) setState({ status: 'signed-out' })
        return
      }
      if (checked === session.user.id) {
        // token refresh: same person, keep the decision
        if (alive) setState((s) => (s.status === 'signed-in' ? { status: 'signed-in', session } : s))
        return
      }
      checked = session.user.id
      const ok = await checkAccess(session)
      if (!alive) return
      setState(ok ? { status: 'signed-in', session } : { status: 'no-access', email: session.user.email ?? '' })
    }
    sb.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((evt, session) => {
      if (evt === 'INITIAL_SESSION') return // getSession above covers it
      void apply(session)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])
  return state
}

/** Signs out of the Family Wing session itself (one session for every family tool). */
export async function signOut() {
  await supabase()?.auth.signOut()
}
