-- Office high-impact WRITE hardening: require AAL2 on direct end-user JWT RPCs.
-- Idempotent. Do not apply automatically — apply manually on Supabase when ready.
--
-- Scope:
--   - Helper for end-user JWT sessions only (auth.jwt()->>'aal')
--   - drevora_office_soft_delete_tyre_check
--   - drevora_office_apply_tyre_check_correction
--   - drevora_archive_driver / drevora_restore_driver
--   - drevora_archive_vehicle / drevora_restore_vehicle
--   - drevora_approve_timesheets / drevora_reject_timesheets
--   - drevora_clean_timesheets_current_view
--   - drevora_clear_company_driver_timesheet_settings
--   - drevora_set_vehicle_tyre_layout (Office branch only; Worker stays AAL1)
--   - drevora_save_worker_core_document
--   - worker document submission review / metadata / soft-delete / restore
--   - Office WRITE RLS: documents/companies/drivers/vehicles/timesheets/
--     holidays/contacts/consumables/compliance/vehicle_checks/templates/
--     driver_reports/dashboard_notes/vehicle_availability (Office policies only)
--
-- Do NOT use this helper inside service_role Edge Function RPC callers expecting
-- the end-user AAL — those must check AAL2 at the Edge Function boundary.

begin;

-- -----------------------------------------------------------------------------
-- Helpers (security invoker so auth.jwt() is the end-user session)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_session_is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

comment on function public.drevora_auth_session_is_aal2() is
  'True when the current end-user JWT authenticator assurance level is aal2. For direct authenticated RPC/RLS paths only — not for service_role callers.';

create or replace function public.drevora_auth_require_aal2()
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.drevora_auth_session_is_aal2() then
    raise exception 'DREVORA: MFA_REQUIRED Two-factor authentication is required.';
  end if;
end;
$$;

comment on function public.drevora_auth_require_aal2() is
  'Raises MFA_REQUIRED unless the current end-user JWT is aal2. Call from Office WRITE RPCs that run under the caller session — never rely on this inside service_role Edge Function RPC paths for the end-user AAL.';

revoke all on function public.drevora_auth_session_is_aal2() from public;
revoke all on function public.drevora_auth_session_is_aal2() from anon;
grant execute on function public.drevora_auth_session_is_aal2() to authenticated;

revoke all on function public.drevora_auth_require_aal2() from public;
revoke all on function public.drevora_auth_require_aal2() from anon;
grant execute on function public.drevora_auth_require_aal2() to authenticated;

