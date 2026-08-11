-- =============================================================================
-- DREVORA — Vehicle Check trailer attachment + item asset_scope foundation
-- File: supabase/migrations/20260811220000_vehicle_checks_trailer_attachment_foundation.sql
-- =============================================================================
-- PURPOSE
--   STEP 3B-1 only: DB foundation for attaching a Trailer to a towing vehicle's
--   Vehicle Check (no standalone Trailer Check). Adds frozen truck/trailer
--   identity snapshots, trailer_source (none|company|third_party), optional
--   company trailer FK, and vehicle_check_items.asset_scope.
--
-- SCOPE
--   public.vehicle_checks columns + CHECKs + before-write validation
--   public.vehicle_check_items.asset_scope
--   Extend completed-check immutability to protect the new identity columns
--
-- DOES NOT
--   Add Trailer Base checklist items
--   Add DREVORA Recommended packs
--   Change DVSA 27 content
--   Change Worker/Admin Vehicle Check UI
--   Redesign RLS policies (same-company trailer enforced via trigger + helper)
--   Insert third-party trailers into public.vehicles
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.vehicle_checks') is null then
    raise exception 'DREVORA STOP: public.vehicle_checks is missing.';
  end if;
  if to_regclass('public.vehicle_check_items') is null then
    raise exception 'DREVORA STOP: public.vehicle_check_items is missing.';
  end if;
  if to_regclass('public.vehicles') is null then
    raise exception 'DREVORA STOP: public.vehicles is missing.';
  end if;
  if to_regprocedure('public.drevora_vehicle_in_company(uuid, uuid)') is null then
    raise exception
      'DREVORA STOP: public.drevora_vehicle_in_company(uuid, uuid) is missing.';
  end if;
  if to_regprocedure(
    'public.drevora_enforce_vehicle_check_completed_immutable()'
  ) is null then
    raise exception
      'DREVORA STOP: completed-check immutability function is missing.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) vehicle_checks — powered-vehicle snapshots + trailer attachment
-- -----------------------------------------------------------------------------
alter table public.vehicle_checks
  add column if not exists vehicle_registration_snapshot text;

alter table public.vehicle_checks
  add column if not exists vehicle_fleet_number_snapshot text;

alter table public.vehicle_checks
  add column if not exists trailer_source text not null default 'none';

alter table public.vehicle_checks
  add column if not exists trailer_vehicle_id uuid
    references public.vehicles (id) on delete restrict;

alter table public.vehicle_checks
  add column if not exists trailer_number_snapshot text;

alter table public.vehicle_checks
  add column if not exists trailer_registration_snapshot text;

alter table public.vehicle_checks
  add column if not exists trailer_type_snapshot text;

alter table public.vehicle_checks
  add column if not exists trailer_label_snapshot text;

comment on column public.vehicle_checks.vehicle_registration_snapshot is
  'Frozen towing-vehicle registration at check time. Historical reports must not depend on live vehicles.registration.';
comment on column public.vehicle_checks.vehicle_fleet_number_snapshot is
  'Frozen towing-vehicle fleet_number at check time.';
comment on column public.vehicle_checks.trailer_source is
  'none = no trailer; company = company Trailer vehicles row; third_party = hired/external trailer identity only (no vehicles insert).';
comment on column public.vehicle_checks.trailer_vehicle_id is
  'Company Trailer vehicles.id when trailer_source = company. ON DELETE RESTRICT so historical checks keep a valid FK. Null for none/third_party.';
comment on column public.vehicle_checks.trailer_number_snapshot is
  'Frozen trailer number (company trailer_number or third-party identity).';
comment on column public.vehicle_checks.trailer_registration_snapshot is
  'Frozen trailer registration/plate when present.';
comment on column public.vehicle_checks.trailer_type_snapshot is
  'Frozen company trailer_type (Curtainsider, Box, …) when known.';
comment on column public.vehicle_checks.trailer_label_snapshot is
  'Frozen display label for reports (company or third-party).';

