-- =============================================================================
-- DREVORA — Vehicle subscription allowance excludes Trailers
-- File: supabase/migrations/20260811250000_vehicle_plan_allowance_excludes_trailers.sql
-- =============================================================================
-- PRODUCT RULE
--   Subscription vehicle allowance applies ONLY to non-Trailer fleet assets.
--   Rows where vehicle_type = 'Trailer' must NOT consume a vehicle plan slot.
--     25 powered + 0 trailers  => 25 / 25 Vehicles
--     25 powered + 10 trailers => still 25 / 25 Vehicles (another Trailer is OK)
--     24 powered + 10 trailers => 24 / 25 Vehicles
--
-- SCOPE
--   Replace public.drevora_enforce_vehicle_plan_allowance() body only, and
--   recreate its trigger to additionally fire on UPDATE OF vehicle_type (see
--   rule 3 below — without this, an in-place Trailer -> Vehicle type change
--   would never re-run the check at all, since Postgres only fires an
--   "UPDATE OF col_list" trigger when a listed column is part of the UPDATE's
--   SET list).
--   Does NOT change RLS policies, table/column GRANTs, or pricing/plan sizes.
--   Does NOT add a Trailer-specific limit — Trailers are simply exempt from
--   this existing powered-vehicle allowance mechanism.
--
-- BEHAVIOUR
--   1. INSERT of vehicle_type = 'Trailer': the powered-vehicle slot count/limit
--      is never checked. (Company/subscription validity is still checked —
--      only the slot-count portion is skipped for Trailers.)
--   2. INSERT of any non-Trailer vehicle_type: unchanged existing enforcement,
--      except the active-count query now excludes Trailer rows (they never
--      occupied a slot logically, even before this fix Trailers were
--      incorrectly counted against the limit).
--   3. UPDATE Trailer -> non-Trailer while active: now explicitly enforced,
--      even when archived_at/company_id are unchanged, because it starts
--      consuming a powered-vehicle slot.
--   4. UPDATE non-Trailer -> Trailer: no slot check — this releases a slot.
--   5. Archived rows: unchanged — archived rows never count and never trigger
--      the check (unless they are being restored, exactly as before).
--   6. Company isolation (company_id scoping) and the `for update` row lock
--      on the company row are preserved exactly.
--   7. Powered-vehicle enforcement itself is not weakened — same limit
--      resolution, same subscription-expiry gate, same over-limit rejection.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

begin;

create or replace function public.drevora_enforce_vehicle_plan_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_plan_code text;
  v_valid_until timestamptz;
  v_limit integer;
  v_active_count integer;
  v_becoming_active boolean := false;
  v_new_is_trailer boolean;
  v_old_is_trailer boolean;