-- -----------------------------------------------------------------------------
-- Tyre Check soft-delete (browser → RPC direct)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_office_soft_delete_tyre_check(
  p_tyre_check_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_deleted_at timestamptz;
  v_prev_guc text;
begin
  if v_uid is null then
    raise exception 'DREVORA: Authentication required.';
  end if;

  -- End-user JWT only (this RPC is not invoked via service_role for Office writes).
  perform public.drevora_auth_require_aal2();

  if p_tyre_check_id is null then
    raise exception 'DREVORA: tyre_check_id is required.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'DREVORA: Deletion reason is required.';
  end if;

  select tc.company_id, tc.status, tc.deleted_at
  into v_company_id, v_status, v_deleted_at
  from public.tyre_checks tc
  where tc.id = p_tyre_check_id
  for update;

  if v_company_id is null then
    raise exception 'DREVORA: Tyre Check not found.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'DREVORA: Only office roles can delete Tyre Checks.';
  end if;

  if v_status is distinct from 'submitted' then
    raise exception 'DREVORA: Only submitted Tyre Checks can be soft-deleted.';
  end if;

  if v_deleted_at is not null then
    raise exception 'DREVORA: This Tyre Check is already deleted.';
  end if;

  v_prev_guc := current_setting('drevora.tyre_office_soft_delete', true);
  perform set_config('drevora.tyre_office_soft_delete', '1', true);

  begin
    update public.tyre_checks
    set
      deleted_at = now(),
      deleted_by = v_uid,
      delete_reason = btrim(p_reason),
      updated_at = now()
    where id = p_tyre_check_id;
  exception
    when others then
      perform set_config(
        'drevora.tyre_office_soft_delete',
        coalesce(v_prev_guc, ''),
        true
      );
      raise;
  end;

  perform set_config(
    'drevora.tyre_office_soft_delete',
    coalesce(v_prev_guc, ''),
    true
  );

  return p_tyre_check_id;
end;
$$;

revoke all on function public.drevora_office_soft_delete_tyre_check(uuid, text) from public;
revoke all on function public.drevora_office_soft_delete_tyre_check(uuid, text) from anon;
grant execute on function public.drevora_office_soft_delete_tyre_check(uuid, text) to authenticated;

comment on function public.drevora_office_soft_delete_tyre_check(uuid, text) is
  'Office-only audited soft-delete for submitted Tyre Checks. Requires end-user JWT aal2. Does not delete items, corrections, or audit history.';

-- -----------------------------------------------------------------------------
-- Tyre Check correction (browser → RPC direct)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_office_apply_tyre_check_correction(
  p_tyre_check_id uuid,
  p_reason text,
  p_pressure_unit text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_deleted_at timestamptz;
  v_old_unit text;
  v_new_unit text;
  v_correction_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_old_tread numeric(4, 1);
  v_new_tread numeric(4, 1);
  v_old_pressure numeric(6, 2);
  v_new_pressure numeric(6, 2);
  v_unit text;
  v_axle smallint;
  v_position text;
  v_changed integer := 0;
  v_prev_guc text;
begin
  if v_uid is null then
    raise exception 'DREVORA: Authentication required.';
  end if;

  -- End-user JWT only (this RPC is not invoked via service_role for Office writes).
  perform public.drevora_auth_require_aal2();

  if p_tyre_check_id is null then
    raise exception 'DREVORA: tyre_check_id is required.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'DREVORA: Correction reason is required.';
  end if;

  if p_pressure_unit is not null and p_pressure_unit not in ('bar', 'psi') then
    raise exception 'DREVORA: pressure_unit must be bar or psi.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'DREVORA: Correction items are required.';
  end if;

  select tc.company_id, tc.status, tc.pressure_unit, tc.deleted_at
  into v_company_id, v_status, v_old_unit, v_deleted_at
  from public.tyre_checks tc
  where tc.id = p_tyre_check_id
  for update;

  if v_company_id is null then
    raise exception 'DREVORA: Tyre Check not found.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'DREVORA: Only office roles can correct Tyre Checks.';
  end if;

  if v_deleted_at is not null then
    raise exception 'DREVORA: Soft-deleted Tyre Checks cannot be corrected.';
  end if;

  if v_status is distinct from 'submitted' then
    raise exception 'DREVORA: Only submitted Tyre Checks can be corrected.';
  end if;

  v_new_unit := p_pressure_unit;

  insert into public.tyre_check_corrections (
    company_id,
    tyre_check_id,
    correction_reason,
    corrected_by,
    old_pressure_unit,
    new_pressure_unit
  )
  values (
    v_company_id,
    p_tyre_check_id,
    btrim(p_reason),
    v_uid,
    v_old_unit,
    v_new_unit
  )
  returning id into v_correction_id;

  v_prev_guc := current_setting('drevora.tyre_office_correction', true);
  perform set_config('drevora.tyre_office_correction', '1', true);

  begin
    if v_new_unit is distinct from v_old_unit then
      update public.tyre_checks
      set pressure_unit = v_new_unit,
          updated_at = now()
      where id = p_tyre_check_id;
      v_changed := v_changed + 1;
    end if;

    for v_item in
      select value from jsonb_array_elements(p_items)
    loop
      begin
        v_item_id := (v_item ->> 'item_id')::uuid;
      exception
        when others then
          raise exception 'DREVORA: Each correction item requires a valid item_id.';
      end;

      if v_item_id is null then
        raise exception 'DREVORA: Each correction item requires item_id.';
      end if;

      if v_item ? 'tread_depth_mm'
         and v_item ->> 'tread_depth_mm' is not null
         and btrim(v_item ->> 'tread_depth_mm') <> '' then
        v_new_tread := (v_item ->> 'tread_depth_mm')::numeric(4, 1);
      else
        v_new_tread := null;
      end if;

      if v_item ? 'pressure_value'
         and v_item ->> 'pressure_value' is not null
         and btrim(v_item ->> 'pressure_value') <> '' then
        v_new_pressure := (v_item ->> 'pressure_value')::numeric(6, 2);
      else
        v_new_pressure := null;
      end if;

      if v_new_tread is not null then
        if v_new_tread < 0 or v_new_tread > 30 then
          raise exception 'DREVORA: tread_depth_mm must be between 0 and 30.';
        end if;
        if v_new_tread is distinct from 1.6
           and (v_new_tread * 2) <> round(v_new_tread * 2) then
          raise exception 'DREVORA: tread_depth_mm must use 0.5 mm steps or exact 1.6.';
        end if;
      end if;

      if v_new_pressure is not null
         and (v_new_pressure < 0 or v_new_pressure > 200) then
        raise exception 'DREVORA: pressure_value must be between 0 and 200.';
      end if;

      select
        i.tread_depth_mm,
        i.pressure_value,
        i.unit,
        i.axle_number,
        i.position
      into
        v_old_tread,
        v_old_pressure,
        v_unit,
        v_axle,
        v_position
      from public.tyre_check_items i
      where i.id = v_item_id
        and i.tyre_check_id = p_tyre_check_id
      for update;

      if v_unit is null then
        raise exception
          'DREVORA: Correction item % does not belong to this Tyre Check.',
          v_item_id;
      end if;

      if v_new_tread is not distinct from v_old_tread
         and v_new_pressure is not distinct from v_old_pressure then
        continue;
      end if;

      update public.tyre_check_items
      set
        tread_depth_mm = v_new_tread,
        pressure_value = v_new_pressure,
        updated_at = now()
      where id = v_item_id;

      insert into public.tyre_check_correction_item_changes (
        correction_id,
        tyre_check_item_id,
        unit,
        axle_number,
        position,
        old_tread_depth_mm,
        new_tread_depth_mm,
        old_pressure_value,
        new_pressure_value
      )
      values (
        v_correction_id,
        v_item_id,
        v_unit,
        v_axle,
        v_position,
        v_old_tread,
        v_new_tread,
        v_old_pressure,
        v_new_pressure
      );

      v_changed := v_changed + 1;
    end loop;

    if v_changed = 0 then
      raise exception 'DREVORA: Correction must change at least one value.';
    end if;
  exception
    when others then
      perform set_config(
        'drevora.tyre_office_correction',
        coalesce(v_prev_guc, ''),
        true
      );
      raise;
  end;

  perform set_config(
    'drevora.tyre_office_correction',
    coalesce(v_prev_guc, ''),
    true
  );

  return v_correction_id;
end;
$$;

revoke all on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb) from public;
revoke all on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb) from anon;
grant execute on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb) to authenticated;

comment on function public.drevora_office_apply_tyre_check_correction(uuid, text, text, jsonb) is
  'Office-only Tyre Check correction. Requires end-user JWT aal2. Rejects soft-deleted checks.';



-- =============================================================================
-- Additional high-impact Office WRITE RPCs (browser → RPC direct)
-- =============================================================================

