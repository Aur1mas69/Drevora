-- =============================================================================
-- DREVORA — Ensure drivers/vehicles archived_at columns (idempotent repair)
-- File: supabase/migrations/20260721150000_ensure_drivers_vehicles_archived_at.sql
-- =============================================================================
-- PURPOSE
--   Live projects return PostgREST 400 because archived_at is missing:
--     - column drivers.archived_at does not exist
--     - column vehicles.archived_at does not exist
--
--   Canonical definitions also exist in:
--     20260720190000_worker_plan_allowance_enforcement.sql
--     20260720200000_vehicle_plan_allowance_enforcement.sql
--
--   This repair only adds the nullable columns + matching company-scoped indexes.
--   Existing rows stay active (archived_at remains NULL). No data backfill.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Workers (public.drivers)
-- Scope column used by frontend/services: company_id uuid
-- -----------------------------------------------------------------------------
alter table public.drivers
  add column if not exists archived_at timestamptz;

comment on column public.drivers.archived_at is
  'Timestamp when the Worker was archived. NULL means active.';

create index if not exists drivers_company_id_archived_at_idx
  on public.drivers (company_id, archived_at);

create index if not exists drivers_company_id_active_idx
  on public.drivers (company_id)
  where archived_at is null;

-- -----------------------------------------------------------------------------
-- 2) Vehicles (public.vehicles)
-- Scope column used by frontend/services: company_id uuid
-- -----------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists archived_at timestamptz;

comment on column public.vehicles.archived_at is
  'Timestamp when the Vehicle was archived. NULL means active.';

create index if not exists vehicles_company_id_archived_at_idx
  on public.vehicles (company_id, archived_at);

create index if not exists vehicles_company_id_active_idx
  on public.vehicles (company_id)
  where archived_at is null;

notify pgrst, 'reload schema';
