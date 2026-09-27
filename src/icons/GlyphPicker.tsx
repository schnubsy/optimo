import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { ICON_GROUPS } from './set'
import { SUGGEST } from '../quickadd/suggest'

/** Words that find a glyph in the picker search: its name parts + every keyword that suggests it. */
const KEYWORDS: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const g of ICON_GROUPS) for (const n of g.icons) out[n] = `${n.replace(/-/g, ' ')} ${g.label.toLowerCase()}`
  for (const [re, icon] of SUGGEST) out[icon] += ' ' + re.source.replace(/\\b|\(\?:|\)|\(\?<!\w+ \)|\?!.*?\)|[\\^$|?*+]/g, ' ')
  return out
})()

/** Grid of the activity glyphs (44px cells), grouped as in spec §6.2, with a search over names + keywords. */
export function GlyphPicker({ value, onPick, label = 'Icon' }: { value?: string; onPick: (icon: string) => void; label?: string }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return ICON_GROUPS
    return ICON_GROUPS.map((g) => ({ ...g, icons: g.icons.filter((n) => KEYWORDS[n].includes(t)) })).filter((g) => g.icons.length)
  }, [q])
  return (
    <div className="glyph-picker" data-testid="glyph-picker">
      <label className="glyph-search">
        <Icon name="ui-search" size={16} />
        <span className="sr-only">Search icons</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons" />
      </label>
      <div className="glyph-groups" role="group" aria-label={label}>
        {groups.map((g) => (
          <div key={g.id} className="glyph-group">
            <p className="glyph-group-h">{g.label}</p>
            <div className="glyph-grid">
              {g.icons.map((n) => (
                <button key={n} type="button" className="glyph-cell" aria-pressed={value === n} aria-label={n} title={n} onClick={() => onPick(n)}>
                  <Icon name={n} size={20} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <p className="muted">No icon matches “{q}”.</p>}
      </div>
    </div>
  )
}
