-- DREVORA — Vehicle Archive / Restore lifecycle + 72-month profile retention
-- File: supabase/migrations/20260726180000_vehicle_archive_restore_lifecycle.sql
--
-- Purpose:
--   1) Add archive_reason (archived_at already exists from 20260720200000).
--   2) Add retention_expires_at for the minimal archived Vehicle profile shell
--      (archived_at + 6 calendar years / 72 months). Metadata only — no auto-delete.
--   3) Office-only SECURITY DEFINER RPCs for archive + restore with plan-slot checks.
--   4) On archive: clear vehicles.current_driver_id and same-company
--      drivers.default_vehicle_id pointing at the vehicle (atomic with archive).
--   5) Enable tenant-safe Vehicles RLS (Office CRUD without DELETE; Worker active SELECT).
--   6) Atomically replace every Vehicles policy; Office UPDATE only when archived_at IS NULL.
--   7) Revoke client hard DELETE and table-level INSERT/UPDATE; grant column allowlists
--      so authenticated clients cannot bypass Archive/Restore RPCs via archived_at /
--      archive_reason / retention_expires_at / company_id / id / created_at writes.
--
-- Idempotent. Does not modify historical operational rows or Storage objects.
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.
--
-- Plan limits remain: companies.plan_code → drevora_active_vehicle_limit_for_plan
-- Active seat rule: vehicles.archived_at IS NULL (unchanged; retention_expires_at ignored).
-- Restore never reassigns current_driver_id / default_vehicle_id.
-- Historical Vehicle Checks / Tyre Checks / Driver Reports / Documents / Consumables
-- keep their own independent retention (not modified here).
--
-- Helpers (must already exist from 20260715210000_enable_full_tenant_rls.sql):
--   drevora_auth_user_has_office_role_for_company(uuid)
--   drevora_auth_user_belongs_to_company_id(uuid)
--   drevora_auth_user_driver_id()
--   drevora_driver_in_company(uuid, uuid)

-- =============================================================================
-- 0) Pre-apply diagnostics (commented — run manually before apply)
-- =============================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'vehicles'
--   and column_name in (
--     'id', 'company_id', 'created_at', 'archived_at', 'archive_reason',
--     'retention_expires_at', 'current_driver_id'
--   )
-- order by column_name;
--
-- select
--   count(*) filter (where archived_at is not null) as archived_total,
--   count(*) filter (
--     where archived_at is not null and archive_reason is null
--   ) as archived_null_reason,
--   count(*) filter (
--     where archived_at is not null and retention_expires_at is null
--   ) as archived_null_retention,
--   count(*) filter (
--     where archived_at is not null and current_driver_id is not null
--   ) as archived_still_assigned
-- from public.vehicles;
--
-- select count(*) as workers_defaulting_to_archived
-- from public.drivers d
-- join public.vehicles v on v.id = d.default_vehicle_id
-- where v.archived_at is not null;
--
-- select c.plan_code,
--        public.drevora_active_vehicle_limit_for_plan(c.plan_code) as plan_limit,
--        (select count(*) from public.vehicles v
--          where v.company_id = c.id and v.archived_at is null) as active_count
-- from public.companies c;

begin;

-- =============================================================================
-- 1) archive_reason column
-- =============================================================================
alter table public.vehicles
  add column if not exists archive_reason text;

comment on column public.vehicles.archive_reason is
  'Why the Vehicle was archived (Sold, Returned to lease, Written off, Other). NULL when active. Legacy archived rows may retain NULL until re-archived via RPC.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicles_archive_reason_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_archive_reason_check
      check (
        archive_reason is null
        or archive_reason in (
          'Sold',
          'Returned to lease',
          'Written off',
          'Other'
        )
      );
  end if;
end $$;

-- =============================================================================
-- 1b) retention_expires_at (minimal archived Vehicle profile shell only)
-- =============================================================================
alter table public.vehicles
  add column if not exists retention_expires_at timestamptz;