create or replace function public.drevora_archive_driver(p_driver_id uuid)
returns public.drivers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.drivers%rowtype;
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'WORKER_ARCHIVE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_driver_id is null then
    raise exception 'WORKER_ARCHIVE_INVALID'
      using errcode = '22023',
            hint = 'Worker id is required.';
  end if;

  select *
  into v_row
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_ARCHIVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker not found.';
  end if;

  if v_row.company_id is null
    or not public.drevora_auth_user_has_office_role_for_company(v_row.company_id) then
    raise exception 'WORKER_ARCHIVE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if v_row.archived_at is not null then
    raise exception 'WORKER_ALREADY_ARCHIVED'
      using errcode = 'P0001',
            hint = 'This Worker is already archived.';
  end if;

  v_archived_at := timezone('utc', now());

  -- Clear current Vehicle assignments (same company only). History keeps worker_id refs.
  update public.vehicles v
  set current_driver_id = null
  where v.current_driver_id = p_driver_id
    and v.company_id = v_row.company_id;

  update public.drivers d
  set
    default_vehicle_id = null,
    archived_at = v_archived_at,
    retention_expires_at = v_archived_at + interval '6 years'
  where d.id = p_driver_id
    and d.company_id = v_row.company_id
  returning * into v_row;

  if not found then
    raise exception 'WORKER_ARCHIVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker could not be archived for this company.';
  end if;

  return v_row;
end;
$$;

comment on function public.drevora_archive_driver(uuid) is
  'Office-only soft-archive: clears current Vehicle assignment pointers, sets archived_at and retention_expires_at (+6 years). Requires end-user JWT aal2. Never deletes the Worker or Auth user.';

create or replace function public.drevora_restore_driver(p_driver_id uuid)
returns public.drivers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.drivers%rowtype;
  v_plan_code text;
  v_limit integer;
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'WORKER_RESTORE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_driver_id is null then
    raise exception 'WORKER_RESTORE_INVALID'
      using errcode = '22023',
            hint = 'Worker id is required.';
  end if;

  select *
  into v_row
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_RESTORE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker not found.';
  end if;

  if v_row.company_id is null
    or not public.drevora_auth_user_has_office_role_for_company(v_row.company_id) then
    raise exception 'WORKER_RESTORE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if v_row.archived_at is null then
    raise exception 'WORKER_NOT_ARCHIVED'
      using errcode = 'P0001',
            hint = 'This Worker is already active.';
  end if;

  select c.plan_code
  into v_plan_code
  from public.companies c
  where c.id = v_row.company_id
  for update;

  if not found then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Worker plan allowance check.';
  end if;

  v_limit := public.drevora_active_worker_limit_for_plan(v_plan_code);
  if v_limit is null then
    raise exception 'WORKER_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan before restoring Workers.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.drivers d
  where d.company_id = v_row.company_id
    and d.archived_at is null;

  if v_active_count >= v_limit then
    raise exception 'WORKER_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Your Worker limit has been reached. Archive another Worker or upgrade your plan before restoring this Worker.';
  end if;

  -- Clear archive + retention deadline. Do not restore Vehicle assignments.
  update public.drivers d
  set
    archived_at = null,
    retention_expires_at = null
  where d.id = p_driver_id
    and d.company_id = v_row.company_id
  returning * into v_row;

  if not found then
    raise exception 'WORKER_RESTORE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker could not be restored for this company.';
  end if;

  return v_row;
end;
$$;

comment on function public.drevora_restore_driver(uuid) is
  'Office-only restore when an active Worker plan seat is available. Requires end-user JWT aal2. Clears archived_at and retention_expires_at. Does not recreate Vehicle assignments.';

revoke all on function public.drevora_archive_driver(uuid) from public;
revoke all on function public.drevora_archive_driver(uuid) from anon;
revoke all on function public.drevora_restore_driver(uuid) from public;
revoke all on function public.drevora_restore_driver(uuid) from anon;
grant execute on function public.drevora_archive_driver(uuid) to authenticated;
grant execute on function public.drevora_restore_driver(uuid) to authenticated;

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

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

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
  'Office-only soft-archive: clears current Worker assignment pointers, sets archived_at, archive_reason, and retention_expires_at (archived_at + 6 years). Requires end-user JWT aal2. Never deletes the row or historical records.';

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

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

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
  'Office-only restore of an archived Vehicle when an active plan seat is available. Requires end-user JWT aal2. Clears archived_at, archive_reason, and retention_expires_at. Does not restore Worker assignments.';

revoke all on function public.drevora_archive_vehicle(uuid, text, date) from public;
revoke all on function public.drevora_archive_vehicle(uuid, text, date) from anon;
revoke all on function public.drevora_restore_vehicle(uuid) from public;
revoke all on function public.drevora_restore_vehicle(uuid) from anon;
grant execute on function public.drevora_archive_vehicle(uuid, text, date) to authenticated;
grant execute on function public.drevora_restore_vehicle(uuid) to authenticated;

create or replace function public.drevora_approve_timesheets(
  p_company_id uuid,
  p_timesheet_ids uuid[]
)
returns table (
  id uuid,
  status text,
  approved_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved_at timestamptz := transaction_timestamp();
  v_ids uuid[];
  v_requested integer;
  v_locked integer;
  v_invalid integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_APPROVE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_company_id is null then
    raise exception 'TIMESHEET_APPROVE_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_APPROVE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_timesheet_ids is null or coalesce(cardinality(p_timesheet_ids), 0) = 0 then
    raise exception 'TIMESHEET_APPROVE_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  if exists (
    select 1
    from unnest(p_timesheet_ids) as x(id)
    where x.id is null
  ) then
    raise exception 'TIMESHEET_APPROVE_INVALID'
      using errcode = '22023',
            hint = 'Timesheet ids must not contain null.';
  end if;

  -- Normalize duplicates; keep deterministic order for lock acquisition.
  select array_agg(distinct x.id order by x.id)
  into v_ids
  from unnest(p_timesheet_ids) as x(id);

  v_requested := coalesce(cardinality(v_ids), 0);
  if v_requested = 0 then
    raise exception 'TIMESHEET_APPROVE_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  -- Lock every requested row that belongs to this company (ordered to reduce deadlocks).
  perform 1
  from (
    select t.id
    from public.timesheets t
    where t.company_id = p_company_id
      and t.id = any (v_ids)
    order by t.id
    for update
  ) as locked;

  select count(*)::integer
  into v_locked
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids);

  if v_locked is distinct from v_requested then
    raise exception 'TIMESHEET_APPROVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'One or more Timesheets were not found for this company.';
  end if;

  select count(*)::integer
  into v_invalid
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and (
      t.deleted_at is not null
      or t.cleaned_at is not null
      or t.status is distinct from 'Submitted'
    );

  if v_invalid > 0 then
    raise exception 'TIMESHEET_APPROVE_INVALID_STATE'
      using errcode = 'P0001',
            hint = 'Every selected Timesheet must be Current, not deleted, and Submitted.';
  end if;

  -- Approved-only fields (no approved_by column in schema). Does not clear rejected_at
  -- because the existing direct Approve path never cleared rejection metadata.
  return query
  update public.timesheets t
  set
    status = 'Approved',
    approved_at = v_approved_at,
    updated_at = v_approved_at
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and t.deleted_at is null
    and t.cleaned_at is null
    and t.status = 'Submitted'
  returning t.id, t.status, t.approved_at, t.updated_at;

  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_requested then
    raise exception 'TIMESHEET_APPROVE_PARTIAL'
      using errcode = 'P0001',
            hint = 'Approve aborted: not every requested Timesheet could be approved.';
  end if;
