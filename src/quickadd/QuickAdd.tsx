import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import * as repo from '../data/repo'
import { useCategories, useSettings } from '../data/hooks'
import type { Category, SettingsData } from '../data/types'
import { dateKey, fmtClock, fmtDur, formatDayTitle, todayKey } from '../lib/time'
import { resolveIcon } from '../icons/set'
import { Icon } from '../icons/Icon'
import { GlyphPicker } from '../icons/GlyphPicker'
import { CATEGORY_OF, suggestIcon, titleStem } from './suggest'
import { useUI } from '../state/ui'
import { parseQuickAdd, type Parsed } from './parse'

/** Height the on-screen keyboard takes from the layout viewport (0 when closed). */
export function keyboardInset(innerHeight: number, vvHeight: number, vvOffsetTop: number): number {
  return Math.max(0, Math.round(innerHeight - vvHeight - vvOffsetTop))
}

/**
 * Keeps `el` above the on-screen keyboard: writes `--kb-inset` (px) while `active` — the visual viewport shrinks
 * when the keyboard opens (A2-P0-4). Used by the wizard's floating Continue.
 */
export function useKeyboardInset(el: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const on = () => el.current?.style.setProperty('--kb-inset', `${keyboardInset(window.innerHeight, vv.height, vv.offsetTop)}px`)
    on()
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => {
      vv.removeEventListener('resize', on)
      vv.removeEventListener('scroll', on)
    }
  }, [el, active])
}

/** The category a parse points at: `#name` → `@icon` → the keyword map's suggestion onto the default of that colour. */
export function resolveCategory(p: Parsed, cats: Category[]): Category | null {
  if (p.category) {
    const q = p.category.toLowerCase()
    const hit = cats.find((c) => c.name.toLowerCase() === q) ?? cats.find((c) => c.name.toLowerCase().startsWith(q) || c.color === q)
    if (hit) return hit
  }
  if (p.icon) {
    const icon = resolveIcon(p.icon)
    const hit = cats.find((c) => resolveIcon(c.icon) === icon)
    if (hit) return hit
  }
  // no explicit category: the keyword map's suggestion, onto the default category of that colour
  const slug = suggestIcon(p.title)?.category
  return slug ? (cats.find((c) => c.color === CATEGORY_OF[slug]) ?? null) : null
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

/** The parse preview's "when" chip: `13:00–13:30`, `Sat 26 Sep 09:00–09:15`, `today, all day` or `inbox`. */
export function parseWhen(parsed: Parsed, settings: Pick<SettingsData, 'clock24' | 'default_duration'>): string {
  if (!parsed.start) return 'inbox'
  const day = dateKey(parsed.start) === todayKey()
  if (parsed.dateOnly) return day ? 'today, all day' : `${formatDayTitle(parsed.start).slice(0, -5)}, all day`
  const m = parsed.start.getHours() * 60 + parsed.start.getMinutes()
  return `${day ? '' : formatDayTitle(parsed.start).slice(0, -5) + ' '}${fmtClock(m, settings.clock24)}–${fmtClock(m + (parsed.duration ?? settings.default_duration), settings.clock24)}`
}

/**
 * The desktop header command line: parse preview before commit, Enter adds, Tab opens the create wizard prefilled,
 * Esc clears. (The iPhone FAB opens the wizard, whose title field reuses this parser.)
 */
export function QuickAdd({ compact, onDone }: { compact?: boolean; onDone?: () => void }) {
  const [text, setText] = useState('')
  const [picking, setPicking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const cats = useCategories()
  const settings = useSettings()
  const set = useUI((s) => s.set)
  const openWizard = useUI((s) => s.openWizard)
  const notify = useUI((s) => s.notify)
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text])
  const cat = parsed ? resolveCategory(parsed, cats) : null
  const suggested = parsed?.title ? (suggestIcon(parsed.title, settings.iconOverrides)?.icon ?? cat?.icon ?? 'work-document') : null
  function pickIcon(icon: string) {
    if (!parsed?.title) return
    void repo.updateSettings({ iconOverrides: { ...(settings.iconOverrides ?? {}), [titleStem(parsed.title)]: icon } })
    setPicking(false)
    input.current?.focus()
  }

  async function commit(e?: FormEvent) {
    e?.preventDefault()
    if (!parsed || !parsed.title) return
    const t = await repo.createTask(toInput(parsed, cat, settings.default_duration))
    setText('')
    setPicking(false)
    onDone?.()
    if (t.start_at && !t.rrule) set({ date: dateKey(new Date(t.start_at)) })
    notify({ text: t.start_at ? `Added “${t.title}”` : `“${t.title}” → inbox`, undo: () => repo.deleteTask(t.id).then(() => undefined) })
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setText('')
      e.currentTarget.blur()
      onDone?.()
    } else if (e.key === 'Tab' && parsed && !e.shiftKey) {
      e.preventDefault()
      const draft = toInput(parsed, cat, settings.default_duration)
      openWizard(draft.start_at ? 'timeline' : 'inbox', draft)
      setText('')
    }
  }

  const when = parsed ? parseWhen(parsed, settings) : 'inbox'
  const unknownCat = parsed?.category && !cat

  return (
    <form className={`cmd ${compact ? 'compact' : ''}`} onSubmit={commit} role="search" aria-label="Command line">
      <div className="in">
        <span className="p" aria-hidden="true">
          +
        </span>
        <label htmlFor="quickadd" className="sr-only">
          Add a task in plain words
        </label>
        <input
          id="quickadd"
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={compact ? 'Lunch with Sam at 1pm' : 'Lunch with Sam at 1pm for 1h #personal !'}
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
            {suggested && (
              <button type="button" className={`parse-glyph ${cat ? `cat-${cat.color}` : 'cat-work'}`} aria-label={`Icon ${suggested}, change`} aria-expanded={picking} onClick={() => setPicking(!picking)} data-testid="parse-icon" data-icon={suggested}>
                <Icon name={suggested} size={18} />
              </button>
            )}
            <b>{parsed.title || '(no title)'}</b>
            <span className="f tnum">{when}</span>
            {(parsed.duration !== null || (parsed.start && !parsed.dateOnly)) && <span className="f tnum" data-testid="parse-duration">{fmtDur(parsed.duration ?? settings.default_duration)}</span>}
            {cat && <span data-testid="parse-category">{cat.name}</span>}
            {unknownCat && <span>#{parsed.category}? (no such category)</span>}
            {parsed.priority > 0 && <span className="f tnum">{['', 'P3', 'P2', 'P1'][parsed.priority]}</span>}
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
      {picking && parsed?.title && <GlyphPicker value={suggested ?? undefined} onPick={pickIcon} label={`Icon for ${parsed.title}`} />}
    </form>
  )
}
