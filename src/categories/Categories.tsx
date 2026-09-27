import { useState } from 'react'
import { createCategory, updateCategory } from '../data/repo'
import { useCategories } from '../data/hooks'
import { CATEGORY_COLORS, type Category, type CategoryColor } from '../data/types'
import { Icon } from '../icons/Icon'
import { ICON_NAMES } from '../icons/glyphs'
import { useUI } from '../state/ui'
import './categories.css'

function CategoryRow({ c }: { c: Category }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(c.name)
  const notify = useUI((s) => s.notify)
  return (
    <li className={`cat-row cat-${c.color}`} data-testid="category-row">
      <div className="cat-line">
        <span className="sw" aria-hidden="true">
          <Icon name={c.icon} size={16} />
        </span>
        <label className="sr-only" htmlFor={`cn-${c.id}`}>
          Category name
        </label>
        <input id={`cn-${c.id}`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== c.name && updateCategory(c.id, { name: name.trim() })} />
        <button type="button" className="ghost-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Done' : 'Style'}
        </button>
        <button
          type="button"
          className="ghost-btn"
          aria-label={`Delete ${c.name}`}
          onClick={async () => {
            await updateCategory(c.id, { deleted_at: new Date().toISOString() })
            notify({ text: `Deleted ${c.name}`, undo: () => updateCategory(c.id, { deleted_at: null }) })
          }}
        >
          <Icon name="trash" />
        </button>
      </div>
      {open && (
        <div className="cat-edit">
          <fieldset>
            <legend>Colour</legend>
            <div className="swatches">
              {CATEGORY_COLORS.map((k) => (
                <button key={k} type="button" className={`swatch cat-${k}`} aria-pressed={c.color === k} aria-label={k} onClick={() => updateCategory(c.id, { color: k })} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Icon</legend>
            <div className="icon-grid">
              {ICON_NAMES.map((n) => (
                <button key={n} type="button" aria-pressed={c.icon === n} aria-label={n} title={n} onClick={() => updateCategory(c.id, { icon: n })}>
                  <Icon name={n} size={18} />
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </li>
  )
}

export function Categories() {
  const cats = useCategories()
  const [name, setName] = useState('')
  const [color, setColor] = useState<CategoryColor>('work')
  return (
    <section className="page categories" aria-labelledby="cat-h">
      <h2 id="cat-h">Categories</h2>
      <p className="muted">Colour is a label, not an alarm: it tints the block stripe. Priority tints the edge.</p>
      <ul className="cat-list">
        {cats.map((c) => (
          <CategoryRow key={c.id} c={c} />
        ))}
      </ul>
      <form
        className="cat-add"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await createCategory({ name: name.trim(), color, icon: 'dot', sort_key: Date.now() })
          setName('')
        }}
      >
        <label className="sr-only" htmlFor="cat-new">
          New category name
        </label>
        <input id="cat-new" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {CATEGORY_COLORS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={color === k} className={`swatch cat-${k}`} aria-label={k} onClick={() => setColor(k)} />
          ))}
        </div>
        <button type="submit" className="primary">
          Add
        </button>
      </form>
    </section>
  )
}