end;
$$;

comment on function public.drevora_approve_timesheets(uuid, uuid[]) is
  'Office-only atomic Approve: sets status=Approved, approved_at and updated_at for company Current Submitted Timesheets. Requires end-user JWT aal2. Fails entirely if any requested id is missing, cross-company, deleted, cleaned, or not Submitted. Does not touch entries, week_start, submitted_at, cleaned_at, deleted_at or retention.';

revoke all on function public.drevora_approve_timesheets(uuid, uuid[]) from public;
revoke all on function public.drevora_approve_timesheets(uuid, uuid[]) from anon;
grant execute on function public.drevora_approve_timesheets(uuid, uuid[]) to authenticated;

create or replace function public.drevora_reject_timesheets(
  p_company_id uuid,
  p_timesheet_ids uuid[]
)
returns table (
  id uuid,
  status text,
  rejected_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rejected_at timestamptz := transaction_timestamp();
  v_ids uuid[];
  v_requested integer;
  v_locked integer;
  v_invalid integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_REJECT_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_company_id is null then
    raise exception 'TIMESHEET_REJECT_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_REJECT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_timesheet_ids is null or coalesce(cardinality(p_timesheet_ids), 0) = 0 then
    raise exception 'TIMESHEET_REJECT_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  if exists (
    select 1
    from unnest(p_timesheet_ids) as x(id)
    where x.id is null
  ) then
    raise exception 'TIMESHEET_REJECT_INVALID'
      using errcode = '22023',
            hint = 'Timesheet ids must not contain null.';
  end if;

  select array_agg(distinct x.id order by x.id)
  into v_ids
  from unnest(p_timesheet_ids) as x(id);

  v_requested := coalesce(cardinality(v_ids), 0);
  if v_requested = 0 then
    raise exception 'TIMESHEET_REJECT_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  perform 1
  from (
    select t.id
    from public.timesheets t
    where t.company_id = p_company_id
      and t.id = any (v_ids)
    order by t.id
    for update
  ) as locked;

  select count(*)::integer
  into v_locked
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids);

  if v_locked is distinct from v_requested then
    raise exception 'TIMESHEET_REJECT_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'One or more Timesheets were not found for this company.';
  end if;

  select count(*)::integer
  into v_invalid
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and (
      t.deleted_at is not null
      or t.cleaned_at is not null
      or t.status is distinct from 'Submitted'
    );

  if v_invalid > 0 then
    raise exception 'TIMESHEET_REJECT_INVALID_STATE'
      using errcode = 'P0001',
            hint = 'Every selected Timesheet must be Current, not deleted, and Submitted.';
  end if;

  return query
  update public.timesheets t
  set
    status = 'Rejected',
    rejected_at = v_rejected_at,
    updated_at = v_rejected_at,
    worker_confirmed = false,
    confirmed_by_driver_id = null,
    confirmed_at = null
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and t.deleted_at is null
    and t.cleaned_at is null
    and t.status = 'Submitted'
  returning t.id, t.status, t.rejected_at, t.updated_at;

  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_requested then
    raise exception 'TIMESHEET_REJECT_PARTIAL'
      using errcode = 'P0001',
            hint = 'Reject aborted: not every requested Timesheet could be rejected.';
  end if;
end;
$$;

comment on function public.drevora_reject_timesheets(uuid, uuid[]) is
  'Office-only atomic Reject: sets status=Rejected, rejected_at, updated_at; clears current Worker confirmation fields. Requires end-user JWT aal2. Audit rows in timesheet_submission_confirmations are preserved. Does not touch entries, week_start, submitted_at, cleaned_at, deleted_at, retention or approved_at.';

revoke all on function public.drevora_reject_timesheets(uuid, uuid[]) from public;
revoke all on function public.drevora_reject_timesheets(uuid, uuid[]) from anon;
grant execute on function public.drevora_reject_timesheets(uuid, uuid[]) to authenticated;

