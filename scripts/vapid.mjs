#!/usr/bin/env node
// VAPID keypair for web push: private key → gitignored .secrets/planner.env (Edge Function secret, set by Mark /
// Cowork), public key → .env.production as VITE_VAPID_PUBLIC_KEY (publishable by design: browsers need it to
// subscribe). Never regenerates an existing pair — new keys would silently orphan every subscription.
import { createECDH } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'

const SECRETS = '.secrets/planner.env'
const PUBLIC_ENV = '.env.production'
const read = (f) => new Map(existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]) : [])
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

mkdirSync('.secrets', { recursive: true })
const secrets = read(SECRETS)
if (!secrets.get('VAPID_PRIVATE_KEY')) {
  const ec = createECDH('prime256v1')
  ec.generateKeys()
  secrets.set('VAPID_PUBLIC_KEY', b64url(ec.getPublicKey())) // 65-byte uncompressed point
  secrets.set('VAPID_PRIVATE_KEY', b64url(ec.getPrivateKey()))
  secrets.set('VAPID_SUBJECT', 'https://schnubsy.github.io/optimo/')
  writeFileSync(SECRETS, [...secrets].map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
  chmodSync(SECRETS, 0o600)
  console.log(`${SECRETS}: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (new)`)
} else console.log(`${SECRETS}: VAPID keys already present (unchanged)`)

const pub = secrets.get('VAPID_PUBLIC_KEY')
const env = readFileSync(PUBLIC_ENV, 'utf8')
const line = `VITE_VAPID_PUBLIC_KEY=${pub}`
const next = /^VITE_VAPID_PUBLIC_KEY=.*$/m.test(env) ? env.replace(/^VITE_VAPID_PUBLIC_KEY=.*$/m, line) : env.trimEnd() + `\n# web push (scripts/vapid.mjs) — the public half; the private key is an Edge Function secret\n${line}\n`
writeFileSync(PUBLIC_ENV, next)
console.log(`${PUBLIC_ENV}: VITE_VAPID_PUBLIC_KEY set`)
