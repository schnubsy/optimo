import type { Category, Task } from '../data/types'
import { useUI } from '../state/ui'

export function AllDayStrip({ tasks, cats }: { tasks: Task[]; cats: Map<string, Category> }) {
  const set = useUI((s) => s.set)
  if (!tasks.length) return null
  return (
    <div className="allday" aria-label="All-day">
      <span className="allday-k">All day</span>
      {tasks.map((t) => (
        <button key={t.id} type="button" className={`allday-t cat-${cats.get(t.category_id ?? '')?.color ?? 'errand'} ${t.completed_at ? 'done' : ''}`} onClick={() => set({ editingId: t.id })}>
          {t.title || 'Untitled'}
        </button>
      ))}
    </div>
  )
}