comment on column public.vehicles.retention_expires_at is
  'UTC deadline for minimum archived Vehicle profile retention (archived_at + 6 calendar years / 72 months). Applies only to the minimal archived Vehicle profile shell. Metadata for a future reviewed retention workflow — does not cause automatic deletion. NULL when active.';

-- Drop lifecycle triggers before backfill so re-applies remain idempotent even when
-- legacy archived rows still have NULL archive_reason (reported in diagnostics; never invented).
drop trigger if exists vehicles_archive_reason_guard on public.vehicles;
drop trigger if exists vehicles_lifecycle_guard on public.vehicles;

-- Deterministic backfill for already-archived Vehicles only.
-- Does not invent archive_reason or modify archived_at / active rows.
update public.vehicles v
set retention_expires_at = v.archived_at + interval '6 years'
where v.archived_at is not null
  and (
    v.retention_expires_at is null
    or v.retention_expires_at is distinct from (v.archived_at + interval '6 years')
  );

-- Lifecycle consistency: archive reason + retention. SECURITY INVOKER.
-- Direct client Archive/Restore bypass is blocked by column UPDATE privileges + RLS.
-- Single trigger — extend this guard; do not add a competing Vehicles lifecycle trigger.
create or replace function public.drevora_vehicles_archive_reason_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.archived_at is null then
    if new.archive_reason is not null
      or new.retention_expires_at is not null then
      raise exception 'VEHICLE_LIFECYCLE_INVALID'
        using errcode = 'P0001',
              hint = 'Active Vehicles cannot have archive_reason or retention_expires_at.';
    end if;
    new.archive_reason := null;
    new.retention_expires_at := null;
  else
    if new.archive_reason is null
      or btrim(new.archive_reason) = '' then
      raise exception 'VEHICLE_ARCHIVE_REASON_REQUIRED'
        using errcode = 'P0001',
              hint = 'An archive reason is required when archiving a Vehicle.';
    end if;
    if new.retention_expires_at is null then
      raise exception 'VEHICLE_RETENTION_REQUIRED'
        using errcode = 'P0001',
              hint = 'Archived Vehicles require retention_expires_at.';
    end if;
    if new.retention_expires_at <= new.archived_at then
      raise exception 'VEHICLE_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'retention_expires_at must be after archived_at.';
    end if;
    if new.retention_expires_at is distinct from (new.archived_at + interval '6 years') then
      raise exception 'VEHICLE_RETENTION_INVALID'
        using errcode = 'P0001',
              hint = 'retention_expires_at must equal archived_at + 6 calendar years.';
    end if;
  end if;
  return new;
end;
$$;

create trigger vehicles_archive_reason_guard
  before insert or update of archived_at, archive_reason, retention_expires_at
  on public.vehicles
  for each row
  execute function public.drevora_vehicles_archive_reason_guard();

