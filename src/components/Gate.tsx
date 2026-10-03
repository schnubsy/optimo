import { useEffect } from 'react'
import { familyWingDoorUrl, familyWingSignInUrl } from '../auth/familyWing'
import { signOut } from '../auth/session'
import './gate.css'

/** Not signed in: optimo has no sign-in of its own — hand over to the Family Wing, which sends you back here. */
export function ToFamilyWing() {
  const here = new URL(location.href)
  // `?stay` keeps this page up (link only, no auto-redirect) — the gauntlet's Lighthouse audits optimo's own first
  // paint this way instead of following the hop to press. It is stripped from the return URL.
  const stay = here.searchParams.has('stay')
  here.searchParams.delete('stay')
  const href = familyWingSignInUrl(here.href)
  useEffect(() => {
    if (!stay) location.replace(href)
  }, [href, stay])
  return (
    <main className="gate" aria-busy={!stay} data-testid="to-family-wing">
      <div className="gate-card">
        <h1>
          optimo<span>.</span>
        </h1>
        <p>{stay ? 'optimo opens with your Family Wing sign-in.' : 'Taking you to the Family Wing to sign in…'}</p>
        <div className="gate-actions">
          <a className="gate-btn" href={href}>
            Go to the Family Wing
          </a>
        </div>
      </div>
    </main>
  )
}

/** Signed in to the Family Wing, but optimo isn't switched on for this person (press_access_has is false). */
export function NoAccess({ email }: { email?: string }) {
  return (
    <main className="gate" data-testid="no-access">
      <div className="gate-card">
        <h1>
          optimo<span>.</span>
        </h1>
        <p>
          optimo isn't switched on for you yet — ask Mark.
          {email ? ` You're signed in as ${email}.` : ''}
        </p>
        <div className="gate-actions">
          <a className="gate-btn" href={familyWingDoorUrl()}>
            Back to the Family Wing
          </a>
          <button type="button" className="gate-btn secondary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
