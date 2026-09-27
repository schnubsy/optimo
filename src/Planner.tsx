import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './data/db'
import * as repo from './data/repo'
import { useCategories, useSettings } from './data/hooks'
import type { Category, SettingsData, Task } from './data/types'
import { SyncEngine } from './sync/engine'
import { supabase } from './sync/remote'
import { useSync } from './state/sync'
import { useUI } from './state/ui'
import { useDrag } from './state/drag'
import { SyncBadge } from './components/SyncBadge'
import { Toast } from './components/Toast'
import { TaskSheet } from './editor/TaskSheet'
import { Day } from './views/Day'
import { Inbox } from './views/Inbox'
import { QuickAdd } from './quickadd/QuickAdd'
import { PlacePicker } from './components/PlacePicker'
import { Categories } from './categories/Categories'
import { IconSheet } from './icons/IconSheet'
import { Week, WEEK_HOUR_PX } from './views/Week'
import { Month } from './views/Month'
import { Settings } from './views/Settings'
import { Focus } from './focus/Focus'
import { startReminders } from './reminders/scheduler'
import { applyTheme } from './lib/theme'
import { keyBefore, inboxOrder } from './inbox/virtual'
import { dayStats } from './views/stats'
import { useItems, type Item } from './timeline/items'
import { timelineEls } from './timeline/Timeline'
import { clampStart, pxToMin, snap } from './timeline/layout'
import { useNow } from './timeline/NowLine'
import { addDays, fmtClock, fmtHours, formatDayTitle, fromKey, nowMinutes, todayKey } from './lib/time'
import { useHourPx, useIsMobile } from './lib/useMedia'
import { deleteItem, moveItem, resizeItem, schedule, toggleComplete, unschedule } from './actions'
import { seedCategories } from './categories/defaults'
import './styles/app.css'

function useSyncEngine(userId: string) {
  useEffect(() => {
    const sb = supabase()
    if (!sb) {
      useSync.getState().set({ state: 'local' })
      return
    }
    const engine = new SyncEngine(sb, userId)
    // seed after the first sync attempt so a device never out-votes categories it has not pulled yet
    void engine.start().then(() => engine.run()).then(seedCategories)
    try {
      if (localStorage.getItem('optimo.test') === '1') Object.assign(window, { __optimo: { db, repo, engine, ui: useUI } })
    } catch {
      /* no storage */
    }
    return () => engine.stop()
  }, [userId])
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

// Prefer the droppable under the pointer (timeline vs inbox rail); fall back to rect overlap for touch.
// Inbox rows beat the inbox container (reorder), and a row never targets itself.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const self = `row:${String(args.active.id).replace(/^inbox:/, '')}`
  const rows = hits.filter((h) => String(h.id).startsWith('row:') && h.id !== self)
  if (rows.length) return rows
  const rest = hits.filter((h) => h.id !== self)
  return rest.length ? rest : rectIntersection(args).filter((h) => h.id !== self)
}