create or replace function public.drevora_clean_timesheets_current_view(
  p_company_id uuid,
  p_week_start_from date default null,
  p_week_start_to date default null
)
returns table (
  id uuid,
  cleaned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleaned_at timestamptz := transaction_timestamp();
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_CLEAN_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_company_id is null then
    raise exception 'TIMESHEET_CLEAN_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_CLEAN_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_week_start_from is not null
     and p_week_start_to is not null
     and p_week_start_from > p_week_start_to then
    raise exception 'TIMESHEET_CLEAN_INVALID_RANGE'
      using errcode = '22023',
            hint = 'week_start From must be on or before To.';
  end if;

  return query
  update public.timesheets t
  set
    cleaned_at = v_cleaned_at,
    updated_at = v_cleaned_at
  where t.company_id = p_company_id
    and t.deleted_at is null
    and t.cleaned_at is null
    and t.status = 'Approved'
    and (p_week_start_from is null or t.week_start >= p_week_start_from)
    and (p_week_start_to is null or t.week_start <= p_week_start_to)
  returning t.id, t.cleaned_at;
end;
$$;

comment on function public.drevora_clean_timesheets_current_view(uuid, date, date) is
  'Office-only soft-clean Current view: sets cleaned_at and updated_at on company Approved Timesheets matching optional week_start From/To. Requires end-user JWT aal2. Draft/Submitted/Rejected stay in Current. Does not delete rows, touch entries, or alter status/approvals/retention.';

revoke all on function public.drevora_clean_timesheets_current_view(uuid, date, date) from public;
revoke all on function public.drevora_clean_timesheets_current_view(uuid, date, date) from anon;
grant execute on function public.drevora_clean_timesheets_current_view(uuid, date, date) to authenticated;

create or replace function public.drevora_clear_company_driver_timesheet_settings(
  p_company_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'DREVORA: Authentication required.';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_company_id is null then
    raise exception 'DREVORA: company id is required to clear Timesheet overrides.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception
      'DREVORA: Only Office can clear Worker Timesheet overrides for this company.';
  end if;

  delete from public.driver_timesheet_settings
  where company_id = p_company_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.drevora_clear_company_driver_timesheet_settings(uuid) is
  'Office-only: delete all driver_timesheet_settings rows for one company. Requires end-user JWT aal2.';

revoke all on function public.drevora_clear_company_driver_timesheet_settings(uuid) from public;
revoke all on function public.drevora_clear_company_driver_timesheet_settings(uuid) from anon;
grant execute on function public.drevora_clear_company_driver_timesheet_settings(uuid) to authenticated;

create or replace function public.drevora_set_vehicle_tyre_layout(
  p_vehicle_id uuid,
  p_axle_layouts text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid;
  v_worker_company_id uuid;
  v_vehicle_company_id uuid;
  v_vehicle_archived_at timestamptz;
  v_axle_count smallint;
  v_layout text;
  v_authorised boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_vehicle_id is null then
    raise exception 'Vehicle is required';
  end if;

  if p_axle_layouts is null or array_length(p_axle_layouts, 1) is null then
    raise exception 'At least one axle layout is required';
  end if;

  v_axle_count := array_length(p_axle_layouts, 1);
  if v_axle_count < 1 or v_axle_count > 6 then
    raise exception 'Axle count must be between 1 and 6';
  end if;

  foreach v_layout in array p_axle_layouts loop
    if v_layout is null or v_layout not in ('single', 'dual') then
      raise exception 'Each axle layout must be single or dual';
    end if;
  end loop;

  -- Lock the exact Vehicle row before authorising the write, so this
  -- serializes with Vehicle Archive and cannot race past an unlocked read.
  select v.company_id, v.archived_at
  into v_vehicle_company_id, v_vehicle_archived_at
  from public.vehicles v
  where v.id = p_vehicle_id
  for update;

  if not found or v_vehicle_company_id is null then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if v_vehicle_archived_at is not null then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if not public.drevora_vehicle_in_company(p_vehicle_id, v_vehicle_company_id) then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  -- Authorise: same-company active Worker, or Office/Admin of that company.
  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is not null then
    select d.company_id
    into v_worker_company_id
    from public.drivers d
    where d.id = v_worker_id
      and d.archived_at is null
    for update;

    if v_worker_company_id is not null and v_worker_company_id = v_vehicle_company_id then
      v_authorised := true;
    end if;
  end if;

  if not v_authorised then
    if public.drevora_auth_user_has_office_role_for_company(v_vehicle_company_id) then
      -- Office/Admin path requires AAL2; Worker path above remains AAL1-compatible.
      perform public.drevora_auth_require_aal2();
      v_authorised := true;
    end if;
  end if;

  if not v_authorised then
    raise exception 'Not authorised to configure this vehicle';
  end if;

  insert into public.vehicle_tyre_layouts (
    vehicle_id, company_id, axle_count, axle_layouts, updated_by_driver_id
  ) values (
    p_vehicle_id, v_vehicle_company_id, v_axle_count, p_axle_layouts, v_worker_id
  )
  on conflict (vehicle_id) do update
  set
    company_id = excluded.company_id,
    axle_count = excluded.axle_count,
    axle_layouts = excluded.axle_layouts,
    updated_by_driver_id = excluded.updated_by_driver_id,
    updated_at = now();

  return jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'axle_count', v_axle_count,
    'axle_layouts', to_jsonb(p_axle_layouts)
  );
end;
$$;

comment on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) is
  'Worker (own company, active) or Office/Admin: save the default per-axle Single/Dual layout for one Vehicle. Office path requires end-user JWT aal2; Worker path remains AAL1-compatible. Locks the Vehicle row before writing. Never touches tyre_checks / tyre_check_items, so completed historical checks are unaffected.';

revoke all on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) from public;
revoke all on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) from anon;
grant execute on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) to authenticated;

do $$
begin
  if to_regrole('service_role') is not null then
    execute 'grant execute on function public.drevora_set_vehicle_tyre_layout(uuid, text[]) to service_role';
  end if;
end $$;

