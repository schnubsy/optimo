import { describe, expect, it } from 'vitest'
import { LEGACY_KEY, PRESS_KEY, jwtPayload, migrateLegacySession, pressStorage, pressToSupabase, supabaseToPress } from '../../src/auth/pressSession'
import { familyWingDoorUrl, familyWingSignInUrl, isOptimoReturn } from '../../src/auth/familyWing'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (claims: object) => `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`
const ACCESS = jwt({ sub: 'u-1', email: 'Mark@Example.com', role: 'authenticated', exp: 2_000_000_000, user_metadata: { name: 'Mark Ü' } })
const press = { access_token: ACCESS, refresh_token: 'r-1', expires_at: 2_000_000_000_000, email: 'mark@example.com', name: 'Mark Ü' }

function mem(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('press session ↔ supabase-js session', () => {
  it('decodes UTF-8 JWT payloads and rejects garbage', () => {
    expect(jwtPayload(ACCESS)?.user_metadata).toEqual({ name: 'Mark Ü' })
    expect(jwtPayload('nope')).toBeNull()
    expect(jwtPayload('a.%%%.c')).toBeNull()
  })

  it('press → supabase: seconds expiry, user rebuilt from the token', () => {
    const s = JSON.parse(pressToSupabase(JSON.stringify(press), 1_999_999_000_000)!)
    expect(s).toMatchObject({ access_token: ACCESS, refresh_token: 'r-1', token_type: 'bearer', expires_at: 2_000_000_000, expires_in: 1000 })
    expect(s.user).toMatchObject({ id: 'u-1', email: 'mark@example.com', role: 'authenticated' })
  })

  it('press → supabase: unusable records give null (no session)', () => {
    expect(pressToSupabase(null)).toBeNull()
    expect(pressToSupabase('{bad')).toBeNull()
    expect(pressToSupabase(JSON.stringify({ ...press, refresh_token: undefined }))).toBeNull()
    expect(pressToSupabase(JSON.stringify({ ...press, access_token: 'no.claims' }))).toBeNull()
  })

  it('supabase → press: ms expiry, lower-case email, name from metadata — round-trips', () => {
    const back = JSON.parse(supabaseToPress(pressToSupabase(JSON.stringify(press)))!)
    expect(back).toEqual(press)
  })

  it('the adapter translates only the press key; a rotated token is written back in press shape', () => {
    const store = mem({ [PRESS_KEY]: JSON.stringify(press), other: 'x' })
    const a = pressStorage(store)
    expect(JSON.parse(a.getItem(PRESS_KEY)!).user.id).toBe('u-1')
    expect(a.getItem('other')).toBe('x')
    const rotated = { ...JSON.parse(a.getItem(PRESS_KEY)!), refresh_token: 'r-2', expires_at: 2_000_003_600 }
    a.setItem(PRESS_KEY, JSON.stringify(rotated))
    expect(JSON.parse(store.m.get(PRESS_KEY)!)).toMatchObject({ refresh_token: 'r-2', expires_at: 2_000_003_600_000, email: 'mark@example.com' })
    a.setItem(`${PRESS_KEY}-code-verifier`, 'v')
    expect(store.m.get(`${PRESS_KEY}-code-verifier`)).toBe('v')
    a.removeItem(PRESS_KEY)
    expect(store.m.has(PRESS_KEY)).toBe(false)
  })

  it("migrates optimo's pre-5a session once, never over a live Family Wing session", () => {
    const legacy = pressToSupabase(JSON.stringify(press))!
    const empty = mem({ [LEGACY_KEY]: legacy })
    expect(migrateLegacySession(empty)).toBe(true)
    expect(JSON.parse(empty.m.get(PRESS_KEY)!).refresh_token).toBe('r-1')
    expect(empty.m.has(LEGACY_KEY)).toBe(false)

    const live = mem({ [LEGACY_KEY]: legacy, [PRESS_KEY]: JSON.stringify({ ...press, refresh_token: 'wing' }) })
    expect(migrateLegacySession(live)).toBe(false)
    expect(JSON.parse(live.m.get(PRESS_KEY)!).refresh_token).toBe('wing')
    expect(live.m.has(LEGACY_KEY)).toBe(false)

    expect(migrateLegacySession(mem())).toBe(false)
  })
})

describe('Family Wing URLs', () => {
  it('sign-in goes to the optimo launcher with an encoded return', () => {
    expect(familyWingSignInUrl('https://schnubsy.github.io/optimo/?view=week')).toBe(
      'https://schnubsy.github.io/press/optimo.html?return=https%3A%2F%2Fschnubsy.github.io%2Foptimo%2F%3Fview%3Dweek',
    )
    expect(familyWingDoorUrl()).toBe('https://schnubsy.github.io/press/index.html?view=family')
  })

  it('the launcher only bounces back to optimo on its own origin', () => {
    const at = 'https://schnubsy.github.io/press/optimo.html?return=x'
    expect(isOptimoReturn('https://schnubsy.github.io/optimo/', at)).toBe(true)
    expect(isOptimoReturn('https://schnubsy.github.io/optimo/?view=week#x', at)).toBe(true)
    expect(isOptimoReturn('https://evil.example/optimo/', at)).toBe(false)
    expect(isOptimoReturn('https://schnubsy.github.io/press/', at)).toBe(false)
    expect(isOptimoReturn('javascript:alert(1)', at)).toBe(false)
    expect(isOptimoReturn('/optimo/', at)).toBe(false)
    expect(isOptimoReturn(null, at)).toBe(false)
    expect(isOptimoReturn('http://localhost:4173/optimo/', 'http://localhost:4173/optimo/optimo.html')).toBe(true)
  })
})
