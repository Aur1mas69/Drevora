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
alter table public.vehicle_check_template_items enable row level security;
alter table public.worker_compliance_records disable row level security;
alter table public.vehicle_compliance_records disable row level security;
alter table public.consumables disable row level security;
alter table public.contacts disable row level security;
alter table public.documents disable row level security;
alter table public.driver_reports disable row level security;
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
grant select, insert, update, delete on public.vehicle_check_templates to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_template_items to anon, authenticated;
grant select, insert, update, delete on public.worker_compliance_records to anon, authenticated;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;
grant select, insert, update, delete on public.vehicle_compliance_records to anon, authenticated;
grant select, insert, update, delete on public.consumables to anon, authenticated;
grant select, insert, update, delete on public.contacts to anon, authenticated;
grant select, insert, update, delete on public.documents to anon, authenticated;
grant select, insert, update, delete on public.driver_reports to anon, authenticated;
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

create or replace function public.drevora_current_company_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  company_id uuid;
  resolved text;
begin
  select c.id
  into company_id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;

  if company_id is null then
    return null;
  end if;

  select nullif(trim(c.name), '')
  into resolved
  from public.companies c
  where c.id = company_id;

  if resolved is not null then
    return resolved;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'company_name'
  ) then
    execute
      'select nullif(trim(company_name), '''') from public.companies where id = $1'
      into resolved
      using company_id;

    if resolved is not null then
      return resolved;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'organisation_name'
  ) then
    execute
      'select nullif(trim(organisation_name), '''') from public.companies where id = $1'
      into resolved
      using company_id;

    if resolved is not null then
      return resolved;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.drevora_company_text_matches_current(company_value text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  company_id uuid;
  insert_value text;
  candidate text;
begin
  if company_value is null then
    return true;
  end if;

  insert_value := nullif(trim(company_value), '');
  if insert_value is null then
    return false;
  end if;

  select c.id
  into company_id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;

  if company_id is null then
    return false;
  end if;

  select nullif(trim(c.name), '')
  into candidate
  from public.companies c
  where c.id = company_id;

  if candidate is not null and lower(insert_value) = lower(candidate) then
    return true;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'company_name'
  ) then
    execute
      'select nullif(trim(company_name), '''') from public.companies where id = $1'
      into candidate
      using company_id;

    if candidate is not null and lower(insert_value) = lower(candidate) then
      return true;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'organisation_name'
  ) then
    execute
      'select nullif(trim(organisation_name), '''') from public.companies where id = $1'
      into candidate
      using company_id;

    if candidate is not null and lower(insert_value) = lower(candidate) then
      return true;
    end if;
  end if;

  return false;
end;
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

alter table public.vehicle_check_templates enable row level security;
alter table public.vehicle_check_template_items enable row level security;

drop policy if exists vehicle_check_templates_select_global on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_select_company on public.vehicle_check_templates;
drop policy if exists "Read active vehicle check templates" on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_select on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_insert on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_update on public.vehicle_check_templates;
drop policy if exists vehicle_check_templates_company_delete on public.vehicle_check_templates;

create policy vehicle_check_templates_company_select
  on public.vehicle_check_templates
  for select
  to anon, authenticated
  using (
    is_active = true
    and (
      company is null
      or public.drevora_company_text_matches_current(company)
    )
  );

create policy vehicle_check_templates_company_insert
  on public.vehicle_check_templates
  for insert
  to anon, authenticated
  with check (
    company is not null
    and public.drevora_company_text_matches_current(company)
    and coalesce(is_active, true) = true
  );

create policy vehicle_check_templates_company_update
  on public.vehicle_check_templates
  for update
  to anon, authenticated
  using (
    company is not null
    and public.drevora_company_text_matches_current(company)
  )
  with check (
    company is not null
    and public.drevora_company_text_matches_current(company)
  );

create policy vehicle_check_templates_company_delete
  on public.vehicle_check_templates
  for delete
  to anon, authenticated
  using (
    company is not null
    and public.drevora_company_text_matches_current(company)
  );