create or replace function public.drevora_save_worker_core_document(
  p_mode text,
  p_company_id uuid,
  p_document_id uuid,
  p_document_name text,
  p_document_type text,
  p_worker_id uuid,
  p_reference_number text,
  p_issue_date date,
  p_expiry_date date,
  p_notes text,
  p_file_path text default null,
  p_update_file_path boolean default false
)
returns public.documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_canonical text;
  v_stored_canonical text;
  v_row public.documents;
  v_existing public.documents;
  v_company_name text;
  v_worker_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_company_id is null then
    raise exception 'company_id is required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  if p_mode not in ('create', 'update') then
    raise exception 'Invalid mode';
  end if;

  if p_worker_id is null then
    raise exception 'worker_id is required';
  end if;

  if not public.drevora_driver_in_company(p_worker_id, p_company_id) then
    raise exception 'Worker does not belong to this company';
  end if;

  v_canonical := public.drevora_normalize_worker_core_document_type(p_document_type);
  if v_canonical is null then
    raise exception 'Document type is not a synchronised Worker core type';
  end if;

  select nullif(trim(name), '') into v_company_name
  from public.companies
  where id = p_company_id;

  if p_mode = 'create' then
    v_worker_id := p_worker_id;

    insert into public.documents (
      company_id,
      company,
      document_name,
      document_type,
      applies_to,
      worker_id,
      vehicle_id,
      reference_number,
      issue_date,
      expiry_date,
      file_path,
      notes,
      status
    )
    values (
      p_company_id,
      v_company_name,
      coalesce(nullif(trim(p_document_name), ''), v_canonical),
      v_canonical,
      'worker',
      v_worker_id,
      null,
      nullif(trim(p_reference_number), ''),
      p_issue_date,
      p_expiry_date,
      case when p_update_file_path then p_file_path else null end,
      nullif(trim(p_notes), ''),
      public.drevora_worker_core_document_status(p_expiry_date)
    )
    returning * into v_row;
  else
    if p_document_id is null then
      raise exception 'document_id is required for update';
    end if;

    select *
    into v_existing
    from public.documents d
    where d.id = p_document_id
      and d.company_id = p_company_id
    for update;

    if not found then
      raise exception 'Document could not be updated for your company';
    end if;

    if v_existing.deleted_at is not null then
      raise exception 'Restore this document before editing';
    end if;

    if v_existing.applies_to is distinct from 'worker' then
      raise exception 'Applies to cannot be changed for this document';
    end if;

    v_stored_canonical := public.drevora_normalize_worker_core_document_type(v_existing.document_type);
    if v_stored_canonical is null then
      raise exception 'Document type is not a synchronised Worker core type';
    end if;

    if v_canonical is distinct from v_stored_canonical then
      raise exception 'Document type cannot be changed after creation';
    end if;

    if p_worker_id is distinct from v_existing.worker_id then
      raise exception 'Worker cannot be changed after creation';
    end if;

    v_worker_id := v_existing.worker_id;
    v_canonical := v_stored_canonical;

    update public.documents d
    set
      document_name = coalesce(nullif(trim(p_document_name), ''), v_canonical),
      -- worker_id, document_type, applies_to, and provenance intentionally unchanged
      reference_number = nullif(trim(p_reference_number), ''),
      issue_date = p_issue_date,
      expiry_date = p_expiry_date,
      notes = nullif(trim(p_notes), ''),
      status = public.drevora_worker_core_document_status(p_expiry_date),
      file_path = case
        when p_update_file_path then p_file_path
        else d.file_path
      end,
      updated_at = now()
    where d.id = v_existing.id
      and d.company_id = p_company_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Document could not be updated for your company';
    end if;
  end if;

  -- Mandatory expiry synchronisation (no caller bypass).
  if v_canonical = 'Driving Licence' then
    update public.drivers
    set driving_licence_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  elsif v_canonical = 'CPC' then
    update public.drivers
    set cpc_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  elsif v_canonical = 'Tachograph Card' then
    update public.drivers
    set driver_card_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  elsif v_canonical = 'D4 / Medical' then
    update public.drivers
    set medical_expiry = p_expiry_date
    where id = v_worker_id
      and company_id = p_company_id;
  end if;

  if not found then
    raise exception 'Worker profile expiry could not be synchronised';
  end if;

  -- Compliance sync: same record, same worker, same company via drivers.
  if v_row.source_kind = 'worker_compliance' and v_row.source_record_id is not null then
    update public.worker_compliance_records wcr
    set
      expiry_date = p_expiry_date,
      updated_at = now()
    from public.drivers dr
    where wcr.id = v_row.source_record_id
      and wcr.worker_id = v_worker_id
      and dr.id = wcr.worker_id
      and dr.company_id = p_company_id;

    if not found then
      raise exception 'Worker compliance expiry could not be synchronised';
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_save_worker_core_document(
  text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean
) from public;
grant execute on function public.drevora_save_worker_core_document(
  text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean
) to authenticated;

create or replace function public.drevora_review_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid,
  p_review_status text,
  p_rejection_reason text default null
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  if p_review_status not in ('reviewed', 'rejected') then
    raise exception 'Invalid review status';
  end if;

  if p_review_status = 'rejected' then
    v_reason := nullif(trim(p_rejection_reason), '');
    if v_reason is null then
      raise exception 'A rejection reason is required';
    end if;
  else
    v_reason := null;
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be reviewed for your company';
  end if;

  if v_row.deleted_at is not null then
    raise exception 'Restore this submission before reviewing it';
  end if;

  if v_row.review_status <> 'pending_review' then
    raise exception 'Submission could not be reviewed for your company';
  end if;

  update public.worker_document_submissions s
  set
    review_status = p_review_status,
    rejection_reason = v_reason,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is null
    and s.review_status = 'pending_review'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be reviewed for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_review_worker_document_submission(
  uuid, uuid, text, text
) from public;
revoke all on function public.drevora_review_worker_document_submission(
  uuid, uuid, text, text
) from anon;
grant execute on function public.drevora_review_worker_document_submission(
  uuid, uuid, text, text
) to authenticated;

