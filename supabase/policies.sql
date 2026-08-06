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

-- Drivers: tenant RLS enabled (Archive/Restore lifecycle). See 20260726190000.
alter table public.drivers enable row level security;
-- Vehicles: tenant RLS enabled (Archive/Restore lifecycle). See 20260726180000.
alter table public.vehicles enable row level security;
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
-- Live tenant RLS for contacts (office CRUD + Worker SELECT of visible_to_workers)
-- is defined in migrations/20260715210000_enable_full_tenant_rls.sql and
-- migrations/20260728230000_contacts_visible_to_workers_and_worker_select.sql.
-- Do not grant Worker INSERT/UPDATE/DELETE. Do not backfill visible_to_workers.
alter table public.documents disable row level security;
alter table public.driver_reports disable row level security;
alter table public.dashboard_notes enable row level security;


-- -----------------------------------------------------------------------------
-- MVP — API role grants
-- Required on PostgreSQL 15+ so anon/authenticated roles can access tables.
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Drivers: tenant RLS + Archive/Restore RPCs.
-- Hard DELETE closed. Table INSERT/UPDATE revoked; column allowlists only.
-- Office UPDATE requires archived_at IS NULL. See 20260726190000.
-- Column allowlists exclude archived_at, retention_expires_at, and auth_user_id
-- (RPC / security-definer writes only). See 20260726190000 and 20260806200000.
-- Linked Worker email changes are blocked by drivers_login_email_guard unless
-- drevora.allow_worker_login_email_change=on (finalize RPC only). See 20260806220000.
revoke all on table public.drivers from anon;
revoke all on table public.drivers from public;
revoke delete on table public.drivers from authenticated;
revoke insert on table public.drivers from authenticated;
revoke update on table public.drivers from authenticated;
grant select on table public.drivers to authenticated;
grant insert (
  company_id,
  worker_code,
  first_name,
  last_name,
  email,
  phone,
  company,
  role,
  status,
  employment_type,
  paid_holiday_enabled,
  annual_paid_holiday_days,
  bank_holiday_entitlement_days,
  unpaid_leave_allowed,
  holiday_entitlement_notes,
  licence_categories,
  driving_licence_expiry,
  tacho_card_number,
  cpc_expiry,
  driver_card_expiry,
  medical_expiry,
  default_vehicle_id,
  start_date,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship,
  address_line_1,
  address_line_2,
  town_city,
  county,
  postcode,
  country,
  avatar_url
) on table public.drivers to authenticated;
grant update (
  worker_code,
  first_name,
  last_name,
  email,
  phone,
  company,
  role,
  status,
  employment_type,
  paid_holiday_enabled,
  annual_paid_holiday_days,
  bank_holiday_entitlement_days,
  unpaid_leave_allowed,
  holiday_entitlement_notes,
  licence_categories,
  driving_licence_expiry,
  tacho_card_number,
  cpc_expiry,
  driver_card_expiry,
  medical_expiry,
  adr_expiry,
  hiab_expiry,
  default_vehicle_id,
  start_date,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship,
  address_line_1,
  address_line_2,
  town_city,
  county,
  postcode,
  country,
  avatar_url,
  assigned_vehicle
) on table public.drivers to authenticated;

do $$
declare
  r record;
begin
  for r in
    select pol.polname as policy_name
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'drivers'
  loop
    execute format(
      'drop policy if exists %I on public.drivers',
      r.policy_name
    );
  end loop;
end $$;

create policy drivers_office_select
  on public.drivers
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy drivers_worker_select_own
  on public.drivers
  for select
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and id = public.drevora_auth_user_driver_id()
  );

create policy drivers_office_insert
  on public.drivers
  for insert
  to authenticated
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

create policy drivers_office_update
  on public.drivers
  for update
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