export function Planner({ userId }: { userId: string }) {
  useSyncEngine(userId)
  const settings = useSettings()
  const cats = useCategories()
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
  const { date, view, set, mobileTab: tab } = useUI()
  const isMobile = useIsMobile()
  const hourPx = useHourPx()
  const now = useNow()
  const days = useMemo(() => [date], [date])
  const itemsByDay = useItems(days)
  const items = useMemo(() => {
    if (itemsByDay) performance.mark('optimo:day-data')
    return itemsByDay?.[date] ?? []
  }, [itemsByDay, date])
  const inboxCount = useInboxCount()
  const isToday = date === todayKey()
  const stats = dayStats(items, settings.day_start, settings.day_end, isToday ? now : null)
  useEffect(() => applyTheme(settings.theme), [settings.theme])
  useEffect(() => startReminders(), [])
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // ---------- drag & drop ----------
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 10 } }),
  )
  const dropMinute = useCallback(
    (e: DragMoveEvent | DragEndEvent, day: string): number | null => {
      const a = e.active.data.current as { type: string; item?: Item; task?: Task } | undefined
      if (!a) return null
      if (a.type === 'block' && a.item) {
        const base = a.item.start
        return clampStart(snap(base + pxToMin(e.delta.y, hourPx), settings.snap), a.item.task.duration_min)
      }
      const el = timelineEls.get(day)
      const r = e.active.rect.current.translated
      if (!el || !r) return null
      const min = pxToMin(r.top - el.getBoundingClientRect().top, hourPx)
      return clampStart(snap(min, settings.snap), a.task?.duration_min ?? settings.default_duration)
    },
    [hourPx, settings.snap, settings.default_duration],
  )
  const onDragStart = (e: DragStartEvent) => {
    useDrag.getState().set({ activeId: String(e.active.id) })
    useUI.getState().set({ selectedId: null })
  }
  const onDragMove = (e: DragMoveEvent) => {
    const o = e.over?.data.current as { type: string; day?: string } | undefined
    const a = e.active.data.current as { item?: Item; task?: Task } | undefined
    if (o?.type === 'timeline' && o.day) {
      const m = dropMinute(e, o.day)
      const len = a?.item?.task.duration_min ?? a?.task?.duration_min ?? settings.default_duration
      if (m !== null) {
        const g = useDrag.getState().ghost
        if (!g || g.start !== m || g.day !== o.day) useDrag.getState().set({ ghost: { day: o.day, start: m, len } })
        return
      }
    }
    if (useDrag.getState().ghost) useDrag.getState().set({ ghost: null })
  }
  const onDragEnd = (e: DragEndEvent) => {
    useDrag.getState().set({ ghost: null, activeId: null })
    const o = e.over?.data.current as { type: string; day?: string; task?: Task } | undefined
    const a = e.active.data.current as { type: string; item?: Item; task?: Task } | undefined
    if (!o || !a) return
    if (o.type === 'timeline' && o.day) {
      const m = dropMinute(e, o.day)
      if (m === null) return
      if (a.type === 'block' && a.item) void moveItem(a.item, o.day, m)
      else if (a.task) void schedule(a.task, o.day, m)
    } else if (o.type === 'row' && a.type === 'inbox' && a.task && o.task && a.task.id !== o.task.id) {
      void reorderInbox(a.task, o.task)
    } else if ((o.type === 'inbox' || o.type === 'row') && a.type === 'block' && a.item && !a.item.occurrence) {
      void unschedule(a.item.task)
    } else if (o.type === 'day' && o.day && a.type === 'block' && a.item) {
      const m = clampStart(snap(a.item.start + pxToMin(e.delta.y, WEEK_HOUR_PX), settings.snap), a.item.task.duration_min)
      void moveItem(a.item, o.day, m)
    } else if (o.type === 'day' && o.day && a.task) {
      const col = document.querySelector(`[data-testid="week-col"][data-day="${o.day}"]`)
      const r = e.active.rect.current.translated
      const m = col && r ? snap(pxToMin(r.top - col.getBoundingClientRect().top, WEEK_HOUR_PX), settings.snap) : settings.day_start + 3 * 60
      void schedule(a.task, o.day, clampStart(m, a.task.duration_min))
    }
  }

  // ---------- keyboard map (directions.md cross-cutting #6) ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ui = useUI.getState()
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (cmdK || (e.key === '/' && !isTyping(e.target))) {
        e.preventDefault()
        document.getElementById('quickadd')?.focus()
        return
      }
      if (isTyping(e.target) || ui.editingId || ui.draft || e.metaKey || e.ctrlKey || e.altKey) return
      const sel = itemsRef.current.find((i) => i.key === ui.selectedId)
      const step = settings.snap
      switch (e.key) {
        case 'n':
        case 'N': {
          e.preventDefault()
          const start = Math.ceil(nowMinutes() / 15) * 15
          ui.set({ draft: { start_at: new Date(fromKey(ui.date).getTime() + start * 60000).toISOString(), duration_min: settings.default_duration } })
          return
        }
        case 'd':
        case 'D':
          ui.set({ view: 'day' })
          return
        case 'w':
        case 'W':
          ui.set({ view: 'week' })
          return
        case 'm':
        case 'M':
          ui.set({ view: 'month' })
          return
        case 't':
        case 'T':
          ui.set({ date: todayKey(), view: ui.view === 'focus' ? 'day' : ui.view })
          return
        case 'f':
        case 'F':
          if (sel) ui.set({ focusId: sel.key, view: 'focus' })
          return
        case 'Escape':
          ui.set({ selectedId: null })
          return
      }
      if (!sel) {
        if (e.key === 'ArrowLeft') ui.set({ date: addDays(ui.date, -1) })
        if (e.key === 'ArrowRight') ui.set({ date: addDays(ui.date, 1) })
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const d = e.key === 'ArrowUp' ? -step : step
        if (e.shiftKey) void resizeItem(sel, Math.max(step, sel.task.duration_min + d))
        else void moveItem(sel, ui.date, clampStart(sel.start + d, sel.task.duration_min))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        ui.set({ editingId: sel.key })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void deleteItem(sel)
      } else if (e.key === 'x' || e.key === 'X') {
        void toggleComplete(sel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.snap, settings.default_duration])

  const title = formatDayTitle(fromKey(date))
  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => useDrag.getState().set({ ghost: null, activeId: null })} autoScroll={{ threshold: { x: 0, y: 0.15 } }}>
      <div className={`app ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
        <header className="strip">
          <div className="cell date">
            <button type="button" className="nav" aria-label="Previous day" onClick={() => set({ date: addDays(date, -1) })}>
              ‹
            </button>
            <h1>{isMobile ? title.replace(/ \d{4}$/, '') : title}</h1>
            <button type="button" className="nav" aria-label="Next day" onClick={() => set({ date: addDays(date, 1) })}>
              ›
            </button>
            {!isToday && (
              <button type="button" className="nav today" onClick={() => set({ date: todayKey() })}>
                Today
              </button>
            )}
          </div>
          {isToday && !isMobile && (
            <div className="cell led">
              <span className="k">Now</span>
              <span className="v">{fmtClock(now, settings.clock24)}</span>
            </div>
          )}
          {!isMobile && (
            <div className="cell">
              <span className="k">Planned</span>
              <span className="v" data-testid="stat-planned">{fmtHours(stats.planned)}</span>
            </div>
          )}
          <div className="cell">
            <span className="k">Free</span>
            <span className="v" data-testid="stat-free">{fmtHours(stats.free)}</span>
          </div>
          <div className="cell">
            <span className="k">Done</span>
            <span className="v" data-testid="stat-done">
              {stats.done}/{stats.total}
            </span>
          </div>
          {!isMobile && (
            <div className="cell">
              <span className="k">Late</span>
              <span className="v">{stats.late}</span>
            </div>
          )}
          <div className="cell">
            <span className="k">Unplaced</span>
            <span className="v" data-testid="stat-unplaced">{inboxCount}</span>
          </div>
          <div className="spacer" />
          {!isMobile && (
            <nav className="views" aria-label="Views">
              {(['day', 'week', 'month'] as const).map((v) => (
                <button key={v} type="button" className={`key ${view === v ? 'on' : ''}`} aria-pressed={view === v} onClick={() => set({ view: v })}>
                  <kbd>{v[0].toUpperCase()}</kbd> {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
              <button type="button" className={`key ${view === 'categories' ? 'on' : ''}`} aria-pressed={view === 'categories'} onClick={() => set({ view: 'categories' })}>
                Categories
              </button>
              <button type="button" className={`key ${view === 'settings' ? 'on' : ''}`} aria-pressed={view === 'settings'} onClick={() => set({ view: 'settings' })}>
                Settings
              </button>
            </nav>
          )}
          <div className="cell sync">
            <SyncBadge />
          </div>
        </header>
        {isMobile && <QuickAdd compact />}
        <div className="body">
          {!isMobile && <Inbox cats={catMap} />}
          <main className="pane">
            {!isMobile && (view === 'day' || view === 'week' || view === 'month') && <QuickAdd />}
            {isMobile && tab === 'backlog' ? <Inbox cats={catMap} /> : <ViewSwitch view={view} date={date} items={items} catMap={catMap} settings={settings} />}
          </main>
        </div>
        {isMobile && (
          <nav className="tabs" aria-label="Sections">
            <button type="button" aria-pressed={tab === 'board' && view === 'day'} onClick={() => set({ mobileTab: 'board', view: 'day' })}>
              <b className="mono">D</b>Board
            </button>
            <button type="button" aria-pressed={tab === 'backlog'} onClick={() => set({ mobileTab: 'backlog' })} data-testid="tab-backlog">
              <b className="mono">{inboxCount}</b>Inbox
            </button>
            <button type="button" aria-pressed={tab === 'board' && view === 'week'} onClick={() => set({ mobileTab: 'board', view: 'week' })}>
              <b className="mono">W</b>Week
            </button>
            <button type="button" aria-pressed={tab === 'board' && view === 'settings'} onClick={() => set({ mobileTab: 'board', view: 'settings' })}>
              <b className="mono">≡</b>More
            </button>
          </nav>
        )}
        {!isMobile && (
          <footer className="foot" aria-label="Keyboard">
            <span><kbd>N</kbd> new</span>
            <span><kbd>X</kbd> done</span>
            <span><kbd>↑</kbd><kbd>↓</kbd> move {settings.snap} min</span>
            <span><kbd>⇧</kbd><kbd>↓</kbd> resize</span>
            <span><kbd>Enter</kbd> edit</span>
            <span><kbd>/</kbd> command line</span>
            <span><kbd>←</kbd><kbd>→</kbd> day</span>
          </footer>
        )}
        <TaskSheet />
        <PlacePicker />
        {view === 'focus' && <Focus />}
        <Toast />
      </div>
    </DndContext>
  )
}

async function reorderInbox(moving: Task, target: Task) {
  const list = inboxOrder((await db.tasks.where('_kind').equals('inbox').toArray()).filter((t) => t.id !== moving.id))
  const same = list.filter((t) => t.priority === target.priority)
  await repo.updateTask(moving.id, { sort_key: keyBefore(same, target.id), priority: target.priority })
}

function ViewSwitch({ view, date, items, catMap, settings }: { view: string; date: string; items: Item[]; catMap: Map<string, Category>; settings: SettingsData }) {
  if (view === 'categories') return <Categories />
  if (view === 'icons') return <IconSheet />
  if (view === 'settings') return <Settings />
  if (view === 'week') return <Week date={date} cats={catMap} settings={settings} />
  if (view === 'month') return <Month date={date} cats={catMap} settings={settings} />
  return <Day day={date} items={items} cats={catMap} settings={settings} />
}

function useInboxCount(): number {
  return useLiveQuery(() => db.tasks.where('_kind').equals('inbox').count(), []) ?? 0
}