begin
  v_new_is_trailer := coalesce(btrim(new.vehicle_type), '') = 'Trailer';
  v_old_is_trailer := tg_op = 'UPDATE' and coalesce(btrim(old.vehicle_type), '') = 'Trailer';

  if tg_op = 'INSERT' then
    v_becoming_active := (new.archived_at is null);
  elsif tg_op = 'UPDATE' then
    v_becoming_active :=
      (old.archived_at is not null and new.archived_at is null)
      or (
        new.archived_at is null
        and old.company_id is distinct from new.company_id
      );

    -- Rule 3: Trailer -> non-Trailer while remaining active must be checked
    -- even when neither archived_at nor company_id changed — it starts
    -- consuming a powered-vehicle slot from this point on.
    if new.archived_at is null and v_old_is_trailer and not v_new_is_trailer then
      v_becoming_active := true;
    end if;
  end if;

  if not v_becoming_active then
    return new;
  end if;

  v_company_id := new.company_id;
  if v_company_id is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Vehicle company_id is required for plan allowance checks.';
  end if;

  select c.plan_code, c.subscription_valid_until
  into v_plan_code, v_valid_until
  from public.companies c
  where c.id = v_company_id
  for update;

  if not found then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Company not found for Vehicle plan allowance check.';
  end if;

  if v_valid_until is not null and now() >= v_valid_until then
    raise exception 'SUBSCRIPTION_PLAN_EXPIRED'
      using errcode = 'P0001',
            hint = format(
              'Your trial expired on %s. Existing records remain available. Contact DREVORA to renew your plan.',
              to_char(v_valid_until at time zone 'UTC', 'DD Mon YYYY')
            );
  end if;

  -- Rules 1 and 4: Trailers never consume or require a powered-vehicle plan
  -- slot. The subscription itself must still be valid (checked above), but
  -- no slot is resolved, counted, or enforced for a Trailer-typed row.
  if v_new_is_trailer then
    return new;
  end if;

  v_limit := public.drevora_active_vehicle_limit_for_plan(v_plan_code);

  if v_limit is null then
    raise exception 'VEHICLE_PLAN_ALLOWANCE_UNAVAILABLE'
      using errcode = 'P0001',
            hint = 'Assign a valid starter/growing/pro plan, or configure a trusted Custom Fleet Vehicle limit.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.vehicles v
  where v.company_id = v_company_id
    and v.archived_at is null
    and coalesce(btrim(v.vehicle_type), '') is distinct from 'Trailer'
    and (tg_op = 'INSERT' or v.id is distinct from new.id);

  if v_active_count >= v_limit then
    raise exception 'VEHICLE_PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = format(
              'Active Vehicles %s / %s. Archive an inactive Vehicle or change the company plan.',
              v_active_count,
              v_limit
            );
  end if;

  return new;
end;
$$;

comment on function public.drevora_enforce_vehicle_plan_allowance() is
  'Prevents creating or reactivating non-Trailer Vehicles above the company active-Vehicle plan allowance. Trailers (vehicle_type = Trailer) are exempt — they never consume or require a slot.';

-- Recreate the trigger to also fire on vehicle_type changes (rule 3);
-- archived_at/company_id remain unchanged from the original trigger.
drop trigger if exists vehicles_enforce_vehicle_plan_allowance on public.vehicles;
create trigger vehicles_enforce_vehicle_plan_allowance
  before insert or update of archived_at, company_id, vehicle_type
  on public.vehicles
  for each row
  execute function public.drevora_enforce_vehicle_plan_allowance();

-- ---------------------------------------------------------------------------
-- drevora_restore_vehicle(uuid) duplicates the same seat pre-check (comment:
-- "race-safe with trigger") before its own UPDATE. Without this fix, restoring
-- an archived Trailer would be wrongly blocked by this RPC's own pre-check
-- even though the trigger above now exempts Trailers. Signature, grants,
-- and every other check are unchanged (CREATE OR REPLACE preserves existing
-- REVOKE/GRANT on this function). The plan-allowance trigger fired by this
-- function's own UPDATE remains the race-safe authority for every row type.
-- ---------------------------------------------------------------------------
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
  v_is_trailer boolean;
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

  v_is_trailer := coalesce(btrim(v_row.vehicle_type), '') = 'Trailer';

  -- Trailers never consume/require a powered-vehicle plan slot — skip the
  -- seat lock/re-check entirely (rules 1/4). The plan-allowance trigger
  -- fired by the UPDATE below still applies to every row type.
  if not v_is_trailer then
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
      and v.archived_at is null
      and coalesce(btrim(v.vehicle_type), '') is distinct from 'Trailer';

    if v_active_count >= v_limit then
      raise exception 'VEHICLE_PLAN_LIMIT_REACHED'
        using errcode = 'P0001',
              hint = 'Your vehicle limit has been reached. Archive another vehicle or upgrade your plan before restoring this vehicle.';
    end if;
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
  'Office-only restore of an archived Vehicle when an active plan seat is available. Requires end-user JWT aal2. Clears archived_at, archive_reason, and retention_expires_at. Does not restore Worker assignments. Trailers (vehicle_type = Trailer) are exempt from the seat check.';

notify pgrst, 'reload schema';

commit;
