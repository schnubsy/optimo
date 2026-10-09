import { Icon } from '../icons/Icon'
import { Sheet } from './Sheet'

export const ALERT_CHOICES = [0, 5, 10, 15, 30, 60]

/** "At start" · "10 min before" · "1 hr before" */
export function leadLabel(min: number): string {
  if (!min) return 'At start'
  return min % 60 === 0 ? `${min / 60} hr before` : `${min} min before`
}
/** Row summary (mockups 06): left `1 Alert` / `2 Alerts` / `Alerts`, right the first lead or `No alerts`. */
export function alertSummary(leads: number[]): [string, string] {
  if (!leads.length) return ['Alerts', 'No alerts']
  return [`${leads.length} Alert${leads.length > 1 ? 's' : ''}`, leadLabel([...leads].sort((a, b) => a - b)[0])]
}

/** The existing lead-time chips (in-app reminders, push when enabled) as a sheet; tap toggles a lead. */
export function AlertSheet({ value, onChange, onClose }: { value: number[]; onChange: (leads: number[]) => void; onClose: () => void }) {
  return (
    <Sheet title="Alerts" onClose={onClose} testid="alert-sheet">
      <ul className="opt-list" aria-label="Alert before start">
        {ALERT_CHOICES.map((m) => {
          const on = value.includes(m)
          return (
            <li key={m}>
              <button type="button" className="opt-row" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b))} data-testid="alert-option" data-min={m}>
                <span>{leadLabel(m)}</span>
                {on && <Icon name="ui-check" size={18} />}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
