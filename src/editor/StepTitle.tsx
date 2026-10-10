import type { Category, SettingsData } from '../data/types'
import type { Parsed } from '../quickadd/parse'
import { parseWhen } from '../quickadd/QuickAdd'
import { Icon } from '../icons/Icon'
import { taskIcon } from '../quickadd/suggest'
import type { Suggestion } from './suggestions'
import { durLong, fmtRange } from './wizardModel'

/** ① body: the parse preview chips under the header field + the Suggestions list. */
export function StepTitle({
  parsed,
  parsedCat,
  suggestions,
  settings,
  catOf,
  onPick,
  untimed,
}: {
  /** inbox mode (arc 7 slice 3): suggestions offer a title + length only — no time, nothing that would schedule */
  untimed?: boolean
  parsed: Parsed | null
  parsedCat: Category | null
  suggestions: Suggestion[]
  settings: SettingsData
  /** the category a suggestion lands in (its own, or the keyword map's default for seeds) */
  catOf: (s: Suggestion) => Category | null
  onPick: (s: Suggestion) => void
}) {
  const chips: { k: string; text: string }[] = []
  if (parsed && (parsed.start || parsed.duration !== null || parsedCat || parsed.rrule)) {
    if (parsed.start) chips.push({ k: 'when', text: parseWhen(parsed, settings) })
    if (parsed.duration !== null) chips.push({ k: 'duration', text: durLong(parsed.duration) })
    if (parsedCat) chips.push({ k: 'category', text: parsedCat.name })
    if (parsed.repeatLabel) chips.push({ k: 'repeat', text: `↻ ${parsed.repeatLabel}` })
  }
  return (
    <div className="wiz-body wiz-step1">
      <div className="wiz-parse" id="wiz-parse" aria-live="polite" data-testid="wizard-parse">
        {chips.map((c) => (
          <span key={c.k} className="wiz-chip tnum" data-testid={`wizard-parse-${c.k}`}>
            {c.text}
          </span>
        ))}
      </div>
      {suggestions.length > 0 && (
        <section className="wiz-sugg" aria-labelledby="wiz-sugg-h">
          <h2 id="wiz-sugg-h" className="wiz-label">
            Suggestions
          </h2>
          <ul className="wiz-card sugg-list">
            {suggestions.map((s) => {
              const cat = catOf(s)
              return (
                <li key={s.title}>
                  <button type="button" className={`sugg ${cat ? `cat-${cat.color}` : 'cat-accent'}`} onClick={() => onPick(s)} data-testid="suggestion" data-title={s.title} data-timed={untimed ? 'false' : 'true'}>
                    <Icon name={taskIcon(s.title, cat?.icon, settings.iconOverrides)} size={24} className="sugg-glyph" />
                    <span className="sugg-text">
                      <span className="sugg-meta tnum">
                        {untimed ? `Inbox · ${durLong(s.duration)}` : `${fmtRange(s.start, s.duration, settings.clock24)} (${durLong(s.duration)})`}
                      </span>
                      <span className="sugg-title">{s.title}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
