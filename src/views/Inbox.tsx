import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useInbox } from '../data/hooks'
import type { Category, Task } from '../data/types'
import { fmtDur, fmtHours } from '../lib/time'
import { useUI } from '../state/ui'
import { useDrag } from '../state/drag'
import { Icon } from '../icons/Icon'
import { ROW_H, filterInbox, inboxOrder, rowWindow } from '../inbox/virtual'

const PRI = ['—', 'P3', 'P2', 'P1']
// #3: a fixed short code per default category (a 58px column can't hold "Personal"); other names cut at 4
const SHORT: Record<string, string> = { personal: 'Pers', errands: 'Err', work: 'Work', learning: 'Learn', meetings: 'Meet', family: 'Fam', health: 'Hlth', home: 'Home' }
export const shortCat = (name: string) => SHORT[name.trim().toLowerCase()] ?? name.slice(0, 4)

const Row = memo(function Row({ task, cat, top }: { task: Task; cat?: Category; top: number }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `inbox:${task.id}`, data: { type: 'inbox', task } })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `row:${task.id}`, data: { type: 'row', task } })
  const activeId = useDrag((s) => s.activeId)
  const over = isOver && activeId?.startsWith('inbox:') && activeId !== `inbox:${task.id}`
  return (
    <li
      ref={setDropRef}
      className={`irow cat-${cat?.color ?? 'errand'} ${isDragging ? 'grab' : ''} ${over ? 'over' : ''}`}
      style={{ top }}
      data-testid="inbox-row"
      data-id={task.id}
    >
      <div className="irow-in" ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}>
        <button type="button" className="irow-main" {...attributes} {...listeners} aria-roledescription="draggable task" aria-label={`${task.title || 'Untitled'}, ${fmtDur(task.duration_min)}${task.priority ? `, priority ${PRI[task.priority]}` : ''}`} onClick={() => set({ editingId: task.id })}>
          <span className="it">{task.title || 'Untitled'}</span>
          <span className="ic-cat" aria-hidden="true">
            <i />
            <Icon name={cat?.icon ?? 'dot'} size={12} />
            <span data-testid="inbox-cat">{cat ? shortCat(cat.name) : ''}</span>
          </span>
          <span className="num mono" aria-hidden="true">{fmtDur(task.duration_min)}</span>
          <span className="pri mono" aria-hidden="true">{task.priority ? PRI[task.priority] : ''}</span>
        </button>
        <button type="button" className="place" onClick={() => set({ placeId: task.id })} aria-label={`Place “${task.title}”`} data-testid="place">
          Place
        </button>
      </div>
    </li>
  )
})

export function Inbox({ cats }: { cats: Map<string, Category> }) {
  const raw = useInbox()
  const [q, setQ] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ top: 0, h: 0 })
  const { setNodeRef, isOver } = useDroppable({ id: 'inbox', data: { type: 'inbox' } })
  const activeId = useDrag((s) => s.activeId)
  const catName = useMemo(() => (id: string | null) => (id ? (cats.get(id)?.name ?? '') : ''), [cats])
  const list = useMemo(() => filterInbox(inboxOrder(raw ?? []), q, catName), [raw, q, catName])
  const total = list.reduce((a, t) => a + t.duration_min, 0)
  const win = rowWindow(view.top, view.h, list.length)

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
        <h2 id="inbox-h">Inbox</h2>
        <span className="n mono">
          {list.length} items, {fmtHours(total)}
        </span>
      </div>
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
      <div className="ilist" ref={scroller}>
        <ul style={{ height: list.length * ROW_H }} aria-label="Unscheduled tasks">
          {list.slice(win.from, win.to).map((t, i) => (
            <Row key={t.id} task={t} cat={cats.get(t.category_id ?? '')} top={(win.from + i) * ROW_H} />
          ))}
        </ul>
        {raw && !list.length && <p className="empty">{q ? 'Nothing matches.' : 'Inbox zero. Capture with the command line.'}</p>}
      </div>
      <p className="ft">Drag onto the board, or <b>Place</b>: the earliest free slot that fits. Drag a block here to unschedule.</p>
    </aside>
  )
}