-- =============================================================================
-- 2) Archive RPC (Office + company-scoped)
-- =============================================================================
create or replace function public.drevora_archive_vehicle(
  p_vehicle_id uuid,
  p_archive_reason text,
  p_archive_date date default (transaction_timestamp() at time zone 'utc')::date
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.vehicles%rowtype;
  v_reason text := btrim(coalesce(p_archive_reason, ''));
  v_today date := (transaction_timestamp() at time zone 'utc')::date;
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'VEHICLE_ARCHIVE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_vehicle_id is null then
    raise exception 'VEHICLE_ARCHIVE_INVALID'
      using errcode = '22023',
            hint = 'Vehicle id is required.';
  end if;

  if v_reason not in ('Sold', 'Returned to lease', 'Written off', 'Other') then
    raise exception 'VEHICLE_ARCHIVE_REASON_REQUIRED'
      using errcode = 'P0001',
            hint = 'Choose Sold, Returned to lease, Written off, or Other.';
  end if;

  if p_archive_date is null then
    raise exception 'VEHICLE_ARCHIVE_INVALID'
      using errcode = '22023',
            hint = 'Archive date is required.';
  end if;

  if p_archive_date > v_today then
    raise exception 'VEHICLE_ARCHIVE_FUTURE_DATE'
      using errcode = 'P0001',
            hint = 'Archive date cannot be in the future.';
  end if;

  select *
  into v_row
  from public.vehicles v
  where v.id = p_vehicle_id
  for update;

  if not found then
    raise exception 'VEHICLE_ARCHIVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Vehicle not found.';
  end if;

  if v_row.company_id is null
    or not public.drevora_auth_user_has_office_role_for_company(v_row.company_id) then
    raise exception 'VEHICLE_ARCHIVE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if v_row.archived_at is not null then
    raise exception 'VEHICLE_ALREADY_ARCHIVED'
      using errcode = 'P0001',
            hint = 'This Vehicle is already archived.';
  end if;

  -- Authoritative archived_at (timestamptz). Same value drives retention_expires_at.
  -- Today: transaction_timestamp() (timestamptz; do not wrap with timezone()).
  -- Explicit past date: noon UTC as timestamptz via AT TIME ZONE 'UTC'.
  if p_archive_date = v_today then
    v_archived_at := transaction_timestamp();
  else
    v_archived_at := (p_archive_date::timestamp + time '12:00') at time zone 'utc';
  end if;

  -- Clear current assignment pointers in the same transaction as archive.
  -- Historical Vehicle Checks / Consumables / Reports keep vehicle_id references.
  update public.drivers d
  set default_vehicle_id = null
  where d.default_vehicle_id = p_vehicle_id
    and d.company_id = v_row.company_id;

  update public.vehicles v
  set
    current_driver_id = null,
    archived_at = v_archived_at,
    archive_reason = v_reason,
    retention_expires_at = v_archived_at + interval '6 years'
  where v.id = p_vehicle_id
    and v.company_id = v_row.company_id
  returning * into v_row;

  if not found then
    raise exception 'VEHICLE_ARCHIVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Vehicle could not be archived for this company.';
  end if;

  return v_row;
end;
$$;

comment on function public.drevora_archive_vehicle(uuid, text, date) is
  'Office-only soft-archive: clears current Worker assignment pointers, sets archived_at, archive_reason, and retention_expires_at (archived_at + 6 years). Never deletes the row or historical records.';

-- =============================================================================
-- 3) Restore RPC (Office + company-scoped; plan seat enforced by existing trigger)
-- =============================================================================
create or replace function public.drevora_restore_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.vehicles%rowtype;
  v_plan_code text;
  v_limit integer;
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'VEHICLE_RESTORE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_vehicle_id is null then
    raise exception 'VEHICLE_RESTORE_INVALID'
      using errcode = '22023',
            hint = 'Vehicle id is required.';
  end if;

  select *
  into v_row
  from public.vehicles v
  where v.id = p_vehicle_id
  for update;

  if not found then
    raise exception 'VEHICLE_RESTORE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Vehicle not found.';
  end if;

  if v_row.company_id is null
    or not public.drevora_auth_user_has_office_role_for_company(v_row.company_id) then
    raise exception 'VEHICLE_RESTORE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if v_row.archived_at is null then
    raise exception 'VEHICLE_NOT_ARCHIVED'
      using errcode = 'P0001',
            hint = 'This Vehicle is already active.';
  end if;

  -- Lock company + re-check seat before clearing archive (race-safe with trigger).
  select c.plan_code
  into v_plan_code
  from public.companies c
  where c.id = v_row.company_id
  for update;

  if not found then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Vehicle plan allowance check.';
  end if;

  v_limit := public.drevora_active_vehicle_limit_for_plan(v_plan_code);
  if v_limit is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan before restoring Vehicles.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.vehicles v
  where v.company_id = v_row.company_id
    and v.archived_at is null;

  if v_active_count >= v_limit then
    raise exception 'VEHICLE_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Your vehicle limit has been reached. Archive another vehicle or upgrade your plan before restoring this vehicle.';
  end if;

  -- Clear lifecycle only. Do not restore Worker assignments.
  update public.vehicles v
  set
    archived_at = null,
    archive_reason = null,
    retention_expires_at = null
  where v.id = p_vehicle_id
    and v.company_id = v_row.company_id
  returning * into v_row;

  if not found then
    raise exception 'VEHICLE_RESTORE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Vehicle could not be restored for this company.';
  end if;

  return v_row;
