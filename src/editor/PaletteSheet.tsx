import * as repo from '../data/repo'
import type { Category, Priority, SettingsData } from '../data/types'
import { GlyphPicker } from '../icons/GlyphPicker'
import { Icon } from '../icons/Icon'
import { titleStem } from '../quickadd/suggest'
import { Sheet } from './Sheet'

const PRIORITIES: { v: Priority; label: string }[] = [
  { v: 0, label: 'None' },
  { v: 1, label: 'Low' },
  { v: 2, label: 'Med' },
  { v: 3, label: 'High' },
]

/**
 * The palette button on ③'s capsule (mockups 06): category / colour (the same chips as before), the glyph for this
 * title (remembered per title stem in settings.iconOverrides) and the priority.
 */
export function PaletteSheet({ cats, categoryId, priority, title, glyph, settings, onCategory, onPriority, onClose }: {
  cats: Category[]
  categoryId: string | null
  priority: Priority
  title: string
  glyph: string
  settings: SettingsData
  onCategory: (id: string | null) => void
  onPriority: (p: Priority) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Look" onClose={onClose} testid="palette-sheet">
      <h3 className="opt-h" id="pal-cat">Category</h3>
      <div className="cat-chips pal-cats" role="group" aria-labelledby="pal-cat" data-testid="sheet-category">
        {cats.map((c) => (
          <button type="button" key={c.id} className={`cat-chip pal-cat cat-${c.color}`} aria-pressed={categoryId === c.id} aria-label={c.name} title={c.name} onClick={() => onCategory(categoryId === c.id ? null : c.id)}>
            <Icon name={c.icon} size={20} />
          </button>
        ))}
      </div>
      <h3 className="opt-h" id="pal-pri">Priority</h3>
      <div className="pal-seg" role="group" aria-labelledby="pal-pri">
        {PRIORITIES.map((p) => (
          <button type="button" key={p.v} aria-pressed={priority === p.v} onClick={() => onPriority(p.v)}>
            {p.label}
          </button>
        ))}
      </div>
      {title.trim() && (
        <>
          <h3 className="opt-h">Icon</h3>
          <GlyphPicker
            value={glyph}
            label={`Icon for ${title}`}
            onPick={(icon) => void repo.updateSettings({ iconOverrides: { ...(settings.iconOverrides ?? {}), [titleStem(title)]: icon } })}
          />
        </>
      )}
    </Sheet>
  )
}
