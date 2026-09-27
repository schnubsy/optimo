import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './data/db'
import * as repo from './data/repo'
import { SyncEngine } from './sync/engine'
import { supabase } from './sync/remote'
import { SyncBadge } from './components/SyncBadge'
import { formatDayTitle } from './lib/time'

function useSyncEngine(userId: string) {
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    const engine = new SyncEngine(sb, userId)
    void engine.start()
    try {
      if (localStorage.getItem('optimo.test') === '1') Object.assign(window, { __optimo: { db, repo, engine } })
    } catch {
      /* no storage */
    }
    return () => engine.stop()
  }, [userId])
}

export function Planner({ userId }: { userId: string }) {
  useSyncEngine(userId)
  const tasks = useLiveQuery(() => db.tasks.where('_kind').anyOf('inbox', 'sched').toArray(), [])
  return (
    <main className="shell">
      <header className="strip">
        <h1>{formatDayTitle(new Date())}</h1>
        <SyncBadge />
      </header>
      <ul data-testid="task-list">
        {tasks?.map((t) => (
          <li key={t.id} data-id={t.id}>
            <b>{t.title}</b> <span>{t.notes}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
