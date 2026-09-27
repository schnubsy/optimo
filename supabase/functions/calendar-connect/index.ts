// POST {username, password, label} with the user's JWT → iCloud CalDAV discovery → encrypted account row.
import { handleConnect } from '../_shared/handlers.ts'
import { denoPorts } from '../_shared/supabase.ts'

Deno.serve((req) => handleConnect(req, denoPorts()))
