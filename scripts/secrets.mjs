#!/usr/bin/env node
// Generate optimo's Edge Function secrets into the gitignored .secrets/planner.env and print the guarded
// `supabase secrets set` command for HANDOFF. Never overwrites an existing value (rotating the KEK would orphan
// every stored iCloud password). Values are printed by NAME only — the file is the only place they exist.
//   PLANNER_KEK   32 random bytes, base64 — AES-GCM key for the iCloud app-specific password
//   CRON_SECRET   32 random bytes, hex    — x-cron-secret for pg_cron → calendar-sync / push-send
// Slice 5 adds VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT via scripts/vapid.mjs.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'

const FILE = '.secrets/planner.env'
mkdirSync('.secrets', { recursive: true })
const env = new Map(
  existsSync(FILE)
    ? readFileSync(FILE, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
    : [],
)
const want = { PLANNER_KEK: () => randomBytes(32).toString('base64'), CRON_SECRET: () => randomBytes(32).toString('hex') }
const added = []
for (const [k, gen] of Object.entries(want)) if (!env.get(k)) (env.set(k, gen()), added.push(k))
writeFileSync(FILE, [...env].map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
chmodSync(FILE, 0o600)
console.log(`${FILE}: ${[...env.keys()].join(', ')}${added.length ? ` (new: ${added.join(', ')})` : ' (unchanged)'}`)
console.log('\nGuarded set (Mark / Cowork — never Claude Code):')
console.log(
  `  cd /Users/mark/Documents/code/optimo && test -s ${FILE} && supabase secrets set --project-ref eepjhpyziczrxvirczio --env-file ${FILE} && supabase secrets list --project-ref eepjhpyziczrxvirczio | grep -cE 'PLANNER_KEK|CRON_SECRET|VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|VAPID_SUBJECT'`,
)
console.log('  expected postcondition: 5')
