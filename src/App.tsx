import { formatDayTitle } from './lib/time'

export function App() {
  return (
    <main className="shell">
      <h1>{formatDayTitle(new Date())}</h1>
      <p>Day view</p>
    </main>
  )
}