create or replace function public.drevora_update_worker_document_submission_metadata(
  p_submission_id uuid,
  p_company_id uuid,
  p_document_type text,
  p_custom_document_name text,
  p_reference_number text,
  p_notes text
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
  v_type text;
  v_custom_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  v_type := nullif(trim(p_document_type), '');
  if v_type is null
     or v_type not in (
       'CMR',
       'POD / Delivery Note',
       'Receipt',
       'Vehicle / Load Document',
       'Other'
     )
  then
    raise exception 'Invalid document type';
  end if;

  if v_type = 'Other' then
    v_custom_name := nullif(trim(p_custom_document_name), '');
    if v_custom_name is null then
      raise exception 'A custom document name is required when type is Other';
    end if;
  else
    v_custom_name := null;
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be updated for your company';
  end if;

  if v_row.deleted_at is not null then
    raise exception 'Restore this submission before editing it';
  end if;

  update public.worker_document_submissions s
  set
    document_type = v_type,
    custom_document_name = v_custom_name,
    reference_number = nullif(trim(p_reference_number), ''),
    notes = nullif(trim(p_notes), ''),
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be updated for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_update_worker_document_submission_metadata(
  uuid, uuid, text, text, text, text
) from public;
revoke all on function public.drevora_update_worker_document_submission_metadata(
  uuid, uuid, text, text, text, text
) from anon;
grant execute on function public.drevora_update_worker_document_submission_metadata(
  uuid, uuid, text, text, text, text
) to authenticated;

create or replace function public.drevora_soft_delete_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid,
  p_delete_reason text default null
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be archived for your company';
  end if;

  if v_row.deleted_at is not null then
    raise exception 'Submission is already archived';
  end if;

  update public.worker_document_submissions s
  set
    deleted_at = now(),
    deleted_by = auth.uid(),
    delete_reason = nullif(trim(p_delete_reason), ''),
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be archived for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_soft_delete_worker_document_submission(
  uuid, uuid, text
) from public;
revoke all on function public.drevora_soft_delete_worker_document_submission(
  uuid, uuid, text
) from anon;
grant execute on function public.drevora_soft_delete_worker_document_submission(
  uuid, uuid, text
) to authenticated;

create or replace function public.drevora_restore_worker_document_submission(
  p_submission_id uuid,
  p_company_id uuid
)
returns public.worker_document_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.worker_document_submissions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- End-user JWT only (browser → RPC direct; not service_role).
  perform public.drevora_auth_require_aal2();

  if p_submission_id is null or p_company_id is null then
    raise exception 'submission_id and company_id are required';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'Not authorised for this company';
  end if;

  select *
  into v_row
  from public.worker_document_submissions s
  where s.id = p_submission_id
    and s.company_id = p_company_id
  for update;

  if v_row.id is null then
    raise exception 'Submission could not be restored for your company';
  end if;

  if v_row.deleted_at is null then
    raise exception 'Submission is not archived';
  end if;

  update public.worker_document_submissions s
  set
    deleted_at = null,
    deleted_by = null,
    delete_reason = null,
    updated_at = now()
  where s.id = v_row.id
    and s.company_id = p_company_id
    and s.deleted_at is not null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Submission could not be restored for your company';
  end if;

  return v_row;
end;
$$;

revoke all on function public.drevora_restore_worker_document_submission(
  uuid, uuid
) from public;
revoke all on function public.drevora_restore_worker_document_submission(
  uuid, uuid
) from anon;
grant execute on function public.drevora_restore_worker_document_submission(
  uuid, uuid
) to authenticated;


-- =============================================================================
-- -- Office WRITE RLS AAL2 (direct table INSERT/UPDATE/DELETE)
-- Adds AAL2 to Office write policies only. Worker/Driver write policies unchanged.
-- SELECT policies unchanged (including company_members / Office reads).
-- =============================================================================

-- documents (required: soft-delete / restore / create / update non-core)
drop policy if exists documents_office_insert on public.documents;
create policy documents_office_insert
  on public.documents
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists documents_office_update on public.documents;
create policy documents_office_update
  on public.documents
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

comment on policy documents_office_update on public.documents is
  'Office UPDATE (incl. soft-delete/restore) requires company office role AND end-user JWT aal2.';

-- companies (settings)
drop policy if exists companies_office_update on public.companies;
create policy companies_office_update
  on public.companies
  for update
  to authenticated
  using (
    public.drevora_auth_user_has_office_role_for_company(id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    public.drevora_auth_user_has_office_role_for_company(id)
    and public.drevora_auth_session_is_aal2()
  );

-- drivers (canonical archive-aware policies)
drop policy if exists drivers_office_insert on public.drivers;
create policy drivers_office_insert
  on public.drivers
  for insert
  to authenticated
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

drop policy if exists drivers_office_update on public.drivers;
create policy drivers_office_update
  on public.drivers
  for update
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      default_vehicle_id is null
      or public.drevora_vehicle_in_company(default_vehicle_id, company_id)
    )
  );

-- vehicles (canonical archive-aware policies)
drop policy if exists vehicles_office_insert on public.vehicles;
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
    and public.drevora_auth_session_is_aal2()
    and (
      current_driver_id is null
      or public.drevora_driver_in_company(current_driver_id, company_id)
    )
  );

drop policy if exists vehicles_office_update on public.vehicles;
create policy vehicles_office_update
  on public.vehicles
  for update
  to authenticated
  using (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and archived_at is null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      current_driver_id is null
      or public.drevora_driver_in_company(current_driver_id, company_id)
    )
  );

-- timesheets + entries (Office policies only; Worker policies stay AAL1)
drop policy if exists timesheets_office_insert on public.timesheets;
create policy timesheets_office_insert
  on public.timesheets
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and public.drevora_driver_in_company(driver_id, company_id)
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists timesheets_office_update on public.timesheets;
create policy timesheets_office_update
  on public.timesheets
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and public.drevora_driver_in_company(driver_id, company_id)
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists timesheets_office_delete on public.timesheets;
create policy timesheets_office_delete
  on public.timesheets
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists timesheet_entries_office_insert on public.timesheet_entries;
create policy timesheet_entries_office_insert
  on public.timesheet_entries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists timesheet_entries_office_update on public.timesheet_entries;
create policy timesheet_entries_office_update
  on public.timesheet_entries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  )
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists timesheet_entries_office_delete on public.timesheet_entries;
create policy timesheet_entries_office_delete
  on public.timesheet_entries
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

