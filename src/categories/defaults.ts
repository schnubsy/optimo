import { db } from '../data/db'
import { seedCategory } from '../data/repo'
import type { CategoryColor } from '../data/types'

// Fixed ids: every device seeds the same rows, so a double seed merges instead of duplicating.
const DEFAULTS: { id: string; name: string; color: CategoryColor; icon: string }[] = [
  { id: '0190a000-0000-7000-8000-000000000001', name: 'Work', color: 'work', icon: 'work' },
  { id: '0190a000-0000-7000-8000-000000000002', name: 'Meetings', color: 'meet', icon: 'meet' },
  { id: '0190a000-0000-7000-8000-000000000003', name: 'Health', color: 'health', icon: 'health' },
  { id: '0190a000-0000-7000-8000-000000000004', name: 'Personal', color: 'personal', icon: 'meal' },
  { id: '0190a000-0000-7000-8000-000000000005', name: 'Family', color: 'family', icon: 'family' },
  { id: '0190a000-0000-7000-8000-000000000006', name: 'Errands', color: 'errand', icon: 'errand' },
  { id: '0190a000-0000-7000-8000-000000000007', name: 'Learning', color: 'learn', icon: 'learn' },
  { id: '0190a000-0000-7000-8000-000000000008', name: 'Home', color: 'home', icon: 'home' },
]

export async function seedCategories() {
  if ((await db.categories.count()) > 0) return
  let i = 0
  for (const c of DEFAULTS) await seedCategory({ ...c, sort_key: ++i })
}
