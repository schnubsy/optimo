-- optimo_grant.sql — register optimo.html as a gated Family Wing page and grant Mark (per
-- press db/20260921_press_access.sql). Applied via the Supabase connector (Code applies; Cowork verifies). Idempotent.
-- Postcondition (tenants-check T6):
--   select a.page, count(g.*) filter (where g.active) from press_access_apps a
--   left join press_access_grants g on g.page = a.page where a.page = 'optimo.html' group by a.page;   -- expect 1

insert into public.press_access_apps (page, label, gated)
values ('optimo.html', 'optimo · Day planner', true)
on conflict (page) do update set gated = true, label = excluded.label;

-- the grant only lands for an existing, active Family Wing person (people rows are managed in access.html)
insert into public.press_access_grants (email, page, active)
select p.email, 'optimo.html', true
from public.press_access_people p
where p.email = 'markgubb@gmail.com' and p.active
on conflict (email, page) do update set active = true, revoked_at = null;
