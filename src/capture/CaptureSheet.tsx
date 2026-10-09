import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from 'react'
import * as repo from '../data/repo'
import { useCategories, useSettings } from '../data/hooks'
import { Icon } from '../icons/Icon'
import { useKeyboardInset } from '../quickadd/QuickAdd'
import { useUI } from '../state/ui'
import { commitCapture } from './commit'
import { captureChip, captureDone, decideCapture } from './decide'
import './capture.css'

/** How long the "Added · Undo" line stays after an add. */
const DONE_MS = 4000

/**
 * arc 7 slice 8 — the iPhone one-line capture (FAB): type, Enter, the field clears and stays open for the next one.
 * Plain text goes to the Inbox untimed with no estimate; a parsed time / day / "someday" shows as a removable chip
 * first. "Details…" hands the line to the full wizard. Esc, ✕, the scrim or a swipe down closes it.
 */
export function CaptureSheet() {
  const set = useUI((s) => s.set)
  const openWizard = useUI((s) => s.openWizard)
  const settings = useSettings()
  const cats = useCategories()
  const [text, setText] = useState('')
  const [plain, setPlain] = useState(false)
  const [done, setDone] = useState<{ id: string; text: string; n: number } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  useKeyboardInset(sheet)
  // the parse reads "now" at each keystroke (a bare time means today)
  const decision = useMemo(() => decideCapture(text, new Date(), plain), [text, plain])
  const chip = plain ? null : captureChip(decision, new Date(), settings.clock24)
  const close = () => set({ capture: false })

  useEffect(() => {
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      set({ capture: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [set])
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), DONE_MS)
    return () => clearTimeout(t)
  }, [done])

  async function add(e?: FormEvent) {
    e?.preventDefault()
    if (!decision) return
    const t = await commitCapture(decision, cats, settings)
    setDone((d) => ({ id: t.id, text: captureDone(decision, new Date(), settings.clock24), n: (d?.n ?? 0) + 1 }))
    setText('')
    setPlain(false)
    input.current?.focus()
  }
  function details() {
    openWizard('timeline', text.trim() ? { title: text.trim() } : {})
  }

  // swipe down on the sheet (not on the field or a button) closes it
  const swipe = useRef<{ id: number; y: number } | null>(null)
  const onDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('input, button')) return
    swipe.current = { id: e.pointerId, y: e.clientY }
  }
  const onUp = (e: RPointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (s && s.id === e.pointerId && e.clientY - s.y > 48) close()
  }

  return (
    <div className="cap-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={sheet}
        className="cap"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cap-h"
        data-testid="capture-sheet"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        <i className="cap-grab" aria-hidden="true" />
        <h2 id="cap-h" className="cap-h">
          Capture
        </h2>
        <button type="button" className="cap-x" aria-label="Close" onClick={close} data-testid="capture-close">
          <Icon name="ui-close" size={20} />
        </button>
        <form className="cap-row" onSubmit={add}>
          <label htmlFor="cap-in" className="sr-only">
            What’s on your mind
          </label>
          <input
            id="cap-in"
            ref={input}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (!e.target.value.trim()) setPlain(false)
            }}
            placeholder="What’s on your mind?"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck
            aria-describedby="cap-where"
            data-testid="capture-input"
          />
          <button type="submit" className="cap-go" aria-label="Add" disabled={!decision} data-testid="capture-add">
            <Icon name="ui-check" size={22} />
          </button>
        </form>
        <div className="cap-meta">
          <span id="cap-where" className="cap-where" aria-live="polite">
            {chip ? (
              <span className={`cap-chip p-${decision!.place}`} data-testid="capture-chip" data-place={decision!.place}>
                <Icon name={decision!.place === 'someday' ? 'ui-inbox' : decision!.place === 'planned' ? 'ui-calendar' : 'ui-clock'} size={14} />
                <span className="tnum">{chip}</span>
                <button type="button" className="cap-chip-x" aria-label={`Remove “${chip}”, keep it in the inbox`} onClick={() => (setPlain(true), input.current?.focus())} data-testid="capture-chip-x">
                  <Icon name="ui-close" size={12} />
                </button>
              </span>
            ) : (
              <span className="cap-hint" data-testid="capture-hint">
                {text.trim() ? 'Goes to your inbox' : 'No time needed — sort it later'}
              </span>
            )}
          </span>
          <button type="button" className="cap-details" onClick={details} data-testid="capture-details">
            Details…
          </button>
        </div>
        <p className="cap-done" role="status" aria-live="polite" data-testid="capture-added">
          {done && (
            <>
              <span key={done.n}>{done.text}</span>
              <button
                type="button"
                onClick={() => {
                  void repo.deleteTask(done.id)
                  setDone(null)
                  input.current?.focus()
                }}
                data-testid="capture-undo"
              >
                Undo
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
