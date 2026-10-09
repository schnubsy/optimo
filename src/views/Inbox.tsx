import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useInbox } from '../data/hooks'
import type { Category, Task } from '../data/types'
import { fmtHours } from '../lib/time'
import { useUI } from '../state/ui'
import { useDrag } from '../state/drag'
import { Icon } from '../icons/Icon'
import { taskIcon } from '../quickadd/suggest'
import { useSettings } from '../data/hooks'
import { useIsMobile } from '../lib/useMedia'
import { toggleComplete } from '../actions'
import { ROW_H, filterInbox, inboxOrder, rowWindow } from '../inbox/virtual'

const PRI = ['—', 'P3', 'P2', 'P1']
const PRIO = ['', 'low', 'med', 'high']

/** `20 min` · `1 hr` · `1 hr, 30 min` — the mockup's duration voice. */
export function fmtSpan(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} hr, ${r} min` : `${h} hr`
}

// arc 6 (mockups 07): the day-row node grammar without the spine — 56px disc, title + meta, Place, complete ring
const Row = memo(function Row({ task, cat, top, icon }: { task: Task; cat?: Category; top: number; icon: string }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `inbox:${task.id}`, data: { type: 'inbox', task } })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `row:${task.id}`, data: { type: 'row', task } })
  const activeId = useDrag((s) => s.activeId)
  const over = isOver && activeId?.startsWith('inbox:') && activeId !== `inbox:${task.id}`
  const done = !!task.completed_at
  const title = task.title || 'Untitled'
  return (
    <li
      ref={setDropRef}
      className={`irow cat-${cat?.color ?? 'errand'} ${isDragging ? 'grab' : ''} ${over ? 'over' : ''} ${done ? 'done' : ''}`}
      style={{ top }}
      data-testid="inbox-row"
      data-id={task.id}
    >
      <div className="irow-in" ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}>
        {/* the disc opens the editor — completing is the ring's job */}
        <button type="button" className={`irow-chip ${PRIO[task.priority] ? `prio-${PRIO[task.priority]}` : ''}`} onClick={() => set({ editingId: task.id })} aria-label={`Edit ${title}`} tabIndex={-1}>
          <Icon name={icon} size={26} />
        </button>
        <button type="button" className="irow-main" {...attributes} {...listeners} aria-roledescription="draggable task" aria-label={`${title}, ${fmtSpan(task.duration_min)}${task.priority ? `, priority ${PRI[task.priority]}` : ''}${done ? ', done' : ''}`} onClick={() => set({ editingId: task.id })}>
          <span className="it">{title}</span>
          <span className="im tnum" aria-hidden="true">
            {fmtSpan(task.duration_min)} · <span data-testid="inbox-cat">{cat ? cat.name : 'No category'}</span>
            {task.priority ? ` · ${PRI[task.priority]}` : ''}
          </span>
        </button>
        <button type="button" className="place" onClick={() => set({ placeId: task.id })} aria-label={`Place “${title}”`} data-testid="place">
          Place
        </button>
        <button type="button" className="irow-ring" onClick={() => void toggleComplete({ task })} aria-label={done ? `Mark “${title}” not done` : `Complete “${title}”`} aria-pressed={done} data-testid="inbox-ring">
          <span aria-hidden="true">{done && <Icon name="ui-check" size={12} />}</span>
        </button>
      </div>
    </li>
  )
})

export function Inbox({ cats }: { cats: Map<string, Category> }) {
  const raw = useInbox()
  const settings = useSettings()
  const isMobile = useIsMobile()
  const openWizard = useUI((s) => s.openWizard)
  const [q, setQ] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ top: 0, h: 0 })
  const { setNodeRef, isOver } = useDroppable({ id: 'inbox', data: { type: 'inbox' } })
  const activeId = useDrag((s) => s.activeId)
  const catName = useMemo(() => (id: string | null) => (id ? (cats.get(id)?.name ?? '') : ''), [cats])
  const list = useMemo(() => filterInbox(inboxOrder(raw ?? []), q, catName), [raw, q, catName])
  const total = (raw ?? []).reduce((a, t) => a + t.duration_min, 0)
  const win = rowWindow(view.top, view.h, list.length)
  const empty = !!raw && !raw.length

  useEffect(() => {
    if (!q) return
    performance.mark('optimo:filter-end')
    try {
      performance.measure('optimo:filter', 'optimo:filter-start', 'optimo:filter-end')
    } catch {
      /* ignore */
    }
  }, [q, list])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let raf = 0
    const read = () => setView({ top: el.scrollTop, h: el.clientHeight })
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(read)
    }
    on()
    el.addEventListener('scroll', on, { passive: true })
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', on)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <aside className={`backlog ${isOver && activeId?.startsWith('blk:') ? 'drop' : ''}`} ref={setNodeRef} aria-labelledby="inbox-h" data-testid="inbox">
      <div className="hd">
        {/* arc 7 slice 3: on iPhone the inbox screen has no date header — its title is the page's h1 (axe page-has-heading-one) */}
        {isMobile ? <h1 id="inbox-h">Inbox</h1> : <h2 id="inbox-h">Inbox</h2>}
        {!isMobile && (
          <span className="n tnum">
            <b data-testid="stat-unplaced">{raw?.length ?? 0}</b> in inbox{total ? ` · ${fmtHours(total)}` : ''}
          </span>
        )}
      </div>
      {(!empty || q) && (
        <div className="filter">
          <label htmlFor="inbox-filter" className="sr-only">
            Filter inbox
          </label>
          <input
            id="inbox-filter"
            type="search"
            placeholder="Filter"
            value={q}
            onChange={(e) => {
              performance.mark('optimo:filter-start')
              setQ(e.target.value)
            }}
            data-testid="inbox-filter"
          />
        </div>
      )}
      <div className="ilist" ref={scroller}>
        <ul style={{ height: list.length * ROW_H }} aria-label="Unscheduled tasks">
          {list.slice(win.from, win.to).map((t, i) => (
            <Row key={t.id} task={t} cat={cats.get(t.category_id ?? '')} top={(win.from + i) * ROW_H} icon={taskIcon(t.title, cats.get(t.category_id ?? '')?.icon, settings.iconOverrides)} />
          ))}
        </ul>
        {raw && !list.length && q && <p className="inbox-nomatch">Nothing matches.</p>}
      </div>
      {empty && !q && (
        <div className="inbox-empty" data-testid="inbox-empty">
          <span className="inbox-tray" aria-hidden="true">
            <Icon name="ui-inbox" size={isMobile ? 110 : 64} />
          </span>
          <button type="button" className="inbox-new" onClick={() => openWizard('inbox')} data-testid="new-inbox-task">
            <Icon name="ui-plus-circle" size={20} />
            New Inbox Task
          </button>
        </div>
      )}
      <p className="ft">Drag onto the board, or <b>Place</b>: the earliest free slot that fits. Drag a block here to unschedule.</p>
    </aside>
  )
}
