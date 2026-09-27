import type { Category, SettingsData } from '../data/types'
import { Timeline } from '../timeline/Timeline'
import type { Item } from '../timeline/items'

export function Day({ day, items, cats, settings }: { day: string; items: Item[]; cats: Map<string, Category>; settings: SettingsData }) {
  return (
    <section className="day" aria-label="Day timeline">
      <Timeline day={day} items={items} cats={cats} settings={settings} />
    </section>
  )
}