drop policy if exists vehicle_check_template_items_company_select on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_insert on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_update on public.vehicle_check_template_items;
drop policy if exists vehicle_check_template_items_company_delete on public.vehicle_check_template_items;

create policy vehicle_check_template_items_company_select
  on public.vehicle_check_template_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.is_active = true
        and (
          template.company is null
          or public.drevora_company_text_matches_current(template.company)
        )
    )
  );

create policy vehicle_check_template_items_company_insert
  on public.vehicle_check_template_items
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_company_text_matches_current(template.company)
    )
  );

create policy vehicle_check_template_items_company_update
  on public.vehicle_check_template_items
  for update
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_company_text_matches_current(template.company)
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_company_text_matches_current(template.company)
    )
  );

create policy vehicle_check_template_items_company_delete
  on public.vehicle_check_template_items
  for delete
  to anon, authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates template
      where template.id = vehicle_check_template_items.template_id
        and template.company is not null
        and public.drevora_company_text_matches_current(template.company)
    )
  );


-- -----------------------------------------------------------------------------
-- Storage — consumable receipt attachments
-- Bucket and storage.objects policies: see migrations
-- 20260705210000_consumable_receipts_storage_bucket.sql

-- Storage — vehicle check defect photos + worker signatures (bucket: vehicle-check-photos)
-- Bucket and storage.objects policies: see migrations
-- 20260709220000_vehicle_check_photos_storage_bucket.sql
-- Paste script: supabase/scripts/apply_vehicle_check_storage_bucket.sql

-- Vehicle check signature columns (vehicle_checks.signature_url, signed_at)
-- Script: supabase/scripts/apply_vehicle_check_signature.sql

-- Vehicle check inspection duration (vehicle_checks.inspection_started_at, etc.)
-- Script: supabase/scripts/apply_vehicle_check_inspection_duration.sql
-- 20260705310000_worker_avatars_storage_bucket.sql
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- Worker Timesheet settings — RLS ALWAYS ENABLED
-- Applied by 20260722190000_create_driver_timesheet_settings.sql
-- Worker self-select/insert/update/delete own row; office SELECT for company.
-- -----------------------------------------------------------------------------
alter table public.driver_timesheet_settings enable row level security;

revoke all on public.driver_timesheet_settings from public;
revoke all on public.driver_timesheet_settings from anon;
revoke all on public.driver_timesheet_settings from authenticated;

grant select, insert, update, delete on public.driver_timesheet_settings to authenticated;

drop policy if exists driver_timesheet_settings_office_select on public.driver_timesheet_settings;
create policy driver_timesheet_settings_office_select
  on public.driver_timesheet_settings
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

drop policy if exists driver_timesheet_settings_worker_select_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_select_own
  on public.driver_timesheet_settings
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );

drop policy if exists driver_timesheet_settings_worker_insert_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_insert_own
  on public.driver_timesheet_settings
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_id
        and d.company_id = company_id
    )
  );

drop policy if exists driver_timesheet_settings_worker_update_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_update_own
  on public.driver_timesheet_settings
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );

drop policy if exists driver_timesheet_settings_worker_delete_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_delete_own
  on public.driver_timesheet_settings
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );

-- -----------------------------------------------------------------------------
-- Admin notifications — RLS ALWAYS ENABLED (not MVP-open)
-- Applied by 20260718020000_create_admin_notifications.sql
-- Repair/upsert UPDATE: 20260720230000_ensure_admin_notifications.sql
-- Policies are created in those migrations (office company scope only).
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

revoke all on public.notifications from anon;
revoke all on public.notification_reads from anon;
revoke all on public.notifications from authenticated;
revoke all on public.notification_reads from authenticated;

grant select on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_reads to authenticated;

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

-- -----------------------------------------------------------------------------
-- Company trial-plan onboarding RPC
-- Canonical definition: migrations/20260720180000_company_subscription_plan_fields.sql
-- -----------------------------------------------------------------------------
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from public;
revoke all on function public.drevora_create_company_with_trial_plan(text, text) from anon;
grant execute on function public.drevora_create_company_with_trial_plan(text, text) to authenticated;
