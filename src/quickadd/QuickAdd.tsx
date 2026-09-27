import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import * as repo from '../data/repo'
import { useCategories, useSettings } from '../data/hooks'
import type { Category } from '../data/types'
import { dateKey, fmtClock, fmtDur, formatDayTitle, todayKey } from '../lib/time'
import { resolveIcon } from '../icons/glyphs'
import { useUI } from '../state/ui'
import { parseQuickAdd, type Parsed } from './parse'

function resolveCategory(p: Parsed, cats: Category[]): Category | null {
  if (p.category) {
    const q = p.category.toLowerCase()
    const hit = cats.find((c) => c.name.toLowerCase() === q) ?? cats.find((c) => c.name.toLowerCase().startsWith(q) || c.color === q)
    if (hit) return hit
  }
  const icon = resolveIcon(p.icon)
  return icon ? (cats.find((c) => c.icon === icon) ?? null) : null
}

export function toInput(p: Parsed, cat: Category | null, defaultDuration: number): repo.TaskInput & { start_at: string | null } {
  const start_at = p.start ? p.start.toISOString() : null
  return {
    title: p.title,
    start_at,
    all_day: p.dateOnly,
    duration_min: p.duration ?? defaultDuration,
    category_id: cat?.id ?? null,
    priority: p.priority,
    sort_key: Date.now(),
    ...(p.rrule ? { rrule: p.rrule, dtstart: start_at } : {}),
  }
}

/** The command line: parse preview before commit, Enter adds, Tab edits fields in the sheet, Esc clears. */
export function QuickAdd({ compact }: { compact?: boolean }) {
  const [text, setText] = useState('')
  const cats = useCategories()
  const settings = useSettings()
  const set = useUI((s) => s.set)
  const notify = useUI((s) => s.notify)
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text])
  const cat = parsed ? resolveCategory(parsed, cats) : null

  async function commit(e?: FormEvent) {
    e?.preventDefault()
    if (!parsed || !parsed.title) return
    const t = await repo.createTask(toInput(parsed, cat, settings.default_duration))
    setText('')
    if (t.start_at && !t.rrule) set({ date: dateKey(new Date(t.start_at)) })
    notify({ text: t.start_at ? `Added “${t.title}”` : `“${t.title}” → inbox`, undo: () => repo.deleteTask(t.id).then(() => undefined) })
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setText('')
      e.currentTarget.blur()
    } else if (e.key === 'Tab' && parsed && !e.shiftKey) {
      e.preventDefault()
      set({ draft: toInput(parsed, cat, settings.default_duration) })
      setText('')
    }
  }

  const when = parsed?.start
    ? parsed.dateOnly
      ? dateKey(parsed.start) === todayKey()
        ? 'today, all day'
        : `${formatDayTitle(parsed.start).slice(0, -5)}, all day`
      : `${dateKey(parsed.start) === todayKey() ? '' : formatDayTitle(parsed.start).slice(0, -5) + ' '}${fmtClock(parsed.start.getHours() * 60 + parsed.start.getMinutes(), settings.clock24)}–${fmtClock(parsed.start.getHours() * 60 + parsed.start.getMinutes() + (parsed.duration ?? settings.default_duration), settings.clock24)}`
    : 'inbox'
  const unknownCat = parsed?.category && !cat

  return (
    <form className={`cmd ${compact ? 'compact' : ''}`} onSubmit={commit} role="search" aria-label="Command line">
      <div className="in">
        <span className="p mono" aria-hidden="true">
          &gt;
        </span>
        <label htmlFor="quickadd" className="sr-only">
          Add a task in plain words
        </label>
        <input
          id="quickadd"
          className="mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={compact ? 'lunch with Sam at 1pm' : 'lunch with Sam at 1pm for 1h #personal !'}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          data-testid="quickadd"
          aria-describedby="parse-row"
        />
        {compact && (
          <button type="submit" className="go" disabled={!parsed?.title}>
            Add
          </button>
        )}
      </div>
      <div className={`parse ${parsed ? '' : 'idle'}`} id="parse-row" aria-live="polite" data-testid="parse-row">
        {parsed ? (
          <>
            <span>parsed:</span>
            <b>{parsed.title || '(no title)'}</b>
            <span className="f mono">{when}</span>
            {(parsed.duration !== null || (parsed.start && !parsed.dateOnly)) && <span className="f mono" data-testid="parse-duration">{fmtDur(parsed.duration ?? settings.default_duration)}</span>}
            {cat && <span>{cat.name}</span>}
            {unknownCat && <span>#{parsed.category}? (no such category)</span>}
            {parsed.priority > 0 && <span className="f mono">{['', 'P3', 'P2', 'P1'][parsed.priority]}</span>}
            {parsed.repeatLabel && <span>↻ {parsed.repeatLabel}</span>}
          </>
        ) : (
          <span className="muted">Type a task; time, “for 45m”, #category, ! priority and “every …” are understood.</span>
        )}
        {!compact && (
          <span className="hint">
            <kbd>Enter</kbd> add <kbd>Tab</kbd> edit fields <kbd>Esc</kbd> clear
          </span>
        )}
      </div>
    </form>
  )
}
