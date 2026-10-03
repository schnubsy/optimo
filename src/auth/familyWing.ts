// Where optimo sends people who aren't signed in (arc 5a, B1). press has no return-to of its own, so optimo's own
// Family Wing launcher card (src-press/optimo.html → press/optimo.html) runs the unchanged Family Wing sign-in and
// then bounces back to `return` — but only to an optimo URL on the same origin (see isOptimoReturn, mirrored there).

export const PRESS_BASE = 'https://schnubsy.github.io/press/'

export function familyWingSignInUrl(here: string, base = PRESS_BASE): string {
  return `${base}optimo.html?return=${encodeURIComponent(here)}`
}

export function familyWingDoorUrl(base = PRESS_BASE): string {
  return `${base}index.html?view=family`
}

/** The launcher's allowlist: same origin as the launcher, path under /optimo/. Anything else is ignored. */
export function isOptimoReturn(ret: string | null, launcherHref: string): boolean {
  if (!ret) return false
  try {
    const u = new URL(ret)
    const here = new URL(launcherHref)
    return u.origin === here.origin && (u.protocol === 'https:' || u.hostname === 'localhost') && u.pathname.startsWith('/optimo/')
  } catch {
    return false
  }
}
