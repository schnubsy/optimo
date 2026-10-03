// optimo signs in through the Family Wing only (arc 5a). press's family gate keeps ONE session for every family tool
// at localStorage `press:family:v1`, in its own raw-fetch shape ({access_token, refresh_token, expires_at in ms,
// email, name}) — not supabase-js's. This adapter lets supabase-js read and write that same record, so a Family Wing
// sign-in opens optimo, and a token optimo rotates is the token Family Wing uses next (no split-brain refresh tokens).
// Pure converters + a Storage-shaped adapter; unit-tested apart from the browser.

export const PRESS_KEY = 'press:family:v1'
/** optimo's own supabase-js session key before arc 5a (its OTP sign-in) — migrated once, then removed */
export const LEGACY_KEY = 'sb-eepjhpyziczrxvirczio-auth-token'

export type PressSession = { access_token: string; refresh_token: string; expires_at: number; email: string; name: string | null }

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Decode a JWT payload (base64url JSON); null on anything malformed — never throws. */
export function jwtPayload(token: string): Record<string, unknown> | null {
  const seg = token.split('.')[1]
  if (!seg) return null
  try {
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(seg.length / 4) * 4, '=')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const o = JSON.parse(new TextDecoder().decode(bytes))
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

function readPress(raw: string | null): PressSession | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw)
    if (!o || typeof o.access_token !== 'string' || typeof o.refresh_token !== 'string' || typeof o.expires_at !== 'number') return null
    return { access_token: o.access_token, refresh_token: o.refresh_token, expires_at: o.expires_at, email: String(o.email ?? '').toLowerCase(), name: o.name ?? null }
  } catch {
    return null
  }
}

/** press record (JSON) → supabase-js Session (JSON), the user rebuilt from the access token. null when unusable. */
export function pressToSupabase(raw: string | null, now = Date.now()): string | null {
  const p = readPress(raw)
  if (!p) return null
  const claims = jwtPayload(p.access_token)
  if (!claims || typeof claims.sub !== 'string') return null
  const expSec = Math.floor(p.expires_at / 1000)
  return JSON.stringify({
    access_token: p.access_token,
    refresh_token: p.refresh_token,
    token_type: 'bearer',
    expires_at: expSec,
    expires_in: Math.max(0, expSec - Math.floor(now / 1000)),
    user: {
      id: claims.sub,
      aud: claims.aud ?? 'authenticated',
      role: claims.role ?? 'authenticated',
      email: p.email || String(claims.email ?? ''),
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? (p.name ? { name: p.name } : {}),
      created_at: '',
    },
  })
}

/** supabase-js Session (JSON) → press record (JSON). null when the session lacks either token. */
export function supabaseToPress(raw: string | null): string | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw)
    if (!s || typeof s.access_token !== 'string' || typeof s.refresh_token !== 'string') return null
    const claims = jwtPayload(s.access_token) ?? {}
    const expMs = typeof s.expires_at === 'number' ? s.expires_at * 1000 : typeof claims.exp === 'number' ? claims.exp * 1000 : Date.now() + 3600_000
    const meta = (s.user?.user_metadata ?? claims.user_metadata ?? {}) as Record<string, unknown>
    const out: PressSession = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: expMs,
      email: String(s.user?.email ?? claims.email ?? '').toLowerCase(),
      name: (meta.name as string) || (meta.full_name as string) || null,
    }
    return JSON.stringify(out)
  } catch {
    return null
  }
}

/** supabase-js `auth.storage`: the PRESS_KEY entry is translated both ways; anything else passes straight through. */
export function pressStorage(store: KV) {
  return {
    getItem: (key: string) => (key === PRESS_KEY ? pressToSupabase(store.getItem(PRESS_KEY)) : store.getItem(key)),
    setItem: (key: string, value: string) => {
      if (key !== PRESS_KEY) return store.setItem(key, value)
      const p = supabaseToPress(value)
      if (p) store.setItem(PRESS_KEY, p)
    },
    removeItem: (key: string) => store.removeItem(key),
  }
}

/** One-time: a device still holding optimo's pre-5a session moves it into the shared Family Wing record (same user,
 *  same project), so Mark is not bounced to sign in again. The legacy key is removed either way. */
export function migrateLegacySession(store: KV): boolean {
  const legacy = store.getItem(LEGACY_KEY)
  if (legacy === null) return false
  let moved = false
  if (!readPress(store.getItem(PRESS_KEY))) {
    const p = supabaseToPress(legacy)
    if (p) {
      store.setItem(PRESS_KEY, p)
      moved = true
    }
  }
  store.removeItem(LEGACY_KEY)
  return moved
}
