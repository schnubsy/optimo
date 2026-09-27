import { describe, expect, it } from 'vitest'
import { SUGGEST, suggestIcon, titleStem } from '../../src/quickadd/suggest'
import { ACTIVITY } from '../../src/icons/set'

const cases: [string, string, string?][] = [
  ['Gym every weekday', 'fitness-dumbbell', 'health'],
  ['Call the dentist', 'health-pill', 'health'],
  ['Book flights for October', 'travel-plane', 'travel'],
  ['Read chapter 4', 'learn-book', 'learning'],
  ['Morning run', 'fitness-run', 'health'],
  ['Standup, platform team', 'meeting-people', 'meetings'],
  ['1:1 with Dana', 'meeting-people', 'meetings'],
  ['Dentist', 'health-pill', 'health'],
  ['Run 5k', 'fitness-run', 'health'],
  ['Yoga class', 'fitness-yoga', 'health'],
  ['Peloton ride', 'fitness-bike', 'health'],
  ['Swim laps', 'fitness-swim', 'health'],
  ['Take vitamins', 'health-pill', 'health'],
  ['Coffee with Ana', 'food-coffee', 'personal'],
  ['Lunch with Sam', 'food-plate', 'personal'],
  ['Meal prep', 'food-bowl', 'home'],
  ['Drink water', 'food-water', 'health'],
  ['Water plants', 'home-plant', 'home'],
  ['Zoom with the agency', 'meeting-video', 'meetings'],
  ['Demo for the board', 'meeting-presentation', 'meetings'],
  ['Interview a candidate', 'meeting-handshake', 'meetings'],
  ['Reply to Ellen re budget', 'work-inbox-tray', 'work'],
  ['Deep work: quarterly forecast draft', 'work-document', 'work'],
  ['Review pull request', 'learn-code', 'work'],
  ['Roadmap planning', 'work-chart', 'work'],
  ['Vacuum the hall', 'home-broom', 'home'],
  ['Laundry', 'home-laundry', 'home'],
  ['Assemble the IKEA shelf', 'home-tools', 'home'],
  ['Take out the bins', 'home-trash', 'home'],
  ['Groceries', 'errand-cart', 'errands'],
  ['Pick up Noah from practice', 'errand-bag', 'errands'],
  ['Renew car registration', 'errand-car', 'errands'],
  ['Return the Amazon package', 'errand-package', 'errands'],
  ['Study for the exam', 'learn-graduation', 'learning'],
  ['Spanish on Duolingo', 'learn-language', 'learning'],
  ['Nap', 'rest-bed', 'rest'],
  ['Watch a movie', 'rest-sofa', 'rest'],
  ['Haircut', 'care-scissors', 'personal care'],
  ['Pay rent', 'finance-receipt', 'finance'],
  ['File taxes', 'finance-bank', 'finance'],
  ['Pack for the trip', 'travel-suitcase', 'travel'],
  ['Take the dog to the vet', 'pet-paw', 'pets'],
  ['Guitar practice', 'creative-music', 'creative'],
  ['Sketch the logo', 'creative-palette', 'creative'],
  ['Date night', 'family-heart-people', 'family'],
  ['Birthday party', 'family-cake', 'family'],
]

describe('suggestIcon — the §6.4 keyword map', () => {
  it.each(cases)('%s → %s', (title, icon, category) => {
    expect(suggestIcon(title)).toEqual({ icon, category })
  })
  it('unknown titles return nothing (caller falls back to the category glyph)', () => {
    expect(suggestIcon('Quarterly thing with Priya')).toBeUndefined()
  })
  it('matches whole words only', () => {
    expect(suggestIcon('Brunette')).toBeUndefined() // not "brunch"
    expect(suggestIcon('Carpet shampoo')).toBeUndefined() // not "car"
    expect(suggestIcon('Clean the carpet')?.icon).toBe('home-broom')
  })
  it('a user override for the title stem wins over the map', () => {
    expect(suggestIcon('Guitar practice!', { [titleStem('Guitar practice')]: 'rest-sofa' })).toEqual({ icon: 'rest-sofa' })
  })
  it('every mapped icon exists in the glyph set; the map has ~80 keyword groups worth of entries', () => {
    for (const [, icon] of SUGGEST) expect(ACTIVITY).toHaveProperty([icon])
    expect(SUGGEST.length).toBeGreaterThanOrEqual(60)
  })
})