end;
$$;

comment on function public.drevora_restore_vehicle(uuid) is
  'Office-only restore of an archived Vehicle when an active plan seat is available. Clears archived_at, archive_reason, and retention_expires_at. Does not restore Worker assignments.';

revoke all on function public.drevora_archive_vehicle(uuid, text, date) from public;
revoke all on function public.drevora_archive_vehicle(uuid, text, date) from anon;
revoke all on function public.drevora_restore_vehicle(uuid) from public;
revoke all on function public.drevora_restore_vehicle(uuid) from anon;
revoke all on function public.drevora_vehicles_archive_reason_guard() from public;
revoke all on function public.drevora_vehicles_archive_reason_guard() from anon;

grant execute on function public.drevora_archive_vehicle(uuid, text, date) to authenticated;
grant execute on function public.drevora_restore_vehicle(uuid) to authenticated;

-- =============================================================================
-- 4) Enable Vehicles RLS (not FORCE — SECURITY DEFINER RPCs must keep working)
-- =============================================================================
alter table public.vehicles enable row level security;

-- Atomically replace EVERY policy attached to public.vehicles (no leftover legacy).
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

-- Canonical four policies only (no DELETE policy).

-- Office: own-company active + archived (Admin Archived filter / Restore / profile).
create policy vehicles_office_select
  on public.vehicles
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

-- Worker: own-company active only (never archived).
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

-- Office insert: active only; driver must be null or same company.
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

-- Office update: active Vehicles only (archived rows are DB read-only for clients).
-- Archive/Restore RPCs still mutate lifecycle via SECURITY DEFINER (RLS not forced).
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

-- =============================================================================
-- 5) Client grants — column INSERT + column UPDATE allowlists (no table INSERT/UPDATE)
-- =============================================================================
revoke all on table public.vehicles from anon;
revoke all on table public.vehicles from public;

revoke delete on table public.vehicles from authenticated;
revoke insert on table public.vehicles from authenticated;
revoke update on table public.vehicles from authenticated;

grant select on table public.vehicles to authenticated;

-- INSERT allowlist = company_id + vehiclesService.buildVehiclePayload / createVehicle.
-- Excludes: id, created_at, archived_at, archive_reason, retention_expires_at
-- (and any other unmanaged cols). Lifecycle writes are RPC-only.
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

-- UPDATE allowlist = vehiclesService.buildVehiclePayload (Admin Edit/assignment).
-- Excludes: id, company_id, created_at, archived_at, archive_reason, retention_expires_at.
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

commit;

