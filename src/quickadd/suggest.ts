// Keyword → icon auto-suggest (design spec §6.4). Data, not logic: lowercase, word-boundary match, first hit wins.
// The category slug is the spec's bracketed suggestion; CATEGORY_OF maps it onto the default category colours.
import type { CategoryColor } from '../data/types'
import type { ActivityName } from '../icons/set'

export type CategorySlug = 'health' | 'personal' | 'home' | 'meetings' | 'work' | 'errands' | 'learning' | 'rest' | 'personal care' | 'finance' | 'travel' | 'pets' | 'creative' | 'family'

const w = (alts: string) => new RegExp(`\\b(?:${alts})\\b`)

export const SUGGEST: Array<[RegExp, ActivityName, CategorySlug]> = [
  [w('run|jog|5k|marathon'), 'fitness-run', 'health'],
  [w('gym|weights|lift|workout'), 'fitness-dumbbell', 'health'],
  [w('yoga|pilates|stretch'), 'fitness-yoga', 'health'],
  [w('bike|cycle|ride|peloton'), 'fitness-bike', 'health'],
  [w('swim|pool|laps'), 'fitness-swim', 'health'],
  [w('walk|hike|steps'), 'fitness-run', 'health'],
  [w('doctor|dentist|clinic|checkup'), 'health-pill', 'health'],
  [w('meds|vitamins|pill'), 'health-pill', 'health'],
  [w('coffee|espresso|latte|tea'), 'food-coffee', 'personal'],
  [w('breakfast|lunch|dinner|brunch'), 'food-plate', 'personal'],
  [w('cook|meal prep|recipe'), 'food-bowl', 'home'],
  // "water plants" is a chore (below), not a drink
  [/\bwater\b(?! plants?)|\bhydrate\b/, 'food-water', 'health'],
  [w('snack|fruit'), 'food-apple', 'personal'],
  [w('drinks|wine|beer|bar|happy hour'), 'food-wine', 'personal'],
  [w('standup|stand-up|sync|huddle'), 'meeting-people', 'meetings'],
  [/(?:^|\s)(?:1:1|1-1)(?:\s|$)|\b(?:one-on-one|check-in)\b/, 'meeting-people', 'meetings'],
  [w('meeting|meet with'), 'meeting-people', 'meetings'],
  [w('zoom|teams|call|video'), 'meeting-video', 'meetings'],
  [w('phone|ring|dial'), 'meeting-phone', 'meetings'],
  [w('present|presentation|demo|pitch'), 'meeting-presentation', 'meetings'],
  [/\b(?:interview|negotiat\w*)\b/, 'meeting-handshake', 'meetings'],
  [w('email|inbox|reply|mail'), 'work-inbox-tray', 'work'],
  [w('deep work|focus|write|draft|doc|report|spec'), 'work-document', 'work'],
  [w('code|coding|pr|pull request|review|deploy|bug'), 'learn-code', 'work'],
  [w('plan|planning|roadmap|forecast|budget|analysis'), 'work-chart', 'work'],
  [w('laptop|slides|deck'), 'work-laptop', 'work'],
  [w('office|commute in'), 'work-briefcase', 'work'],
  [w('clean|tidy|vacuum|dishes'), 'home-broom', 'home'],
  [w('laundry|wash|fold'), 'home-laundry', 'home'],
  [w('fix|repair|assemble|drill|ikea'), 'home-tools', 'home'],
  [w('water plants|garden|plants|mow'), 'home-plant', 'home'],
  [w('trash|bins|recycling'), 'home-trash', 'home'],
  [w('groceries|grocery|shopping|shop|store|costco|target'), 'errand-cart', 'errands'],
  [w('pick up|pickup|drop off|collect'), 'errand-bag', 'errands'],
  [w('car|oil change|registration|dmv|gas'), 'errand-car', 'errands'],
  [w('bus|transit'), 'errand-bus', 'errands'],
  [w('package|amazon|return|post office|ship'), 'errand-package', 'errands'],
  [w('errand|appointment|visit'), 'errand-pin', 'errands'],
  // specific beats generic: "Book flights" is travel, not reading; "Guitar practice" is music, not homework
  [w('flight|fly|airport|book flights|flights'), 'travel-plane', 'travel'],
  [w('guitar|piano|music|band|sing|practice guitar'), 'creative-music', 'creative'],
  [w('read|book|chapter|kindle'), 'learn-book', 'learning'],
  [w('study|course|class|lecture|exam'), 'learn-graduation', 'learning'],
  [w('notes|journal|homework|practice'), 'learn-pencil', 'learning'],
  [w('learn|tutorial|lesson|duolingo|spanish|french'), 'learn-language', 'learning'],
  [w('sleep|bed|nap'), 'rest-bed', 'rest'],
  [/\b(?:wind down|(?<!date )night|evening routine)\b/, 'rest-moon', 'rest'], // "date night" is family
  [w('relax|tv|movie|netflix|chill'), 'rest-sofa', 'rest'],
  [w('wake|alarm|morning routine|rise'), 'rest-alarm', 'rest'],
  [w('shower|bath'), 'care-shower', 'personal care'],
  [w('teeth|brush|floss'), 'care-toothbrush', 'personal care'],
  [w('haircut|barber|salon|nails'), 'care-scissors', 'personal care'],
  [w('skincare|makeup|get ready'), 'care-mirror', 'personal care'],
  [w('pay|bills|rent|mortgage'), 'finance-receipt', 'finance'],
  [w('bank|transfer|invoice|taxes|ynab'), 'finance-bank', 'finance'],
  [w('wallet|expenses|receipts|cash'), 'finance-wallet', 'finance'],
  [w('pack|packing|hotel|trip|vacation'), 'travel-suitcase', 'travel'],
  [w('train|amtrak|station'), 'travel-train', 'travel'],
  [w('dog|cat|vet|pet'), 'pet-paw', 'pets'],
  [w('feed|treat|kibble'), 'pet-bone', 'pets'],
  [w('photo|camera|shoot|edit photos'), 'creative-camera', 'creative'],
  [w('paint|draw|sketch|design|art'), 'creative-palette', 'creative'],
  [w('kids|school run|daycare|soccer|noah'), 'family-child', 'family'],
  [w('family|mom|dad|parents|wife|husband|date night'), 'family-heart-people', 'family'],
  [w('birthday|party|cake'), 'family-cake', 'family'],
  [w('gift|present for|wrap'), 'family-gift', 'family'],
]