-- Vehicles: tenant RLS + Archive/Restore RPCs.
-- Hard DELETE closed. Table INSERT/UPDATE revoked; column allowlists only.
-- Column allowlists exclude archived_at, archive_reason, retention_expires_at (RPC-only).
-- Office UPDATE requires archived_at IS NULL (archived Vehicles are DB read-only).
-- See 20260726180000_vehicle_archive_restore_lifecycle.sql.
revoke all on table public.vehicles from anon;
revoke all on table public.vehicles from public;
revoke delete on table public.vehicles from authenticated;
revoke insert on table public.vehicles from authenticated;
revoke update on table public.vehicles from authenticated;
grant select on table public.vehicles to authenticated;
grant insert (
  company_id,
  registration,
  fleet_number,
  trailer_number,
  vehicle_type,
  make,
  model,
  year,
  vin,
  current_odometer,
  status,
  availability_status,
  current_driver_id,
  insurance_expiry,
  mot_expiry,
  road_tax_expiry,
  tachograph_expiry,
  off_road_reason,
  off_road_start_date,
  off_road_expected_return_date,
  off_road_start,
  off_road_return,
  off_road_notes,
  notes
) on table public.vehicles to authenticated;
grant update (
  registration,
  fleet_number,
  trailer_number,
  vehicle_type,
  make,
  model,
  year,
  vin,
  current_odometer,
  status,
  availability_status,
  current_driver_id,
  insurance_expiry,
  mot_expiry,
  road_tax_expiry,
  tachograph_expiry,
  off_road_reason,
  off_road_start_date,
  off_road_expected_return_date,
  off_road_start,
  off_road_return,
  off_road_notes,
  notes
) on table public.vehicles to authenticated;

-- Drop every existing Vehicles policy, then recreate the canonical four.
do $$
declare
  r record;
begin
  for r in
    select pol.polname as policy_name
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'vehicles'
  loop
    execute format(
      'drop policy if exists %I on public.vehicles',
      r.policy_name
    );
  end loop;
end $$;

create policy vehicles_office_select
  on public.vehicles
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicles_worker_select_company
  on public.vehicles
  for select
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_auth_user_driver_id() is not null
    and not public.drevora_auth_user_has_office_role_for_company(company_id)
  );

create policy vehicles_office_insert
  on public.vehicles
  for insert
  to authenticated
  with check (
    company_id is not null
    and archived_at is null
    and archive_reason is null
    and retention_expires_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      current_driver_id is null
      or public.drevora_driver_in_company(current_driver_id, company_id)
    )
  );

create policy vehicles_office_update
  on public.vehicles
  for update
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and (
      current_driver_id is null
      or public.drevora_driver_in_company(current_driver_id, company_id)
    )
  );

grant select, insert, update, delete on public.vehicle_availability to anon, authenticated;
grant select, insert, update, delete on public.companies to anon, authenticated;
grant select, insert, update, delete on public.timesheets to anon, authenticated;
grant select, insert, update, delete on public.timesheet_entries to anon, authenticated;
-- timesheet_submission_confirmations — Model B INSERT-only (see
-- 20260802140000_timesheet_submission_confirmations_rls.sql). Append-only audit;
-- clients do not SELECT/UPDATE/DELETE. Writes come from submitTimesheet.
alter table public.timesheet_submission_confirmations enable row level security;
revoke all on table public.timesheet_submission_confirmations from public;
revoke all on table public.timesheet_submission_confirmations from anon;
revoke all on table public.timesheet_submission_confirmations from authenticated;
grant insert on table public.timesheet_submission_confirmations to authenticated;
revoke update, delete, truncate on table public.timesheet_submission_confirmations from authenticated;
revoke update, delete, truncate on table public.timesheet_submission_confirmations from anon;

drop policy if exists timesheet_submission_confirmations_worker_insert_own
  on public.timesheet_submission_confirmations;
create policy timesheet_submission_confirmations_worker_insert_own
  on public.timesheet_submission_confirmations
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and confirmed_by_driver_id is not null
    and confirmed_by_driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(confirmed_by_driver_id, company_id)
    and exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id = company_id
        and t.driver_id = confirmed_by_driver_id
        and t.week_start = week_start
        and t.deleted_at is null
    )
  );

drop policy if exists timesheet_submission_confirmations_office_insert
  on public.timesheet_submission_confirmations;
create policy timesheet_submission_confirmations_office_insert
  on public.timesheet_submission_confirmations
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and confirmed_by_driver_id is not null
    and public.drevora_driver_in_company(confirmed_by_driver_id, company_id)
    and exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id = company_id
        and t.driver_id = confirmed_by_driver_id
        and t.week_start = week_start
        and t.deleted_at is null
    )
  );
