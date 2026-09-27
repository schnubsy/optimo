import type { Category, SettingsData } from '../data/types'
import { Timeline } from '../timeline/Timeline'
import type { Item } from '../timeline/items'
import type { EventItem } from '../calendar/events'

export function Day({ day, items, events, cats, settings }: { day: string; items: Item[]; events?: EventItem[]; cats: Map<string, Category>; settings: SettingsData }) {
  return (
    <section className="day" aria-label="Day timeline">
      <Timeline day={day} items={items} events={events} cats={cats} settings={settings} />
    </section>
  )
}