/** Suggested category slug → the default category (by its colour key). */
export const CATEGORY_OF: Record<CategorySlug, CategoryColor> = {
  health: 'health', personal: 'personal', home: 'home', meetings: 'meet', work: 'work', errands: 'errand', learning: 'learn',
  rest: 'personal', 'personal care': 'personal', finance: 'home', travel: 'personal', pets: 'family', creative: 'personal', family: 'family',
}

/** The glyph a task shows on its chip: override → keyword map → its category's glyph → work-document. */
export function taskIcon(title: string, categoryIcon: string | undefined, overrides?: Record<string, string>): string {
  return suggestIcon(title, overrides)?.icon ?? categoryIcon ?? 'work-document'
}

/** The stem a user's icon override is remembered under: first three words, letters only. */
export function titleStem(title: string): string {
  return title.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ')
}

/**
 * Icon (and category) for a title. User overrides (planner_settings.data.iconOverrides[titleStem]) win over the map;
 * no match → undefined, and the caller falls back to the category's glyph (then work-document).
 */
export function suggestIcon(title: string, overrides?: Record<string, string>): { icon: string; category?: CategorySlug } | undefined {
  const t = title.toLowerCase()
  const stem = titleStem(title)
  if (stem && overrides?.[stem]) return { icon: overrides[stem] }
  for (const [re, icon, category] of SUGGEST) if (re.test(t)) return { icon, category }
  return undefined
}
