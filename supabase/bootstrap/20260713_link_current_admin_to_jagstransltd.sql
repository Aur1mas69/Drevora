-- =============================================================================
-- DREVORA — Bootstrap: link current admin to Jagstransltd
-- File: supabase/bootstrap/20260713_link_current_admin_to_jagstransltd.sql
-- =============================================================================
-- REVIEW ONLY — run manually in Supabase SQL Editor after Phase 1 foundation
-- migration has been applied and verified.
--
-- Does NOT run automatically with migrations.
-- Does NOT enable business-table RLS.
-- Does NOT modify business rows.
-- =============================================================================

begin;

-- Verify exact auth user
do $$
declare
  found_email text;
begin
  select u.email into found_email
  from auth.users u
  where u.id = '45cfd423-753d-477f-9e5c-6a2a29437004'::uuid;

  if found_email is null then
    raise exception
      'Bootstrap STOP: auth user 45cfd423-753d-477f-9e5c-6a2a29437004 not found.';
  end if;

  if lower(trim(found_email)) <> lower(trim('jagstransltd@gmail.com')) then
    raise exception
      'Bootstrap STOP: auth user email mismatch. expected jagstransltd@gmail.com, found %.',
      found_email;
  end if;
end $$;

-- Verify exact company
do $$
declare
  found_name text;
begin
  select c.name into found_name
  from public.companies c
  where c.id = '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid;

  if found_name is null then
    raise exception
      'Bootstrap STOP: company 60370bdb-843c-41a8-a751-2326c85f2e85 not found.';
  end if;

  if lower(trim(found_name)) <> lower(trim('Jagstransltd')) then
    raise exception
      'Bootstrap STOP: company name mismatch. expected Jagstransltd, found %.',
      found_name;
  end if;
end $$;

-- Insert membership (Admin). Safe on re-run.
insert into public.company_members (user_id, company_id, role, is_active)
values (
  '45cfd423-753d-477f-9e5c-6a2a29437004'::uuid,
  '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid,
  'Admin',
  true
)
on conflict (user_id, company_id) do update
set
  role = excluded.role,
  is_active = true,
  updated_at = now();

-- Return resulting membership for verification
select
  cm.id as membership_id,
  cm.user_id,
  u.email,
  cm.company_id,
  c.name as company_name,
  cm.role,
  cm.is_active,
  cm.created_at,
  cm.updated_at
from public.company_members cm
inner join auth.users u on u.id = cm.user_id
inner join public.companies c on c.id = cm.company_id
where cm.user_id = '45cfd423-753d-477f-9e5c-6a2a29437004'::uuid
  and cm.company_id = '60370bdb-843c-41a8-a751-2326c85f2e85'::uuid;

commit;
