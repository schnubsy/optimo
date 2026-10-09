import { useMemo, useState } from 'react'
import { Icon } from '../icons/Icon'
import { deviceZone, tzOffset, zoneCity } from '../lib/time'
import { Sheet } from './Sheet'

const zones = (): string[] => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
}

/** "UTC+1" / "UTC−5:30" for a zone, now. */
export function offsetLabel(tz: string, at = Date.now()): string {
  const m = Math.round(tzOffset(at, tz) / 60000)
  if (!m) return 'UTC'
  const s = m < 0 ? '−' : '+'
  const a = Math.abs(m)
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`
}

/**
 * Set Timezone (② ••• → Set Timezone): the device zone first, then every IANA zone filtered by the search. Picking the
 * device zone clears the task's tz (it follows the viewer again).
 */
export function TimezonePicker({ value, onPick, onClose }: { value: string | null; onPick: (tz: string | null) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const device = deviceZone()
  const all = useMemo(() => {
    const list = zones()
    return [device, ...list.filter((z) => z !== device)]
  }, [device])
  const needle = q.trim().toLowerCase().replace(/\s+/g, '_')
  const shown = (needle ? all.filter((z) => z.toLowerCase().includes(needle) || zoneCity(z).toLowerCase().includes(q.trim().toLowerCase())) : all).slice(0, 80)
  const cur = value ?? device
  return (
    <Sheet title="Time zone" onClose={onClose} testid="tz-picker" className="tz-sheet">
      <label className="tz-search">
        <Icon name="ui-search" size={18} />
        <span className="sr-only">Search time zones</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="City or region" autoComplete="off" data-testid="tz-search" />
      </label>
      <ul className="tz-list" aria-label="Time zones">
        {shown.map((z) => (
          <li key={z}>
            <button
              type="button"
              className="tz-row"
              aria-pressed={z === cur}
              onClick={() => {
                onPick(z === device ? null : z)
                onClose()
              }}
              data-testid="tz-option"
              data-tz={z}
            >
              <span className="tz-city">{zoneCity(z)}{z === device ? ' · this device' : ''}</span>
              <span className="tz-meta tnum">{z.replace(/_/g, ' ')} · {offsetLabel(z)}</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="tz-empty">No time zone matches “{q}”.</li>}
      </ul>
    </Sheet>
  )
}
