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

/** Everyday names people search by that the IANA id doesn't carry (our own short list; matched as a prefix). */
const ALIASES: Record<string, string[]> = {
  'Europe/London': ['uk', 'united kingdom', 'britain', 'england', 'scotland', 'wales'],
  'Europe/Dublin': ['ireland'],
  'Europe/Paris': ['france'],
  'Europe/Berlin': ['germany'],
  'Europe/Madrid': ['spain'],
  'Europe/Rome': ['italy'],
  'Europe/Amsterdam': ['netherlands', 'holland'],
  'America/New_York': ['nyc', 'eastern', 'boston', 'washington', 'miami', 'atlanta'],
  'America/Chicago': ['central', 'houston', 'dallas', 'austin'],
  'America/Denver': ['mountain'],
  'America/Phoenix': ['arizona'],
  'America/Los_Angeles': ['pacific', 'san francisco', 'seattle', 'la'],
  'Asia/Kolkata': ['india', 'mumbai', 'delhi', 'bangalore'],
  'Asia/Shanghai': ['china', 'beijing'],
  'Asia/Tokyo': ['japan'],
  'Asia/Dubai': ['uae', 'abu dhabi'],
  'Australia/Sydney': ['nsw'],
  'Pacific/Auckland': ['new zealand', 'nz'],
}

/**
 * Search rank for a zone, lower is better, null = no match (arc 7 slice 3): the city (the part after the last "/") or an
 * everyday name equal to the query, then starting with it, then a word of the city starting with it, then a region
 * prefix ("europe/…"), then anything containing it. "Lon" → London before Barcelona.
 */
export function zoneRank(tz: string, query: string): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const city = zoneCity(tz).toLowerCase()
  const full = tz.toLowerCase().replace(/_/g, ' ')
  const names = [city, ...(ALIASES[tz] ?? [])]
  if (names.some((n) => n === q)) return 0
  if (names.some((n) => n.startsWith(q))) return 1
  if (city.split(/[\s-]+/).some((w) => w.startsWith(q))) return 2
  if (full.split('/').some((seg) => seg.startsWith(q)) || full.startsWith(q)) return 3
  if (city.includes(q) || names.some((n) => n.includes(q))) return 4
  if (full.includes(q)) return 5
  return null
}

/** Zones matching `query`, best first (rank, then city A–Z); no query keeps the given order (device zone first). */
export function searchZones(all: string[], query: string): string[] {
  if (!query.trim()) return all
  return all
    .map((z) => ({ z, r: zoneRank(z, query) }))
    .filter((x): x is { z: string; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || zoneCity(a.z).localeCompare(zoneCity(b.z)))
    .map((x) => x.z)
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
  const shown = searchZones(all, q).slice(0, 80)
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