-- Legacy completed / in-progress checks: freeze towing identity from current FK.
-- Do NOT invent trailer attachment for historical rows.
update public.vehicle_checks vc
set
  vehicle_registration_snapshot = coalesce(
    vc.vehicle_registration_snapshot,
    nullif(btrim(v.registration), '')
  ),
  vehicle_fleet_number_snapshot = coalesce(
    vc.vehicle_fleet_number_snapshot,
    nullif(btrim(v.fleet_number), '')
  )
from public.vehicles v
where vc.vehicle_id = v.id
  and (
    vc.vehicle_registration_snapshot is null
    or vc.vehicle_fleet_number_snapshot is null
  );

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_trailer_source_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_trailer_source_check
  check (trailer_source in ('none', 'company', 'third_party'));

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_truck_trailer_distinct_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_truck_trailer_distinct_check
  check (
    trailer_vehicle_id is null
    or trailer_vehicle_id <> vehicle_id
  );

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_trailer_attachment_consistency_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_trailer_attachment_consistency_check
  check (
    (
      trailer_source = 'none'
      and trailer_vehicle_id is null
      and trailer_number_snapshot is null
      and trailer_registration_snapshot is null
      and trailer_type_snapshot is null
      and trailer_label_snapshot is null
    )
    or (
      trailer_source = 'company'
      and trailer_vehicle_id is not null
      and (
        (
          trailer_number_snapshot is not null
          and btrim(trailer_number_snapshot) <> ''
        )
        or (
          trailer_label_snapshot is not null
          and btrim(trailer_label_snapshot) <> ''
        )
      )
    )
    or (
      trailer_source = 'third_party'
      and trailer_vehicle_id is null
      and (
        (
          trailer_number_snapshot is not null
          and btrim(trailer_number_snapshot) <> ''
        )
        or (
          trailer_label_snapshot is not null
          and btrim(trailer_label_snapshot) <> ''
        )
      )
    )
  );

comment on constraint vehicle_checks_trailer_attachment_consistency_check
  on public.vehicle_checks is
  'Trailer attachment rules: none clears identity; company requires trailer_vehicle_id + snapshot; third_party forbids FK and requires manual snapshot.';

create index if not exists vehicle_checks_trailer_vehicle_id_idx
  on public.vehicle_checks (trailer_vehicle_id)
  where trailer_vehicle_id is not null;

create index if not exists vehicle_checks_company_trailer_source_idx
  on public.vehicle_checks (company_id, trailer_source);

-- -----------------------------------------------------------------------------
-- 2) vehicle_check_items.asset_scope
-- -----------------------------------------------------------------------------
alter table public.vehicle_check_items
  add column if not exists asset_scope text not null default 'vehicle';

comment on column public.vehicle_check_items.asset_scope is
  'Ownership of this checklist answer: vehicle (towing), trailer, or combination. Existing rows default to vehicle.';

alter table public.vehicle_check_items
  drop constraint if exists vehicle_check_items_asset_scope_check;

alter table public.vehicle_check_items
  add constraint vehicle_check_items_asset_scope_check
  check (asset_scope in ('vehicle', 'trailer', 'combination'));

