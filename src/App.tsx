import { useSession } from './auth/session'
import { SignIn } from './components/SignIn'
import { Planner } from './Planner'

export function App() {
  const auth = useSession()
  if (auth.status === 'loading') return <main className="boot" aria-busy="true" />
  if (auth.status === 'signed-out') return <SignIn />
  return <Planner userId={auth.session.user.id} />
}
