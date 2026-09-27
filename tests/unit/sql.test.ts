/// <reference types="node" />
// Every migration parses with the real PostgreSQL grammar (libpg-query = pg_query, PG 17) — db/003_cron.sql is
// "lint-clean, not applied" by this gate; the cron bodies ($cron$ … $cron$) are parsed as SQL too.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'libpg-query'

const files = [
  ...readdirSync('db').filter((f) => f.endsWith('.sql')).map((f) => `db/${f}`),
  ...readdirSync('db/press').filter((f) => f.endsWith('.sql')).map((f) => `db/press/${f}`),
]

describe('db/*.sql parse as PostgreSQL', () => {
  it.each(files)('%s', async (f) => {
    const sql = readFileSync(f, 'utf8')
    const tree = await parse(sql)
    expect(tree.stmts.length).toBeGreaterThan(0)
    for (const [, body] of sql.matchAll(/\$cron\$([\s\S]*?)\$cron\$/g)) expect((await parse(body)).stmts.length).toBe(1)
  })
  it('db/003 schedules both jobs and never embeds a secret', () => {
    const sql = readFileSync('db/003_cron.sql', 'utf8')
    expect(sql).toMatch(/cron\.schedule\(\s*'planner_push_send',\s*'\* \* \* \* \*'/)
    expect(sql).toMatch(/cron\.schedule\(\s*'planner_calendar_sync',\s*'\*\/15 \* \* \* \*'/)
    expect(sql).toMatch(/vault\.decrypted_secrets where name = 'planner_cron_secret'/)
    expect(sql).not.toMatch(/[0-9a-f]{64}/) // no CRON_SECRET-shaped literal
  })
})