-- -----------------------------------------------------------------------------
-- 3) Resolve + before-write validation (Tyre Check trailer pattern + empty search_path)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: validate company Trailer rows even when RLS would hide
-- cross-tenant probes. search_path = '' — all app objects schema-qualified.
create or replace function public.drevora_vehicle_check_apply_trailer_attachment(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_trailer_source text,
  p_trailer_vehicle_id uuid,
  p_trailer_number_snapshot text,
  p_trailer_registration_snapshot text,
  p_trailer_type_snapshot text,
  p_trailer_label_snapshot text
)
returns table (
  trailer_source text,
  trailer_vehicle_id uuid,
  trailer_number_snapshot text,
  trailer_registration_snapshot text,
  trailer_type_snapshot text,
  trailer_label_snapshot text,
  vehicle_registration_snapshot text,
  vehicle_fleet_number_snapshot text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source text := coalesce(nullif(btrim(p_trailer_source), ''), 'none');
  v_truck_type text;
  v_truck_registration text;
  v_truck_fleet text;
  v_trailer_type text;
  v_trailer_number text;
  v_trailer_registration text;
  v_trailer_trailer_type text;
  v_trailer_label text;
  v_in_number text := nullif(btrim(coalesce(p_trailer_number_snapshot, '')), '');
  v_in_registration text := nullif(btrim(coalesce(p_trailer_registration_snapshot, '')), '');
  v_in_type text := nullif(btrim(coalesce(p_trailer_type_snapshot, '')), '');
  v_in_label text := nullif(btrim(coalesce(p_trailer_label_snapshot, '')), '');
begin
  if p_vehicle_id is null then
    raise exception 'DREVORA: vehicle_id is required.';
  end if;

  if p_company_id is null then
    raise exception 'DREVORA: company_id is required.';
  end if;

  if v_source not in ('none', 'company', 'third_party') then
    raise exception
      'DREVORA: trailer_source must be none, company, or third_party.';
  end if;

  select
    nullif(btrim(v.vehicle_type), ''),
    nullif(btrim(v.registration), ''),
    nullif(btrim(v.fleet_number), '')
  into v_truck_type, v_truck_registration, v_truck_fleet
  from public.vehicles v
  where v.id = p_vehicle_id;

  if not found then
    raise exception 'DREVORA: vehicle_id does not reference an existing vehicle.';
  end if;

  if not public.drevora_vehicle_in_company(p_vehicle_id, p_company_id) then
    raise exception 'DREVORA: vehicle_id does not belong to company_id.';
  end if;

  if v_truck_type is not distinct from 'Trailer' then
    raise exception
      'DREVORA: vehicle_id must reference the towing (non-Trailer) vehicle.';
  end if;

  if v_source = 'none' then
    return query select
      'none'::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      v_truck_registration,
      v_truck_fleet;
    return;
  end if;

  if v_source = 'third_party' then
    if p_trailer_vehicle_id is not null then
      raise exception
        'DREVORA: third_party trailers must not set trailer_vehicle_id (do not create a vehicles row).';
    end if;

    if v_in_number is null and v_in_label is null then
      raise exception
        'DREVORA: third_party trailer requires trailer_number_snapshot or trailer_label_snapshot.';
    end if;

    v_trailer_label := coalesce(v_in_label, v_in_number);

    return query select
      'third_party'::text,
      null::uuid,
      v_in_number,
      v_in_registration,
      v_in_type,
      v_trailer_label,
      v_truck_registration,
      v_truck_fleet;
    return;
  end if;

  -- company
  if p_trailer_vehicle_id is null then
    raise exception
      'DREVORA: company trailer_source requires trailer_vehicle_id.';
  end if;

  if p_trailer_vehicle_id = p_vehicle_id then
    raise exception 'DREVORA: Towing vehicle and trailer cannot be the same row.';
  end if;

  select
    nullif(btrim(v.vehicle_type), ''),
    nullif(btrim(v.trailer_number), ''),
    nullif(btrim(v.registration), ''),
    nullif(btrim(v.trailer_type), '')
  into
    v_trailer_type,
    v_trailer_number,
    v_trailer_registration,
    v_trailer_trailer_type
  from public.vehicles v
  where v.id = p_trailer_vehicle_id;

  if not found then
    raise exception
      'DREVORA: trailer_vehicle_id does not reference an existing vehicle.';
  end if;

  if v_trailer_type is distinct from 'Trailer' then
    raise exception
      'DREVORA: trailer_vehicle_id must reference a Trailer vehicle.';
  end if;

  if not public.drevora_vehicle_in_company(p_trailer_vehicle_id, p_company_id) then
    raise exception
      'DREVORA: trailer_vehicle_id does not belong to company_id.';
  end if;

  if v_trailer_number is null then
    raise exception
      'DREVORA: Selected company trailer has no trailer_number. Set vehicles.trailer_number before attaching it.';
  end if;

  v_trailer_label := coalesce(
    v_in_label,
    v_trailer_number,
    v_trailer_registration,
    'Trailer'
  );

  return query select
    'company'::text,
    p_trailer_vehicle_id,
    v_trailer_number,
    v_trailer_registration,
    coalesce(v_trailer_trailer_type, v_in_type),
    v_trailer_label,
    v_truck_registration,
    v_truck_fleet;
end;
$$;

revoke all on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) from public;
revoke all on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) from anon;
revoke all on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) from authenticated;

