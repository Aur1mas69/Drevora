-- =============================================================================
-- Vehicle Checks: start/completion GPS capture (supporting info only)
-- File: supabase/migrations/20260729180000_vehicle_checks_gps_capture.sql
-- =============================================================================
-- Adds nullable device-location columns captured once when a Worker starts a
-- Vehicle Check and once when they complete/sign it. GPS is optional
-- supporting data only — no geofencing, approved locations, or blocking
-- behaviour is implemented. Existing rows remain valid with NULL values.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) GPS columns (smallest possible schema change, all nullable)
-- -----------------------------------------------------------------------------
alter table public.vehicle_checks
  add column if not exists started_latitude double precision;

alter table public.vehicle_checks
  add column if not exists started_longitude double precision;

alter table public.vehicle_checks
  add column if not exists started_location_accuracy double precision;

alter table public.vehicle_checks
  add column if not exists started_location_at timestamptz;

alter table public.vehicle_checks
  add column if not exists completed_latitude double precision;

alter table public.vehicle_checks
  add column if not exists completed_longitude double precision;

alter table public.vehicle_checks
  add column if not exists completed_location_accuracy double precision;

alter table public.vehicle_checks
  add column if not exists completed_location_at timestamptz;

comment on column public.vehicle_checks.started_latitude is
  'Device GPS latitude captured when the Worker started this Vehicle Check. Nullable — supporting info only, never required.';
comment on column public.vehicle_checks.started_longitude is
  'Device GPS longitude captured when the Worker started this Vehicle Check. Nullable — supporting info only, never required.';
comment on column public.vehicle_checks.started_location_accuracy is
  'Device-reported GPS accuracy (metres) at start capture, when available.';
comment on column public.vehicle_checks.started_location_at is
  'Timestamp the device actually returned the start GPS fix. Distinct from inspection_started_at (the workflow start time).';
comment on column public.vehicle_checks.completed_latitude is
  'Device GPS latitude captured immediately before the completed Vehicle Check was saved. Nullable — supporting info only, never required.';
comment on column public.vehicle_checks.completed_longitude is
  'Device GPS longitude captured immediately before the completed Vehicle Check was saved. Nullable — supporting info only, never required.';
comment on column public.vehicle_checks.completed_location_accuracy is
  'Device-reported GPS accuracy (metres) at completion capture, when available.';
comment on column public.vehicle_checks.completed_location_at is
  'Timestamp the device actually returned the completion GPS fix. Distinct from inspection_completed_at (the workflow completion time).';

-- -----------------------------------------------------------------------------
-- 2) Extend completed-check immutability to cover the new GPS fields.
--    (Recreates the existing trigger function from
--    20260724220000_vehicle_checks_completed_immutable_and_corrections.sql
--    with the new columns added to the protected field list.)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_vehicle_check_completed_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if public.drevora_vehicle_check_is_final(old.status, old.signed_at) then
      raise exception 'DREVORA: Completed Vehicle Checks cannot be deleted. Create a correction instead.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and public.drevora_vehicle_check_is_final(old.status, old.signed_at) then
    -- Defect review fields remain mutable on completed inspections.
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.vehicle_id is distinct from old.vehicle_id
       or new.worker_id is distinct from old.worker_id
       or new.inspection_date is distinct from old.inspection_date
       or new.odometer is distinct from old.odometer
       or new.odometer_unit is distinct from old.odometer_unit
       or new.status is distinct from old.status
       or new.overall_result is distinct from old.overall_result
       or new.notes is distinct from old.notes
       or new.signature_url is distinct from old.signature_url
       or new.signed_at is distinct from old.signed_at
       or new.inspection_started_at is distinct from old.inspection_started_at
       or new.inspection_completed_at is distinct from old.inspection_completed_at
       or new.duration_seconds is distinct from old.duration_seconds
       or new.original_check_id is distinct from old.original_check_id
       or new.correction_reason is distinct from old.correction_reason
       or new.correction_created_by is distinct from old.correction_created_by
       or new.correction_created_at is distinct from old.correction_created_at
       or new.created_at is distinct from old.created_at
       or new.started_latitude is distinct from old.started_latitude
       or new.started_longitude is distinct from old.started_longitude
       or new.started_location_accuracy is distinct from old.started_location_accuracy
       or new.started_location_at is distinct from old.started_location_at
       or new.completed_latitude is distinct from old.completed_latitude
       or new.completed_longitude is distinct from old.completed_longitude
       or new.completed_location_accuracy is distinct from old.completed_location_accuracy
       or new.completed_location_at is distinct from old.completed_location_at then
      raise exception 'DREVORA: Completed Vehicle Checks are read-only. Create a correction to amend.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from public;
revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from anon;
revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from authenticated;

notify pgrst, 'reload schema';

commit;
