-- =============================================================================
-- Vehicle Checks: completed immutability + correction workflow
-- File: supabase/migrations/20260724220000_vehicle_checks_completed_immutable_and_corrections.sql
-- =============================================================================
-- 1) Add correction link columns on vehicle_checks
-- 2) Block mutation/deletion of Completed (or signed) inspections except defect_review_*
-- 3) Block item mutations when parent is Completed/signed
-- 4) Preserve Worker rules; Office may create correction rows (new Pending/In Progress)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Correction columns
-- -----------------------------------------------------------------------------
alter table public.vehicle_checks
  add column if not exists original_check_id uuid references public.vehicle_checks (id) on delete restrict;

alter table public.vehicle_checks
  add column if not exists correction_reason text;

alter table public.vehicle_checks
  add column if not exists correction_created_by uuid references auth.users (id) on delete set null;

alter table public.vehicle_checks
  add column if not exists correction_created_at timestamptz;

comment on column public.vehicle_checks.original_check_id is
  'When set, this row is a correction/amendment of the referenced completed Vehicle Check. The original remains unchanged.';
comment on column public.vehicle_checks.correction_reason is
  'Office-required reason when creating a correction. Null for non-correction rows.';
comment on column public.vehicle_checks.correction_created_by is
  'auth.users.id of the Office user who created the correction.';
comment on column public.vehicle_checks.correction_created_at is
  'Timestamp when the correction row was created.';

create index if not exists vehicle_checks_original_check_id_idx
  on public.vehicle_checks (original_check_id)
  where original_check_id is not null;

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_correction_reason_required;

alter table public.vehicle_checks
  add constraint vehicle_checks_correction_reason_required
  check (
    original_check_id is null
    or (
      correction_reason is not null
      and length(trim(correction_reason)) > 0
    )
  );

-- -----------------------------------------------------------------------------
-- 2) Helpers
-- -----------------------------------------------------------------------------
create or replace function public.drevora_vehicle_check_is_final(
  p_status text,
  p_signed_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_status = 'Completed'
    or p_signed_at is not null;
$$;

revoke all on function public.drevora_vehicle_check_is_final(text, timestamptz) from public;
grant execute on function public.drevora_vehicle_check_is_final(text, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Parent immutability (Office + Worker; trusted writer bypass)
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
       or new.created_at is distinct from old.created_at then
      raise exception 'DREVORA: Completed Vehicle Checks are read-only. Create a correction to amend.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists drevora_enforce_vehicle_check_completed_immutable
  on public.vehicle_checks;

create trigger drevora_enforce_vehicle_check_completed_immutable
  before update or delete on public.vehicle_checks
  for each row
  execute function public.drevora_enforce_vehicle_check_completed_immutable();

revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from public;
revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from anon;
revoke all on function public.drevora_enforce_vehicle_check_completed_immutable() from authenticated;

-- -----------------------------------------------------------------------------
-- 4) Item immutability when parent is final
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_vehicle_check_item_completed_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_status text;
  v_signed_at timestamptz;
begin
  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_parent_id := case
    when tg_op = 'DELETE' then old.vehicle_check_id
    else new.vehicle_check_id
  end;

  select vc.status, vc.signed_at
    into v_status, v_signed_at
  from public.vehicle_checks vc
  where vc.id = v_parent_id;

  if public.drevora_vehicle_check_is_final(v_status, v_signed_at) then
    raise exception 'DREVORA: Checklist items on a completed Vehicle Check cannot be changed.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists drevora_enforce_vehicle_check_item_completed_immutable
  on public.vehicle_check_items;

create trigger drevora_enforce_vehicle_check_item_completed_immutable
  before insert or update or delete on public.vehicle_check_items
  for each row
  execute function public.drevora_enforce_vehicle_check_item_completed_immutable();

revoke all on function public.drevora_enforce_vehicle_check_item_completed_immutable() from public;
revoke all on function public.drevora_enforce_vehicle_check_item_completed_immutable() from anon;
revoke all on function public.drevora_enforce_vehicle_check_item_completed_immutable() from authenticated;

notify pgrst, 'reload schema';

commit;
