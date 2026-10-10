import { useEffect, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { usePlanned } from '../data/hooks'
import type { Category, SettingsData, Task } from '../data/types'
import { Icon } from '../icons/Icon'
import { taskIcon } from '../quickadd/suggest'
import { addDays, fromKey, todayKey, weekdayName } from '../lib/time'
import { useUI } from '../state/ui'
import { useDrag } from '../state/drag'
import { useIsMobile } from '../lib/useMedia'
import { dayWord, durShort } from '../capture/decide'
import { processTo } from '../inbox/process'
import '../capture/capture.css'

/** "Fit these into my day: Dentist (30m), Call plumber (~30m)" — the AI tab's prefilled intent (pure). */
export function fitIntent(tasks: Pick<Task, 'title' | 'duration_min' | 'estimated'>[]): string {
  const parts = tasks.map((t) => `${t.title || 'Untitled'} (${t.estimated ? '' : '~'}${durShort(t.duration_min)})`)
  return `Fit these into my day: ${parts.join(', ')}`
}

/** `from Tue` for an overdue roll-forward (planned for an earlier day, shown on today's tray). */
export function fromTag(planDate: string | null, day: string, today: string): string | null {
  if (!planDate || day !== today || planDate >= today) return null
  const back = Math.round((fromKey(today).getTime() - fromKey(planDate).getTime()) / 86_400_000)
  return back < 7 ? `from ${weekdayName(fromKey(planDate))}` : `from ${dayWord(planDate, today)}`
}

function TrayChip({ task, day, today, cat, icon, open, onOpen }: { task: Task; day: string; today: string; cat?: Category; icon: string; open: boolean; onOpen: (id: string | null) => void }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `tray:${task.id}`, data: { type: 'inbox', task } })
  const title = task.title || 'Untitled'
  const from = fromTag(task.plan_date, day, today)
  const est = task.estimated ? durShort(task.duration_min) : 'no estimate'
  const menu = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('button')?.focus()
    const onDown = (e: PointerEvent) => !(e.target as HTMLElement).closest(`[data-tray-id="${task.id}"]`) && onOpen(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onOpen(null)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpen, task.id])
  const act = (fn: () => void) => () => {
    onOpen(null)
    fn()
  }
  const tomorrow = addDays(day < today ? today : day, 1)
  return (
    <li data-tray-id={task.id}>
      <button
        ref={setNodeRef}
        type="button"
        className={`tray-chip cat-${cat?.color ?? 'errand'} ${isDragging ? 'grab' : ''}`}
        style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
        {...attributes}
        {...listeners}
        aria-roledescription="draggable task"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${title}, ${est}${from ? `, ${from}` : ''}`}
        onClick={() => onOpen(open ? null : task.id)}
        data-testid="tray-chip"
        data-id={task.id}
      >
        <span className="tray-disc" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="tray-t">{title}</span>
        <span className={`tray-est tnum ${task.estimated ? '' : 'none'}`} aria-hidden="true">
          {task.estimated ? durShort(task.duration_min) : '—'}
        </span>
        {from && (
          <span className="tray-from" aria-hidden="true" data-testid="tray-from">
            {from}
          </span>
        )}
      </button>
      {open && (
        <ul ref={menu} className="tray-menu" role="menu" aria-label={title} data-testid="tray-menu">
          <li role="none">
            <button type="button" role="menuitem" onClick={act(() => set({ placeId: task.id }))} data-testid="tray-place">
              Place in a free slot
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={act(() => set({ editingId: task.id, editStep: 2 }))} data-testid="tray-time">
              Pick a time
            </button>
          </li>
          <li role="none" className="sep" />
          <li role="none">
            <button type="button" role="menuitem" onClick={act(() => void processTo(task, { to: 'day', date: tomorrow }))} data-testid="tray-tomorrow">
              Move to {dayWord(tomorrow, today).toLowerCase() === 'tomorrow' ? 'tomorrow' : dayWord(tomorrow, today)}
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={act(() => void processTo(task, { to: 'inbox' }))} data-testid="tray-inbox">
              Back to inbox
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={act(() => void processTo(task, { to: 'someday' }))} data-testid="tray-someday">
              Someday
            </button>
          </li>
        </ul>
      )}
    </li>
  )
}

/**
 * arc 7 slice 9 — "To place · n" over the day timeline: that day's planned (untimed) items as chips; today's tray also
 * holds unfinished items rolled forward from earlier days ("from Tue"). Drag a chip onto the timeline to schedule it,
 * or tap it for Place / Pick a time / move. The tray is the day's `plan` drop target (Planner's drop branch plans the
 * dragged item for this day); hidden when empty, except as a slim drop zone while anything is being dragged.
 */
export function DayTray({ day, cats, settings }: { day: string; cats: Map<string, Category>; settings: SettingsData }) {
  const today = todayKey()
  const planned = usePlanned(day, today)
  const items = (planned ?? []).filter((t) => !t.completed_at)
  const set = useUI((s) => s.set)
  const panel = useUI((s) => s.panel)
  const isMobile = useIsMobile()
  const dragging = useDrag((s) => !!s.activeId)
  const { setNodeRef, isOver } = useDroppable({ id: `plan:${day}`, data: { type: 'plan', day } })
  const [openId, setOpenId] = useState<string | null>(null)
  // iPhone: the collapsed panel's peek is the timeline's first row — the tray steps aside there
  if (isMobile && panel === 'week') return null
  if (!items.length) {
    if (!dragging) return null
    return (
      <div ref={setNodeRef} className={`tray-drop ${isOver ? 'over' : ''}`} data-testid="tray-drop" data-day={day}>
        Drop to plan for {dayWord(day, today).toLowerCase() === 'today' ? 'today' : dayWord(day, today)}
      </div>
    )
  }
  const fit = () => {
    set({ planIntent: fitIntent(items), view: 'plan', mobileTab: 'board', date: day < today ? today : day })
  }
  return (
    <section ref={setNodeRef} className={`tray ${isOver ? 'over' : ''}`} aria-labelledby={`tray-h-${day}`} data-testid="tray" data-day={day}>
      <div className="tray-hd">
        <h2 id={`tray-h-${day}`} className="tray-h">
          To place · <b className="tnum" data-testid="tray-count">{items.length}</b>
        </h2>
        {items.length >= 2 && (
          <button type="button" className="tray-ai" onClick={fit} data-testid="tray-fit">
            <Icon name="ui-ai" size={16} />
            Fit with AI
          </button>
        )}
      </div>
      <ul className="tray-list" aria-label={`To place on ${dayWord(day, today)}`}>
        {items.map((t) => {
          const cat = cats.get(t.category_id ?? '')
          return <TrayChip key={t.id} task={t} day={day} today={today} cat={cat} icon={taskIcon(t.title, cat?.icon, settings.iconOverrides)} open={openId === t.id} onOpen={setOpenId} />
        })}
      </ul>
    </section>
  )
}
