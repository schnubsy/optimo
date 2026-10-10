import type { CalendarEvent, Category, Task } from '../data/types'
import { useUI } from '../state/ui'

export function AllDayStrip({ tasks, events = [], cats }: { tasks: Task[]; events?: CalendarEvent[]; cats: Map<string, Category> }) {
  const set = useUI((s) => s.set)
  if (!tasks.length && !events.length) return null
  return (
    <div className="allday" aria-label="All-day">
      <span className="allday-k">All day</span>
      {tasks.map((t) => (
        <button key={t.id} type="button" className={`allday-t cat-${cats.get(t.category_id ?? '')?.color ?? 'errand'} ${t.completed_at ? 'done' : ''}`} onClick={() => set({ editingId: t.id })} data-testid="allday-chip">
          {t.title || 'Untitled'}
        </button>
      ))}
      {events.map((e) => (
        <span key={e.id} className="allday-t allday-evt" data-testid="event" data-uid={e.uid} title={`${e.title} · calendar event`}>
          {e.title || 'Busy'}
        </span>
      ))}
    </div>
  )
}