-- Timesheet retention: column REVOKE is defense-in-depth only (see 20260726200000).
-- Table-level INSERT/UPDATE above still confers effective column access in PostgreSQL;
-- drevora_timesheets_retention_guard overwrites any client-supplied retention_expires_at.
revoke insert (retention_expires_at) on table public.timesheets from anon;
revoke update (retention_expires_at) on table public.timesheets from anon;
revoke insert (retention_expires_at) on table public.timesheets from authenticated;
revoke update (retention_expires_at) on table public.timesheets from authenticated;
grant select, insert, update, delete on public.holiday_requests to anon, authenticated;
-- Holiday created_at / retention: column REVOKE is defense-in-depth only (see 20260726210000).
-- Table-level INSERT/UPDATE above may still confer effective column access;
-- drevora_holiday_requests_created_at_retention_guard is authoritative.
revoke insert (created_at) on table public.holiday_requests from anon;
revoke update (created_at) on table public.holiday_requests from anon;
revoke insert (retention_expires_at) on table public.holiday_requests from anon;
revoke update (retention_expires_at) on table public.holiday_requests from anon;
revoke insert (created_at) on table public.holiday_requests from authenticated;
revoke update (created_at) on table public.holiday_requests from authenticated;
revoke insert (retention_expires_at) on table public.holiday_requests from authenticated;
revoke update (retention_expires_at) on table public.holiday_requests from authenticated;
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
-- Worker writes additionally gated by timesheet_management_scope = worker
-- (20260805183000_timesheet_management_scope_personal_overrides.sql).
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
    and public.drevora_company_workers_manage_timesheets(company_id)
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
    and public.drevora_company_workers_manage_timesheets(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_company_workers_manage_timesheets(company_id)
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_id
        and d.company_id = company_id
    )
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
    and public.drevora_company_workers_manage_timesheets(company_id)
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
-- Support requests (Worker Help & Support)
-- Applied by 20260801130000_create_support_requests.sql
-- Anon EXECUTE revoke on storage helpers:
--   20260802150000_revoke_anon_support_attachment_storage_execute.sql
-- -----------------------------------------------------------------------------
alter table public.support_requests enable row level security;

revoke all on table public.support_requests from anon;
revoke all on table public.support_requests from authenticated;

grant select, insert on table public.support_requests to authenticated;

-- support-attachments storage helpers (SECURITY DEFINER; used by storage.objects
-- policies TO authenticated only). Anonymous EXECUTE intentionally denied.
revoke all privileges on function public.drevora_storage_can_access_support_attachment(text) from anon;
revoke all privileges on function public.drevora_storage_can_access_support_attachment(text) from public;
grant execute on function public.drevora_storage_can_access_support_attachment(text) to authenticated;

