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
import { type Parsed } from './parse'
import { captureChip, captureDone, decideCapture } from '../capture/decide'
import { commitCapture } from '../capture/commit'

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

/** Desktop command-line placeholders, longest first — the field shows the longest that fits whole (arc 7 slice 3). */
export const PLACEHOLDERS = ['Lunch with Sam at 1pm for 1h #personal !', 'Lunch with Sam at 1pm for 1h', 'Lunch at 1pm for 1h', 'Add a task', '']

/** The longest placeholder that fits the input's content box, never one clipped mid-word; re-picked on resize. */
function useFittedPlaceholder(el: RefObject<HTMLInputElement | null>, active: boolean): string {
  const [pick, setPick] = useState(PLACEHOLDERS[0])
  useEffect(() => {
    const input = el.current
    if (!active || !input || typeof ResizeObserver === 'undefined') return
    const ctx = document.createElement('canvas').getContext('2d')
    const measure = () => {
      const cs = getComputedStyle(input)
      const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2
      if (!ctx) return
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      setPick(PLACEHOLDERS.find((p) => ctx.measureText(p).width <= room) ?? '')
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(input)
    void document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [el, active])
  return pick
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
 * Esc clears. arc 7 slice 8: the same rules as the iPhone capture sheet — plain text goes to the Inbox untimed with no
 * estimate (never a default time); a time schedules it, a day without one plans it, "someday" parks it.
 */
export function QuickAdd({ compact, fit, onDone }: { compact?: boolean; fit?: boolean; onDone?: () => void }) {
  const [text, setText] = useState('')
  const [picking, setPicking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const fitted = useFittedPlaceholder(input, !!fit)
  const cats = useCategories()
  const settings = useSettings()
  const set = useUI((s) => s.set)
  const openWizard = useUI((s) => s.openWizard)
  const notify = useUI((s) => s.notify)
  const decision = useMemo(() => decideCapture(text), [text])
  const parsed = decision?.parsed ?? null
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
    if (!decision) return
    const t = await commitCapture(decision, cats, settings)
    setText('')
    setPicking(false)
    onDone?.()
    if (t.start_at && !t.rrule) set({ date: dateKey(new Date(t.start_at)) })
    notify({ text: `${captureDone(decision, new Date(), settings.clock24)} · ${t.title}`, undo: () => repo.deleteTask(t.id).then(() => undefined) })
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

  const when = !decision || decision.place === 'inbox' ? 'inbox' : decision.place === 'timed' || decision.place === 'series' ? parseWhen(parsed!, settings) : captureChip(decision, new Date(), settings.clock24)!.toLowerCase()
  function details() {
    openWizard('timeline', text.trim() ? { title: text.trim() } : {})
    setText('')
  }
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
          placeholder={compact ? 'Lunch with Sam at 1pm' : fit ? fitted : PLACEHOLDERS[0]}
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
        <button type="button" className="qa-details" onMouseDown={(e) => e.preventDefault()} onClick={details} data-testid="quickadd-details">
          Details…
        </button>
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