comment on function public.drevora_vehicle_check_apply_trailer_attachment(
  uuid, uuid, text, uuid, text, text, text, text
) is
  'Validates Vehicle Check trailer attachment and returns frozen truck/trailer identity snapshots. Internal — used by before-write trigger only.';

create or replace function public.drevora_vehicle_checks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved record;
begin
  -- Once final, do not re-resolve/overwrite snapshots (immutability protects
  -- non-trusted writers; history must stay frozen for everyone).
  if tg_op = 'UPDATE'
     and public.drevora_vehicle_check_is_final(old.status, old.signed_at) then
    return new;
  end if;

  select *
  into v_resolved
  from public.drevora_vehicle_check_apply_trailer_attachment(
    new.company_id,
    new.vehicle_id,
    new.trailer_source,
    new.trailer_vehicle_id,
    new.trailer_number_snapshot,
    new.trailer_registration_snapshot,
    new.trailer_type_snapshot,
    new.trailer_label_snapshot
  );

  new.trailer_source := v_resolved.trailer_source;
  new.trailer_vehicle_id := v_resolved.trailer_vehicle_id;
  new.trailer_number_snapshot := v_resolved.trailer_number_snapshot;
  new.trailer_registration_snapshot := v_resolved.trailer_registration_snapshot;
  new.trailer_type_snapshot := v_resolved.trailer_type_snapshot;
  new.trailer_label_snapshot := v_resolved.trailer_label_snapshot;

  -- Refresh towing snapshots from live vehicle while the check is not final.
  new.vehicle_registration_snapshot := v_resolved.vehicle_registration_snapshot;
  new.vehicle_fleet_number_snapshot := v_resolved.vehicle_fleet_number_snapshot;

  return new;
end;
$$;

drop trigger if exists vehicle_checks_before_write on public.vehicle_checks;
create trigger vehicle_checks_before_write
  before insert or update on public.vehicle_checks
  for each row
  execute function public.drevora_vehicle_checks_before_write();

revoke all on function public.drevora_vehicle_checks_before_write() from public;
revoke all on function public.drevora_vehicle_checks_before_write() from anon;
revoke all on function public.drevora_vehicle_checks_before_write() from authenticated;

comment on function public.drevora_vehicle_checks_before_write() is
  'Before insert/update: validate trailer attachment, freeze towing + trailer identity snapshots while the Vehicle Check is not final.';

-- -----------------------------------------------------------------------------
-- 4) Extend completed-check immutability (do not weaken; add protected fields)
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
       or new.completed_location_at is distinct from old.completed_location_at
       or new.vehicle_registration_snapshot is distinct from old.vehicle_registration_snapshot
       or new.vehicle_fleet_number_snapshot is distinct from old.vehicle_fleet_number_snapshot
       or new.trailer_source is distinct from old.trailer_source
       or new.trailer_vehicle_id is distinct from old.trailer_vehicle_id
       or new.trailer_number_snapshot is distinct from old.trailer_number_snapshot
       or new.trailer_registration_snapshot is distinct from old.trailer_registration_snapshot
       or new.trailer_type_snapshot is distinct from old.trailer_type_snapshot
       or new.trailer_label_snapshot is distinct from old.trailer_label_snapshot then
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