revoke all privileges on function public.drevora_storage_can_write_support_attachment(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_support_attachment(text) from public;
grant execute on function public.drevora_storage_can_write_support_attachment(text) to authenticated;

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

-- =============================================================================
-- Tyre Checks — tenant RLS (NOT MVP-disabled)
-- Canonical: migrations/20260717220000_create_tyre_check_foundation.sql
--
-- Access model:
--   Office: company-scoped SELECT only (writes blocked by migration triggers)
--   Worker: own-row SELECT/INSERT/UPDATE/DELETE for draft/in_progress only
--   Anon: no privileges
--   Items: access always via parent tyre_checks ownership/company relationship
-- =============================================================================

create or replace function public.drevora_tyre_check_is_worker_editable(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_status in ('draft', 'in_progress');
$$;

revoke all on function public.drevora_tyre_wear_percent(numeric) from public;
revoke all on function public.drevora_tyre_wear_percent(numeric) from anon;
revoke all on function public.drevora_tyre_wear_percent(numeric) from authenticated;
grant execute on function public.drevora_tyre_wear_percent(numeric) to authenticated;

revoke all on function public.drevora_tyre_tread_status(numeric) from public;
revoke all on function public.drevora_tyre_tread_status(numeric) from anon;
revoke all on function public.drevora_tyre_tread_status(numeric) from authenticated;
grant execute on function public.drevora_tyre_tread_status(numeric) to authenticated;

revoke all on function public.drevora_tyre_check_is_worker_editable(text) from public;
revoke all on function public.drevora_tyre_check_is_worker_editable(text) from anon;
revoke all on function public.drevora_tyre_check_is_worker_editable(text) from authenticated;
grant execute on function public.drevora_tyre_check_is_worker_editable(text) to authenticated;

alter table public.tyre_checks enable row level security;
alter table public.tyre_check_items enable row level security;

revoke all on table public.tyre_checks from public;
revoke all on table public.tyre_checks from anon;
revoke all on table public.tyre_check_items from public;
revoke all on table public.tyre_check_items from anon;

grant select, insert, update, delete on table public.tyre_checks to authenticated;
grant select, insert, update, delete on table public.tyre_check_items to authenticated;

drop policy if exists tyre_checks_office_select on public.tyre_checks;
create policy tyre_checks_office_select
  on public.tyre_checks
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

drop policy if exists tyre_checks_worker_select_own on public.tyre_checks;
create policy tyre_checks_worker_select_own
  on public.tyre_checks
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
  );

drop policy if exists tyre_checks_worker_insert_own on public.tyre_checks;
create policy tyre_checks_worker_insert_own
  on public.tyre_checks
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and (
      trailer_vehicle_id is null
      or public.drevora_vehicle_in_company(trailer_vehicle_id, company_id)
    )
    and public.drevora_driver_in_company(worker_id, company_id)
    and status in ('draft', 'in_progress')
  );

drop policy if exists tyre_checks_worker_update_own on public.tyre_checks;
create policy tyre_checks_worker_update_own
  on public.tyre_checks
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_tyre_check_is_worker_editable(status)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and (
      trailer_vehicle_id is null
      or public.drevora_vehicle_in_company(trailer_vehicle_id, company_id)
    )
    and public.drevora_driver_in_company(worker_id, company_id)
    and status in ('draft', 'in_progress', 'submitted')
  );

drop policy if exists tyre_checks_worker_delete_own on public.tyre_checks;
create policy tyre_checks_worker_delete_own
  on public.tyre_checks
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and worker_id = public.drevora_auth_user_driver_id()
    and public.drevora_tyre_check_is_worker_editable(status)
  );

drop policy if exists tyre_check_items_office_select on public.tyre_check_items;
create policy tyre_check_items_office_select
  on public.tyre_check_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(tc.company_id)
    )
  );

drop policy if exists tyre_check_items_worker_select_own on public.tyre_check_items;
create policy tyre_check_items_worker_select_own
  on public.tyre_check_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
    )
  );

drop policy if exists tyre_check_items_worker_insert_own on public.tyre_check_items;
create policy tyre_check_items_worker_insert_own
  on public.tyre_check_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  );

drop policy if exists tyre_check_items_worker_update_own on public.tyre_check_items;
create policy tyre_check_items_worker_update_own
  on public.tyre_check_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  )
  with check (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  );

drop policy if exists tyre_check_items_worker_delete_own on public.tyre_check_items;
create policy tyre_check_items_worker_delete_own
  on public.tyre_check_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tyre_checks tc
      where tc.id = tyre_check_id
        and tc.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(tc.company_id)
        and tc.worker_id = public.drevora_auth_user_driver_id()
        and public.drevora_tyre_check_is_worker_editable(tc.status)
    )
  );

-- -----------------------------------------------------------------------------
-- Vehicle Tyre Layouts (persisted default per-axle Single/Dual per Vehicle)
-- Canonical: migrations/20260728090000_tyre_check_configurable_axle_layout.sql
-- and 20260728220000_fix_tyre_layout_rpc_and_position_constraint.sql
--
-- Read-only for authenticated company members (Worker + Office). Every write
-- goes through the SECURITY DEFINER RPC drevora_set_vehicle_tyre_layout(uuid,
-- text[]) — no INSERT/UPDATE/DELETE grant or policy exists for authenticated.
-- -----------------------------------------------------------------------------
alter table public.vehicle_tyre_layouts enable row level security;

