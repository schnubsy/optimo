// POST with the user's JWT (their accounts) or x-cron-secret (pg_cron, every 15 min: all enabled accounts).
import { handleSync } from '../_shared/handlers.ts'
import { denoPorts } from '../_shared/supabase.ts'

Deno.serve((req) => handleSync(req, denoPorts()))