-- =============================================================================
-- 6) Post-apply diagnostics (commented — after COMMIT only)
-- =============================================================================
-- -- 1) RLS enabled and not forced
-- select c.relname,
--        c.relrowsecurity as rls_enabled,
--        c.relforcerowsecurity as rls_forced
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'vehicles';
-- -- Expected: rls_enabled = true, rls_forced = false
--
-- -- 2) Exactly four Vehicles policies; zero unknown/legacy; zero DELETE
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'vehicles'
-- order by policyname;
--
-- select count(*) as vehicles_policy_count
-- from pg_policies
-- where schemaname = 'public' and tablename = 'vehicles';
-- -- Expected: 4
--
-- select policyname
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'vehicles'
--   and policyname not in (
--     'vehicles_office_select',
--     'vehicles_worker_select_company',
--     'vehicles_office_insert',
--     'vehicles_office_update'
--   );
-- -- Expected: zero rows
--
-- select policyname
-- from pg_policies
-- where schemaname = 'public' and tablename = 'vehicles' and cmd = 'DELETE';
-- -- Expected: zero rows
--
-- -- 3) Table privileges (no table-level INSERT/UPDATE for authenticated)
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'vehicles'
-- order by grantee, privilege_type;
--
-- select
--   has_table_privilege('anon', 'public.vehicles', 'SELECT') as anon_select,
--   has_table_privilege('anon', 'public.vehicles', 'INSERT') as anon_insert,
--   has_table_privilege('anon', 'public.vehicles', 'UPDATE') as anon_update,
--   has_table_privilege('anon', 'public.vehicles', 'DELETE') as anon_delete,
--   has_table_privilege('authenticated', 'public.vehicles', 'SELECT') as auth_select,
--   has_table_privilege('authenticated', 'public.vehicles', 'DELETE') as auth_delete;
-- -- Expected: anon all false; auth_select true; auth_delete false
--
-- select privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'vehicles'
--   and grantee = 'authenticated'
--   and privilege_type in ('INSERT', 'UPDATE');
-- -- Expected: zero rows (column privileges only)
--
-- -- 4) Column INSERT privileges
-- select column_name
-- from information_schema.column_privileges
-- where table_schema = 'public'
--   and table_name = 'vehicles'
--   and grantee = 'authenticated'
--   and privilege_type = 'INSERT'
-- order by column_name;
-- -- Expected: company_id + Add Vehicle payload fields only
--
-- select
--   has_column_privilege('authenticated', 'public.vehicles', 'company_id', 'INSERT') as can_ins_company_id,
--   has_column_privilege('authenticated', 'public.vehicles', 'registration', 'INSERT') as can_ins_registration,
--   has_column_privilege('authenticated', 'public.vehicles', 'id', 'INSERT') as can_ins_id,
--   has_column_privilege('authenticated', 'public.vehicles', 'created_at', 'INSERT') as can_ins_created_at,
--   has_column_privilege('authenticated', 'public.vehicles', 'archived_at', 'INSERT') as can_ins_archived_at,
--   has_column_privilege('authenticated', 'public.vehicles', 'archive_reason', 'INSERT') as can_ins_archive_reason,
--   has_column_privilege('authenticated', 'public.vehicles', 'retention_expires_at', 'INSERT') as can_ins_retention;
-- -- Expected: company_id/registration true; lifecycle/immutable false
--
-- -- 5) Column UPDATE privileges
-- select column_name
-- from information_schema.column_privileges
-- where table_schema = 'public'
--   and table_name = 'vehicles'
--   and grantee = 'authenticated'
--   and privilege_type = 'UPDATE'
-- order by column_name;
--
-- select
--   has_column_privilege('authenticated', 'public.vehicles', 'registration', 'UPDATE') as can_upd_registration,
--   has_column_privilege('authenticated', 'public.vehicles', 'current_driver_id', 'UPDATE') as can_upd_current_driver,
--   has_column_privilege('authenticated', 'public.vehicles', 'archived_at', 'UPDATE') as can_upd_archived_at,
--   has_column_privilege('authenticated', 'public.vehicles', 'archive_reason', 'UPDATE') as can_upd_archive_reason,
--   has_column_privilege('authenticated', 'public.vehicles', 'retention_expires_at', 'UPDATE') as can_upd_retention,
--   has_column_privilege('authenticated', 'public.vehicles', 'company_id', 'UPDATE') as can_upd_company_id,
--   has_column_privilege('authenticated', 'public.vehicles', 'id', 'UPDATE') as can_upd_id,
--   has_column_privilege('authenticated', 'public.vehicles', 'created_at', 'UPDATE') as can_upd_created_at;
-- -- Expected: registration/current_driver true; lifecycle/immutable false
--
-- -- 6) Lifecycle consistency diagnostics (read-only)
-- select count(*) as active_with_lifecycle_values
-- from public.vehicles
-- where archived_at is null
--   and (archive_reason is not null or retention_expires_at is not null);
-- -- Expected: 0
--
-- select id, company_id, archived_at, archive_reason, retention_expires_at
-- from public.vehicles
-- where archived_at is not null
--   and (archive_reason is null or btrim(archive_reason) = '');
-- -- Report only — do not invent archive_reason
--
-- select id, company_id, archived_at, retention_expires_at
-- from public.vehicles
-- where archived_at is not null
--   and retention_expires_at is null;
-- -- Expected: 0 after backfill
--
-- select id, company_id, archived_at, retention_expires_at,
--        archived_at + interval '6 years' as expected_retention
-- from public.vehicles
-- where archived_at is not null
--   and retention_expires_at is distinct from (archived_at + interval '6 years');
-- -- Expected: 0 after backfill
--
-- select id, company_id, current_driver_id, archived_at
-- from public.vehicles
-- where archived_at is not null
--   and current_driver_id is not null;
-- -- Expected: 0 after Archive RPC cleanup (legacy may need re-archive)
--
-- select d.id as worker_id, d.default_vehicle_id, v.archived_at
-- from public.drivers d
-- join public.vehicles v on v.id = d.default_vehicle_id
-- where v.archived_at is not null;
-- -- Expected: 0 after Archive RPC cleanup
--
-- select
--   count(*) filter (where archived_at is null) as active_count,
--   count(*) filter (where archived_at is not null) as archived_count
-- from public.vehicles;
--
-- select c.id as company_id,
--        c.plan_code,
--        public.drevora_active_vehicle_limit_for_plan(c.plan_code) as plan_limit,
--        (select count(*) from public.vehicles v
--          where v.company_id = c.id and v.archived_at is null) as active_slot_count
-- from public.companies c
-- order by c.id;
--
-- -- 7) Behavioural checks (Office / Worker JWTs):
-- -- Office UPDATE registration on ACTIVE vehicle → success
-- -- Office UPDATE registration on ARCHIVED vehicle → fail (RLS USING archived_at IS NULL)
-- -- Office UPDATE archived_at / archive_reason / retention_expires_at → fail (column privilege)
-- -- Normal Add Vehicle INSERT → success
-- -- INSERT with archived_at / archive_reason / retention_expires_at / id → fail
-- -- Worker SELECT active own-company → rows; archived → zero
-- -- Cross-company SELECT/UPDATE → fail
-- -- Archive RPC + Restore RPC → success (SECURITY DEFINER, RLS not forced)
-- -- Hard DELETE → fail
-- -- No Vehicle Checks / Tyre Checks / Driver Reports / Documents / Consumables mutated
--
-- -- 8) Plan allowance + lifecycle trigger inventory
-- select tgname, tgenabled, pg_get_triggerdef(oid) as definition
-- from pg_trigger
-- where tgrelid = 'public.vehicles'::regclass
--   and not tgisinternal
-- order by tgname;
-- -- Expected lifecycle trigger: vehicles_archive_reason_guard
-- --   BEFORE INSERT OR UPDATE OF archived_at, archive_reason, retention_expires_at
-- -- Expected plan trigger: vehicles_enforce_vehicle_plan_allowance
--
-- select p.proname,
--        p.prosecdef as security_definer,
--        pg_get_function_identity_arguments(p.oid) as args,
--        coalesce(pg_catalog.array_to_string(
--          (select array_agg(s.setconfig)
--           from unnest(coalesce(p.proconfig, array[]::text[])) as s(setconfig)),
--          ', '
--        ), '') as config
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and p.proname in (
--     'drevora_archive_vehicle',
--     'drevora_restore_vehicle',
--     'drevora_vehicles_archive_reason_guard'
--   )
-- order by p.proname;
-- -- Expected: archive/restore security_definer = true, search_path = '';
-- --           archive_reason_guard security_definer = false (INVOKER), search_path = ''