revoke all on table public.vehicle_tyre_layouts from public;
revoke all on table public.vehicle_tyre_layouts from anon;

grant select on table public.vehicle_tyre_layouts to authenticated;

drop policy if exists vehicle_tyre_layouts_company_select on public.vehicle_tyre_layouts;
create policy vehicle_tyre_layouts_company_select
  on public.vehicle_tyre_layouts
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
  );

-- -----------------------------------------------------------------------------
-- Legal document versions + acceptances (select-only for authenticated)
-- Canonical: migrations/20260801140000_legal_documents_and_acceptances.sql
-- Hardening: migrations/20260801150000_harden_legal_acceptance_audit.sql
-- Writes go through SECURITY DEFINER RPCs — no INSERT/UPDATE/DELETE grants.
-- SELECT: office-role (company) or own worker rows. ACCEPT is Admin-only via RPC
-- (drevora_auth_user_has_admin_role_for_company); status RPCs stay office-role.
-- -----------------------------------------------------------------------------
alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_document_versions from anon;
revoke all on table public.legal_document_versions from public;
revoke all on table public.legal_document_versions from authenticated;

revoke all on table public.legal_acceptances from anon;
revoke all on table public.legal_acceptances from public;
revoke all on table public.legal_acceptances from authenticated;

grant select on table public.legal_document_versions to authenticated;
grant select on table public.legal_acceptances to authenticated;

drop policy if exists legal_document_versions_authenticated_select
  on public.legal_document_versions;
create policy legal_document_versions_authenticated_select
  on public.legal_document_versions
  for select
  to authenticated
  using (
    published_at is not null
    or is_current = true
  );

drop policy if exists legal_acceptances_office_select_company
  on public.legal_acceptances;
create policy legal_acceptances_office_select_company
  on public.legal_acceptances
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

drop policy if exists legal_acceptances_worker_select_own
  on public.legal_acceptances;
create policy legal_acceptances_worker_select_own
  on public.legal_acceptances
  for select
  to authenticated
  using (
    subject_type = 'worker'
    and driver_id is not null
    and driver_id = public.drevora_auth_user_driver_id()
    and company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
  );

-- -----------------------------------------------------------------------------
-- Auth/company SECURITY DEFINER helper EXECUTE
-- Canonical: migrations/20260802160000_restrict_internal_auth_company_helper_execute.sql
-- Internal-only (no authenticated EXECUTE): company_ids, driver_company_text,
-- has_office_role(), resolve_unique_company_id, vehicle_check_company_matches_auth_user.
-- RLS / INVOKER-trigger helpers keep authenticated EXECUTE.
-- -----------------------------------------------------------------------------
revoke all privileges on function public.drevora_auth_user_company_ids() from public;
revoke all privileges on function public.drevora_auth_user_company_ids() from anon;
revoke all privileges on function public.drevora_auth_user_company_ids() from authenticated;
grant execute on function public.drevora_auth_user_company_ids() to service_role;

revoke all privileges on function public.drevora_auth_user_driver_company_text() from public;
revoke all privileges on function public.drevora_auth_user_driver_company_text() from anon;
revoke all privileges on function public.drevora_auth_user_driver_company_text() from authenticated;
grant execute on function public.drevora_auth_user_driver_company_text() to service_role;

revoke all privileges on function public.drevora_auth_user_has_office_role() from public;
revoke all privileges on function public.drevora_auth_user_has_office_role() from anon;
revoke all privileges on function public.drevora_auth_user_has_office_role() from authenticated;
grant execute on function public.drevora_auth_user_has_office_role() to service_role;

revoke all privileges on function public.drevora_resolve_unique_company_id(text) from public;
revoke all privileges on function public.drevora_resolve_unique_company_id(text) from anon;
revoke all privileges on function public.drevora_resolve_unique_company_id(text) from authenticated;
grant execute on function public.drevora_resolve_unique_company_id(text) to service_role;

revoke all privileges on function public.drevora_vehicle_check_company_matches_auth_user(text) from public;
revoke all privileges on function public.drevora_vehicle_check_company_matches_auth_user(text) from anon;
revoke all privileges on function public.drevora_vehicle_check_company_matches_auth_user(text) from authenticated;
grant execute on function public.drevora_vehicle_check_company_matches_auth_user(text) to service_role;