-- holiday_requests (Office write only; Worker insert/update stay AAL1)
drop policy if exists holiday_requests_office_insert on public.holiday_requests;
create policy holiday_requests_office_insert
  on public.holiday_requests
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and public.drevora_driver_in_company(worker_id, company_id)
  );

drop policy if exists holiday_requests_office_update on public.holiday_requests;
create policy holiday_requests_office_update
  on public.holiday_requests
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and public.drevora_driver_in_company(worker_id, company_id)
  );

drop policy if exists holiday_requests_office_delete on public.holiday_requests;
create policy holiday_requests_office_delete
  on public.holiday_requests
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and status = 'Pending'
  );

-- vehicle_checks + items (Office write only)
drop policy if exists vehicle_checks_office_insert on public.vehicle_checks;
create policy vehicle_checks_office_insert
  on public.vehicle_checks
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

drop policy if exists vehicle_checks_office_update on public.vehicle_checks;
create policy vehicle_checks_office_update
  on public.vehicle_checks
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and public.drevora_vehicle_in_company(vehicle_id, company_id)
    and public.drevora_driver_in_company(worker_id, company_id)
  );

drop policy if exists vehicle_checks_office_delete on public.vehicle_checks;
create policy vehicle_checks_office_delete
  on public.vehicle_checks
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists vehicle_check_items_office_insert on public.vehicle_check_items;
create policy vehicle_check_items_office_insert
  on public.vehicle_check_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_check_items_office_update on public.vehicle_check_items;
create policy vehicle_check_items_office_update
  on public.vehicle_check_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_check_items_office_delete on public.vehicle_check_items;
create policy vehicle_check_items_office_delete
  on public.vehicle_check_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(vc.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

-- driver_reports (Office write; Worker insert/update stay AAL1)
drop policy if exists driver_reports_office_insert on public.driver_reports;
create policy driver_reports_office_insert
  on public.driver_reports
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists driver_reports_office_update on public.driver_reports;
create policy driver_reports_office_update
  on public.driver_reports
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists driver_reports_office_delete on public.driver_reports;
create policy driver_reports_office_delete
  on public.driver_reports
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

-- contacts (Office-only writes)
drop policy if exists contacts_office_insert on public.contacts;
create policy contacts_office_insert
  on public.contacts
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists contacts_office_update on public.contacts;
create policy contacts_office_update
  on public.contacts
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists contacts_office_delete on public.contacts;
create policy contacts_office_delete
  on public.contacts
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

-- consumables (Office write; Worker insert/update stay AAL1)
drop policy if exists consumables_office_insert on public.consumables;
create policy consumables_office_insert
  on public.consumables
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists consumables_office_update on public.consumables;
create policy consumables_office_update
  on public.consumables
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
    and (
      worker_id is null
      or public.drevora_driver_in_company(worker_id, company_id)
    )
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists consumables_office_delete on public.consumables;
create policy consumables_office_delete
  on public.consumables
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

-- dashboard_notes (Office-only)
drop policy if exists dashboard_notes_office_insert on public.dashboard_notes;
create policy dashboard_notes_office_insert
  on public.dashboard_notes
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists dashboard_notes_office_update on public.dashboard_notes;
create policy dashboard_notes_office_update
  on public.dashboard_notes
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists dashboard_notes_office_delete on public.dashboard_notes;
create policy dashboard_notes_office_delete
  on public.dashboard_notes
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

-- vehicle_availability (Office-only writes)
drop policy if exists vehicle_availability_office_insert on public.vehicle_availability;
create policy vehicle_availability_office_insert
  on public.vehicle_availability
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_availability_office_update on public.vehicle_availability;
create policy vehicle_availability_office_update
  on public.vehicle_availability
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  )
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_availability_office_delete on public.vehicle_availability;
create policy vehicle_availability_office_delete
  on public.vehicle_availability
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

-- compliance (Office-only writes)
drop policy if exists worker_compliance_office_insert on public.worker_compliance_records;
create policy worker_compliance_office_insert
  on public.worker_compliance_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists worker_compliance_office_update on public.worker_compliance_records;
create policy worker_compliance_office_update
  on public.worker_compliance_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  )
  with check (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists worker_compliance_office_delete on public.worker_compliance_records;
create policy worker_compliance_office_delete
  on public.worker_compliance_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.drivers d
      where d.id = worker_id
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_compliance_office_insert on public.vehicle_compliance_records;
create policy vehicle_compliance_office_insert
  on public.vehicle_compliance_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_compliance_office_update on public.vehicle_compliance_records;
create policy vehicle_compliance_office_update
  on public.vehicle_compliance_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  )
  with check (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_compliance_office_delete on public.vehicle_compliance_records;
create policy vehicle_compliance_office_delete
  on public.vehicle_compliance_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(v.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

-- vehicle check templates + items (Office-only writes)
drop policy if exists vehicle_check_templates_office_insert on public.vehicle_check_templates;
create policy vehicle_check_templates_office_insert
  on public.vehicle_check_templates
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists vehicle_check_templates_office_update on public.vehicle_check_templates;
create policy vehicle_check_templates_office_update
  on public.vehicle_check_templates
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists vehicle_check_templates_office_delete on public.vehicle_check_templates;
create policy vehicle_check_templates_office_delete
  on public.vehicle_check_templates
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and public.drevora_auth_session_is_aal2()
  );

drop policy if exists vehicle_check_template_items_office_insert on public.vehicle_check_template_items;
create policy vehicle_check_template_items_office_insert
  on public.vehicle_check_template_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_check_template_items_office_update on public.vehicle_check_template_items;
create policy vehicle_check_template_items_office_update
  on public.vehicle_check_template_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

drop policy if exists vehicle_check_template_items_office_delete on public.vehicle_check_template_items;
create policy vehicle_check_template_items_office_delete
  on public.vehicle_check_template_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_check_templates t
      where t.id = template_id
        and t.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(t.company_id)
        and public.drevora_auth_session_is_aal2()
    )
  );

commit;
