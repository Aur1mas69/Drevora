-- =============================================================================
-- DREVORA migration: 20260727200000_worker_set_default_vehicle_rpc
--
-- Purpose:
--   Allow an authenticated Worker to set their own drivers.default_vehicle_id
--   via a SECURITY DEFINER RPC. Workers have SELECT-only RLS on drivers and
--   cannot UPDATE the row directly.
--
-- Safety:
--   - Worker identity derived only from auth.uid() via drevora_auth_user_driver_id()
--   - Locks the Worker drivers row (FOR UPDATE), then the target vehicles row
--     (FOR UPDATE), before writing — serializes with Vehicle/Worker Archive RPCs
--   - Accepts only an active (archived_at IS NULL) vehicle in the Worker's company
--   - Updates ONLY drivers.default_vehicle_id for that Worker row
--   - Never touches vehicles.current_driver_id
--   - Does not grant table-level UPDATE on drivers
--   - EXECUTE granted only to authenticated (+ service_role when present);
--     PUBLIC and anon remain revoked
--
-- Apply manually on the Supabase project after review. Do not auto-apply.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.drivers') is null then
    raise exception 'DREVORA STOP 20260727200000: public.drivers is missing';
  end if;

  if to_regclass('public.vehicles') is null then
    raise exception 'DREVORA STOP 20260727200000: public.vehicles is missing';
  end if;

  if to_regprocedure('public.drevora_auth_user_driver_id()') is null then
    raise exception
      'DREVORA STOP 20260727200000: public.drevora_auth_user_driver_id() is missing';
  end if;

  if to_regprocedure('public.drevora_vehicle_in_company(uuid, uuid)') is null then
    raise exception
      'DREVORA STOP 20260727200000: public.drevora_vehicle_in_company(uuid, uuid) is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'default_vehicle_id'
  ) then
    raise exception
      'DREVORA STOP 20260727200000: drivers.default_vehicle_id is missing';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- RPC: set / clear the caller's default vehicle
-- -----------------------------------------------------------------------------
create or replace function public.drevora_worker_set_default_vehicle(
  p_vehicle_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
  v_vehicle_company_id uuid;
  v_vehicle_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'Worker profile not found';
  end if;

  -- Lock the exact active Worker row so concurrent Worker Archive cannot
  -- race past an unlocked read of company_id / archived_at.
  select d.company_id
  into v_company_id
  from public.drivers d
  where d.id = v_worker_id
    and d.archived_at is null
  for update;

  if not found or v_company_id is null then
    raise exception 'Worker company not found';
  end if;

  -- Allow clearing the default by passing NULL (Worker row already locked).
  if p_vehicle_id is null then
    update public.drivers d
    set default_vehicle_id = null
    where d.id = v_worker_id
      and d.company_id = v_company_id
      and d.archived_at is null;

    if not found then
      raise exception 'Unable to update default vehicle';
    end if;

    return null;
  end if;

  -- Lock the exact Vehicle row, then validate company + active status.
  -- Selecting without an archived_at filter ensures we wait on Vehicle Archive's
  -- FOR UPDATE and then fail cleanly if the Vehicle was archived.
  select v.company_id, v.archived_at
  into v_vehicle_company_id, v_vehicle_archived_at
  from public.vehicles v
  where v.id = p_vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if v_vehicle_company_id is distinct from v_company_id then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if v_vehicle_archived_at is not null then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  if not public.drevora_vehicle_in_company(p_vehicle_id, v_company_id) then
    raise exception 'Vehicle not found or not active in your company';
  end if;

  -- Both rows are locked; write only drivers.default_vehicle_id.
  update public.drivers d
  set default_vehicle_id = p_vehicle_id
  where d.id = v_worker_id
    and d.company_id = v_company_id
    and d.archived_at is null;

  if not found then
    raise exception 'Unable to update default vehicle';
  end if;

  -- Intentionally does not modify vehicles.current_driver_id.
  return p_vehicle_id;
end;
$$;

comment on function public.drevora_worker_set_default_vehicle(uuid) is
  'Worker-only: set or clear drivers.default_vehicle_id for the authenticated active Worker. Locks Worker then Vehicle (FOR UPDATE) before write. Accepts only an active same-company vehicle. Never updates vehicles.current_driver_id.';

revoke all on function public.drevora_worker_set_default_vehicle(uuid) from public;
revoke all on function public.drevora_worker_set_default_vehicle(uuid) from anon;
grant execute on function public.drevora_worker_set_default_vehicle(uuid) to authenticated;

-- Preserve service_role EXECUTE when the role exists (matches security hardening pattern).
do $$
begin
  if to_regrole('service_role') is not null then
    execute 'grant execute on function public.drevora_worker_set_default_vehicle(uuid) to service_role';
  end if;
end $$;

commit;

-- =============================================================================
-- Manual verification (do not execute as part of migration):
--
-- select public.drevora_worker_set_default_vehicle('<active-vehicle-uuid>'::uuid);
-- select default_vehicle_id from public.drivers where id = public.drevora_auth_user_driver_id();
-- select current_driver_id from public.vehicles where id = '<active-vehicle-uuid>'::uuid;
-- =============================================================================