revoke all privileges on function public.drevora_auth_user_belongs_to_company_id(uuid) from public;
revoke all privileges on function public.drevora_auth_user_belongs_to_company_id(uuid) from anon;
grant execute on function public.drevora_auth_user_belongs_to_company_id(uuid) to authenticated;

revoke all privileges on function public.drevora_auth_user_driver_id() from public;
revoke all privileges on function public.drevora_auth_user_driver_id() from anon;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;

revoke all privileges on function public.drevora_auth_user_has_office_role_for_company(uuid) from public;
revoke all privileges on function public.drevora_auth_user_has_office_role_for_company(uuid) from anon;
grant execute on function public.drevora_auth_user_has_office_role_for_company(uuid) to authenticated;

revoke all privileges on function public.drevora_current_company_id() from public;
revoke all privileges on function public.drevora_current_company_id() from anon;
grant execute on function public.drevora_current_company_id() to authenticated;

revoke all privileges on function public.drevora_current_company_name() from public;
revoke all privileges on function public.drevora_current_company_name() from anon;
grant execute on function public.drevora_current_company_name() to authenticated;

revoke all privileges on function public.drevora_company_text_matches_current(text) from public;
revoke all privileges on function public.drevora_company_text_matches_current(text) from anon;
grant execute on function public.drevora_company_text_matches_current(text) to authenticated;

revoke all privileges on function public.drevora_driver_in_company(uuid, uuid) from public;
revoke all privileges on function public.drevora_driver_in_company(uuid, uuid) from anon;
grant execute on function public.drevora_driver_in_company(uuid, uuid) to authenticated;

revoke all privileges on function public.drevora_vehicle_in_company(uuid, uuid) from public;
revoke all privileges on function public.drevora_vehicle_in_company(uuid, uuid) from anon;
grant execute on function public.drevora_vehicle_in_company(uuid, uuid) to authenticated;

revoke all privileges on function public.drevora_is_trusted_tenant_writer() from public;
revoke all privileges on function public.drevora_is_trusted_tenant_writer() from anon;
grant execute on function public.drevora_is_trusted_tenant_writer() to authenticated;

-- -----------------------------------------------------------------------------
-- Account deletion requests (SELECT-own only)
-- Canonical: migrations/20260803180000_create_account_deletion_requests.sql
-- Writes go through Edge Function delete-account (service_role) — no client INSERT/UPDATE/DELETE.
-- -----------------------------------------------------------------------------
alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from public;
revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from authenticated;

grant select on table public.account_deletion_requests to authenticated;
grant all on table public.account_deletion_requests to service_role;

drop policy if exists account_deletion_requests_select_own
  on public.account_deletion_requests;
create policy account_deletion_requests_select_own
  on public.account_deletion_requests
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Worker identity events (office SELECT; no client writes)
-- Canonical: migrations/20260806200000_worker_identity_foundation.sql
-- Writes go through drevora_insert_worker_identity_event / invite RPC (security definer).
-- -----------------------------------------------------------------------------
alter table public.worker_identity_events enable row level security;

revoke all on table public.worker_identity_events from public;
revoke all on table public.worker_identity_events from anon;
revoke all on table public.worker_identity_events from authenticated;

grant select on table public.worker_identity_events to authenticated;
grant all on table public.worker_identity_events to service_role;

drop policy if exists worker_identity_events_office_select_company
  on public.worker_identity_events;
create policy worker_identity_events_office_select_company
  on public.worker_identity_events
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — client writes forbidden.

-- -----------------------------------------------------------------------------
-- Worker identity events list RPC (canonical: 20260806230000_worker_identity_events_list_rpc.sql)
-- -----------------------------------------------------------------------------
revoke all on function public.drevora_list_worker_identity_events(uuid) from public;
revoke all on function public.drevora_list_worker_identity_events(uuid) from anon;
grant execute on function public.drevora_list_worker_identity_events(uuid) to authenticated;
grant execute on function public.drevora_list_worker_identity_events(uuid) to service_role;
