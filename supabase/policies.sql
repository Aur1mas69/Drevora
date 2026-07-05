-- =============================================================================
-- DREVORA Row Level Security
-- =============================================================================
-- Run after schema.sql in the Supabase SQL Editor.
-- Safe to re-run during MVP development.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- MVP — RLS disabled
-- All authenticated and anon clients can read/write during development.
-- Do NOT deploy to production with RLS disabled.
-- -----------------------------------------------------------------------------

alter table public.drivers disable row level security;
alter table public.vehicles disable row level security;
alter table public.vehicle_availability disable row level security;
alter table public.companies disable row level security;
alter table public.timesheets disable row level security;
alter table public.timesheet_entries disable row level security;
alter table public.holiday_requests disable row level security;
alter table public.vehicle_checks disable row level security;
alter table public.vehicle_check_items disable row level security;
alter table public.vehicle_check_templates enable row level security;
alter table public.worker_compliance_records disable row level security;
alter table public.vehicle_compliance_records disable row level security;
alter table public.consumables disable row level security;
alter table public.dashboard_notes enable row level security;


-- -----------------------------------------------------------------------------
-- MVP — API role grants
-- Required on PostgreSQL 15+ so anon/authenticated roles can access tables.
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.drivers to anon, authenticated;
grant select, insert, update, delete on public.vehicles to anon, authenticated;
grant select, insert, update, delete on public.vehicle_availability to anon, authenticated;
grant select, insert, update, delete on public.companies to anon, authenticated;
grant select, insert, update, delete on public.timesheets to anon, authenticated;
grant select, insert, update, delete on public.timesheet_entries to anon, authenticated;
grant select, insert, update, delete on public.holiday_requests to anon, authenticated;
grant select, insert, update, delete on public.vehicle_checks to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_items to anon, authenticated;
grant select on public.vehicle_check_templates to anon, authenticated;
grant select, insert, update, delete on public.worker_compliance_records to anon, authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;

create policy "Read active vehicle check templates"
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (is_active = true);
grant select, insert, update, delete on public.vehicle_compliance_records to anon, authenticated;
grant select, insert, update, delete on public.consumables to anon, authenticated;
grant select, insert, update, delete on public.dashboard_notes to anon, authenticated;

create or replace function public.drevora_current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;
$$;

drop policy if exists dashboard_notes_company_select on public.dashboard_notes;
drop policy if exists dashboard_notes_company_insert on public.dashboard_notes;
drop policy if exists dashboard_notes_company_update on public.dashboard_notes;
drop policy if exists dashboard_notes_company_delete on public.dashboard_notes;

create policy dashboard_notes_company_select
  on public.dashboard_notes
  for select
  to anon, authenticated
  using (company_id = public.drevora_current_company_id());

create policy dashboard_notes_company_insert
  on public.dashboard_notes
  for insert
  to anon, authenticated
  with check (company_id = public.drevora_current_company_id());

create policy dashboard_notes_company_update
  on public.dashboard_notes
  for update
  to anon, authenticated
  using (company_id = public.drevora_current_company_id())
  with check (company_id = public.drevora_current_company_id());

create policy dashboard_notes_company_delete
  on public.dashboard_notes
  for delete
  to anon, authenticated
  using (company_id = public.drevora_current_company_id());


-- -----------------------------------------------------------------------------
-- Storage — consumable receipt attachments
-- Bucket and storage.objects policies: see migrations
-- 20260705210000_consumable_receipts_storage_bucket.sql
-- 20260705310000_worker_avatars_storage_bucket.sql
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- Production — enable RLS and add policies (NOT active during MVP)
-- Uncomment and adapt before go-live. Example pattern shown below.
-- -----------------------------------------------------------------------------

-- alter table public.companies enable row level security;
--
-- create policy "Authenticated users can read company"
--   on public.companies
--   for select
--   to authenticated
--   using (true);
--
-- create policy "Authenticated users can update company"
--   on public.companies
--   for update
--   to authenticated
--   using (true)
--   with check (true);
--
-- create policy "Authenticated users can insert company"
--   on public.companies
--   for insert
--   to authenticated
--   with check (true);
--
-- Repeat similar company-scoped policies for drivers, vehicles, and
-- vehicle_availability once a company_id column links records to tenants.
