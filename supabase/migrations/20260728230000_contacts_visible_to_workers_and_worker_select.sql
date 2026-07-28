-- DREVORA — Contacts: Worker-visible flag + Worker SELECT policy
-- File: supabase/migrations/20260728230000_contacts_visible_to_workers_and_worker_select.sql
--
-- Purpose:
--   Allow Drivers (Workers) to read only contacts that Admins/Office have
--   explicitly marked visible_to_workers = true for their own company.
--
-- Rules:
--   - Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS)
--   - Does NOT backfill existing contacts to true (remain hidden until Admin enables)
--   - Does NOT grant Worker INSERT / UPDATE / DELETE
--   - Does NOT disable RLS
--   - Does NOT grant broad access to anon
--   - Preserves existing contacts_office_* policies
--
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.

begin;

-- =============================================================================
-- 1) Column: visible_to_workers
-- =============================================================================
alter table public.contacts
  add column if not exists visible_to_workers boolean not null default false;

comment on column public.contacts.visible_to_workers is
  'When true, authenticated Workers (Drivers) in the same company may SELECT this active contact. Defaults false; Admins/Office must enable explicitly. No automatic backfill.';

create index if not exists contacts_company_visible_to_workers_idx
  on public.contacts (company_id)
  where visible_to_workers = true and status = 'active';

-- =============================================================================
-- 2) Ensure RLS stays enabled (do not disable)
-- =============================================================================
alter table public.contacts enable row level security;

-- =============================================================================
-- 3) Worker SELECT only — approved, active, same company
-- =============================================================================
drop policy if exists contacts_worker_select_visible on public.contacts;

create policy contacts_worker_select_visible
  on public.contacts
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_auth_user_driver_id() is not null
    and not public.drevora_auth_user_has_office_role_for_company(company_id)
    and visible_to_workers = true
    and status = 'active'
  );

notify pgrst, 'reload schema';

commit;
