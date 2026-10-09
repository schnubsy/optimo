import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useInbox, useSomeday } from '../data/hooks'
import type { Category, Task } from '../data/types'
import { todayKey } from '../lib/time'
import { useUI } from '../state/ui'
import { useDrag } from '../state/drag'
import { Icon } from '../icons/Icon'
import { taskIcon } from '../quickadd/suggest'
import { useSettings } from '../data/hooks'
import { useIsMobile } from '../lib/useMedia'
import { toggleComplete } from '../actions'
import { ROW_H, filterInbox, inboxOrder, rowWindow } from '../inbox/virtual'
import { ESTIMATES, estimate, processTo, type ProcessTo } from '../inbox/process'
import { durShort } from '../capture/decide'

const PRI = ['—', 'P3', 'P2', 'P1']
const PRIO = ['', 'low', 'med', 'high']
/** arc 7 slice 8: the processing panel under an expanded row (two chip rows) — rows below it shift down by this. */
export const PROC_H = 104

/** `20 min` · `1 hr` · `1 hr, 30 min` — the mockup's duration voice. */
export function fmtSpan(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} hr, ${r} min` : `${h} hr`
}

/** A row's keys while it (or a control in it) has focus: T today · M tomorrow · S Someday · 1–4 estimates · 0 none ·
 *  E edit. They shadow the global T (today) / M (month) only inside an inbox row. */
export function processKey(key: string): ProcessTo | { estimate: number | null } | 'edit' | null {
  switch (key.toLowerCase()) {
    case 't':
      return { to: 'today' }
    case 'm':
      return { to: 'tomorrow' }
    case 's':
      return { to: 'someday' }
    case 'e':
      return 'edit'
    case '0':
      return { estimate: null }
  }
  const i = '1234'.indexOf(key)
  return i >= 0 ? { estimate: ESTIMATES[i] } : null
}

/** "Pick day": a native date input opened from a chip (showPicker where there is one). */
function PickDay({ task, label, testid = 'process-day' }: { task: Task; label?: boolean; testid?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    const el = ref.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }
  return (
    <span className="proc-pick">
      <button type="button" className="proc-chip" onClick={open} aria-label={`Pick a day for “${task.title || 'Untitled'}”`} data-testid={`${testid}-btn`}>
        {label === false ? <Icon name="ui-calendar" size={16} /> : <span className="proc-l">Pick day</span>}
      </button>
      <input
        ref={ref}
        type="date"
        className="proc-date"
        min={todayKey()}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => e.target.value && void processTo(task, { to: 'day', date: e.target.value })}
        data-testid={testid}
      />
    </span>
  )
}

/** The processing panel: where it goes (Today · Tomorrow · Pick day · Someday) and how long (15 · 30 · 60 · 90 · ?). */
function Process({ task, mobile }: { task: Task; mobile: boolean }) {
  const title = task.title || 'Untitled'
  return (
    <div className="proc" data-testid="inbox-process">
      <div className="proc-row" role="group" aria-label={`Plan “${title}”`}>
        <button type="button" className="proc-chip" onClick={() => void processTo(task, { to: 'today' })} data-testid="process-today">
          Today
        </button>
        <button type="button" className="proc-chip" onClick={() => void processTo(task, { to: 'tomorrow' })} data-testid="process-tomorrow">
          Tomorrow
        </button>
        <PickDay task={task} label={mobile} />
        <button type="button" className="proc-chip" onClick={() => void processTo(task, { to: 'someday' })} data-testid="process-someday">
          Someday
        </button>
      </div>
      <div className="proc-row" role="group" aria-label={`Estimate for “${title}”`}>
        {mobile && <span className="proc-k" aria-hidden="true">Estimate</span>}
        {ESTIMATES.map((m) => (
          <button key={m} type="button" className="proc-chip est" aria-pressed={task.estimated && task.duration_min === m} aria-label={`${m} minutes`} onClick={() => void estimate(task, m)} data-testid={`estimate-${m}`}>
            {m}
          </button>
        ))}
        <button type="button" className="proc-chip est" aria-pressed={!task.estimated} aria-label="No estimate" onClick={() => void estimate(task, null)} data-testid="estimate-none">
          ?
        </button>
      </div>
    </div>
  )
}

// arc 6 (mockups 07): the day-row node grammar without the spine — 56px disc, title + meta, Place, complete ring.
// arc 7 slice 8: the row body expands the processing panel; the disc opens the editor.
const Row = memo(function Row({ task, cat, top, icon, open, mobile, onToggle }: { task: Task; cat?: Category; top: number; icon: string; open: boolean; mobile: boolean; onToggle: (id: string) => void }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `inbox:${task.id}`, data: { type: 'inbox', task } })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `row:${task.id}`, data: { type: 'row', task } })
  const activeId = useDrag((s) => s.activeId)
  const over = isOver && activeId?.startsWith('inbox:') && activeId !== `inbox:${task.id}`
  const done = !!task.completed_at
  const title = task.title || 'Untitled'
  const span = task.estimated ? fmtSpan(task.duration_min) : 'no estimate'
  function onKey(e: ReactKeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).tagName === 'INPUT') return
    const k = processKey(e.key)
    if (!k) return
    e.preventDefault()
    e.stopPropagation() // the global map's T / M must not fire for a row's keys
    if (k === 'edit') set({ editingId: task.id })
    else if ('estimate' in k) void estimate(task, k.estimate)
    else void processTo(task, k)
  }
  return (
    <li
      ref={setDropRef}
      className={`irow cat-${cat?.color ?? 'errand'} ${isDragging ? 'grab' : ''} ${over ? 'over' : ''} ${done ? 'done' : ''} ${open ? 'open' : ''}`}
      style={{ top, ...(open ? { height: ROW_H - 8 + PROC_H } : {}) }}
      data-testid="inbox-row"
      data-id={task.id}
      data-open={open || undefined}
      onKeyDown={onKey}
    >
      <div className="irow-in" ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}>
        {/* the disc opens the editor — completing is the ring's job */}
        <button type="button" className={`irow-chip ${PRIO[task.priority] ? `prio-${PRIO[task.priority]}` : ''}`} onClick={() => set({ editingId: task.id })} aria-label={`Edit ${title}`} tabIndex={-1}>
          <Icon name={icon} size={26} />
        </button>
        <button
          type="button"
          className="irow-main"
          {...attributes}
          {...listeners}
          aria-roledescription="draggable task"
          aria-expanded={open}
          aria-keyshortcuts="T M S 1 2 3 4 0 E"
          aria-label={`${title}, ${span}${task.priority ? `, priority ${PRI[task.priority]}` : ''}${done ? ', done' : ''}`}
          onClick={() => onToggle(task.id)}
          data-testid="inbox-main"
        >
          <span className="it">{title}</span>
          <span className="im tnum" aria-hidden="true">
            <span className={task.estimated ? '' : 'noest'} data-testid="inbox-est">{span}</span> · <span data-testid="inbox-cat">{cat ? cat.name : 'No category'}</span>
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
      {open && <Process task={task} mobile={mobile} />}
    </li>
  )
})

/** A Someday row: drag it out, or send it back (Inbox · Today · Pick day). */
function SomedayRow({ task, cat, icon }: { task: Task; cat?: Category; icon: string }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `someday:${task.id}`, data: { type: 'inbox', task } })
  const title = task.title || 'Untitled'
  return (
    <li className={`srow cat-${cat?.color ?? 'errand'} ${isDragging ? 'grab' : ''}`} data-testid="someday-row" data-id={task.id}>
      <div className="srow-in" ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}>
        <button type="button" className="srow-main" {...attributes} {...listeners} aria-roledescription="draggable task" aria-label={`${title}, Someday. Edit`} onClick={() => set({ editingId: task.id })}>
          <span className="srow-disc" aria-hidden="true">
            <Icon name={icon} size={16} />
          </span>
          <span className="it">{title}</span>
          {task.estimated && <span className="srow-est tnum">{durShort(task.duration_min)}</span>}
        </button>
        <div className="srow-acts" role="group" aria-label={`Move “${title}”`}>
          <button type="button" className="proc-chip" onClick={() => void processTo(task, { to: 'inbox' })} aria-label={`Back to inbox: ${title}`} data-testid="someday-inbox">
            <Icon name="ui-inbox" size={16} />
          </button>
          <button type="button" className="proc-chip" onClick={() => void processTo(task, { to: 'today' })} data-testid="someday-today">
            Today
          </button>
          <PickDay task={task} label={false} testid="someday-day" />
        </div>
      </div>
    </li>
  )
}

function Someday({ cats, overrides }: { cats: Map<string, Category>; overrides?: Record<string, string> }) {
  const list = useSomeday()
  const [open, setOpen] = useState(false)
  if (!list?.length) return null
  return (
    <section className="someday" aria-labelledby="someday-h" data-testid="someday">
      <button type="button" id="someday-h" className="someday-toggle" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="someday-toggle">
        <Icon name="ui-chevron-right" size={16} />
        Someday <span className="tnum">({list.length})</span>
      </button>
      {open && (
        <ul className="someday-list" aria-label="Someday">
          {list.map((t) => {
            const cat = cats.get(t.category_id ?? '')
            return <SomedayRow key={t.id} task={t} cat={cat} icon={taskIcon(t.title, cat?.icon, overrides)} />
          })}
        </ul>
      )}
    </section>
  )
}

export function Inbox({ cats }: { cats: Map<string, Category> }) {
  const raw = useInbox()
  const settings = useSettings()
  const isMobile = useIsMobile()
  const openWizard = useUI((s) => s.openWizard)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ top: 0, h: 0 })
  const { setNodeRef, isOver } = useDroppable({ id: 'inbox', data: { type: 'inbox' } })
  const activeId = useDrag((s) => s.activeId)
  const catName = useMemo(() => (id: string | null) => (id ? (cats.get(id)?.name ?? '') : ''), [cats])
  const list = useMemo(() => filterInbox(inboxOrder(raw ?? []), q, catName), [raw, q, catName])
  const waiting = (raw ?? []).filter((t) => !t.completed_at)
  const total = waiting.reduce((a, t) => a + (t.estimated ? t.duration_min : 0), 0)
  const openAt = openId ? list.findIndex((t) => t.id === openId) : -1
  const extra = openAt >= 0 ? PROC_H - 8 : 0
  const win = rowWindow(view.top, view.h, list.length)
  const empty = !!raw && !raw.length
  const toggle = useMemo(() => (id: string) => setOpenId((cur) => (cur === id ? null : id)), [])

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
        {/* arc 7 slice 6: the count line is back on iPhone too — unfinished items, and the hours of those estimated */}
        {!empty && (
          <span className="n tnum" data-testid="inbox-count">
            <b data-testid="stat-unplaced">{waiting.length}</b> in inbox{total ? ` · ${durShort(total)}` : ''}
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
        <ul style={{ height: list.length * ROW_H + extra }} aria-label="Unscheduled tasks">
          {list.slice(win.from, win.to).map((t, i) => {
            const at = win.from + i
            return (
              <Row
                key={t.id}
                task={t}
                cat={cats.get(t.category_id ?? '')}
                top={at * ROW_H + (openAt >= 0 && at > openAt ? extra : 0)}
                icon={taskIcon(t.title, cats.get(t.category_id ?? '')?.icon, settings.iconOverrides)}
                open={t.id === openId}
                mobile={isMobile}
                onToggle={toggle}
              />
            )
          })}
        </ul>
        {raw && !list.length && q && <p className="inbox-nomatch">Nothing matches.</p>}
        {!q && <Someday cats={cats} overrides={settings.iconOverrides} />}
      </div>
      {empty && !q && (
        <div className="inbox-empty" data-testid="inbox-empty">
          <span className="inbox-tray" aria-hidden="true">
            <Icon name="ui-inbox" size={isMobile ? 110 : 64} />
          </span>
          <p className="inbox-zero" data-testid="inbox-zero">
            <b>All sorted.</b> Nothing is waiting for a day.
          </p>
          <button type="button" className="inbox-new" onClick={() => openWizard('inbox')} data-testid="new-inbox-task">
            <Icon name="ui-plus-circle" size={20} />
            New Inbox Task
          </button>
        </div>
      )}
      <p className="ft">
        Click a row to give it a day or an estimate. Drag onto the board, or <b>Place</b>: the earliest free slot that fits.
      </p>
    </aside>
  )
}
