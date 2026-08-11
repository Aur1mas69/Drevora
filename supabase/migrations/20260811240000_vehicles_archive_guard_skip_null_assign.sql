-- =============================================================================
-- DREVORA — Do not assign RPC-only vehicle lifecycle columns on client INSERT
-- File: supabase/migrations/20260811240000_vehicles_archive_guard_skip_null_assign.sql
-- =============================================================================
-- PURPOSE
--   After vehicles.trailer_type INSERT/UPDATE grants were applied, Add Trailer
--   still failed with HTTP 403 / 42501 "permission denied for table vehicles".
--
--   Client INSERT columns already match the authenticated column allowlist
--   (including trailer_type). createVehicle uses insert().select().single();
--   authenticated already has table-level SELECT, so RETURNING is not the
--   missing privilege.
--
--   vehicles_archive_reason_guard is SECURITY INVOKER and runs BEFORE INSERT.
--   On active rows it assigned:
--     NEW.archive_reason := null
--     NEW.retention_expires_at := null
--   Those columns are intentionally excluded from the INSERT allowlist
--   (RPC-only). They have no column ACL, so Postgres privilege check falls
--   through to table INSERT — which was revoked — and reports:
--     permission denied for table vehicles
--   rather than a column-specific 42501.
--
--   This migration keeps the same validation and does not grant INSERT/UPDATE
--   on archive_reason / retention_expires_at / archived_at.
--
-- SCOPE
--   Replace drevora_vehicles_archive_reason_guard() body only.
--   Does NOT change RLS, CHECKs, or column grants.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

begin;

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
    -- Already null: do not assign NEW.archive_reason / retention_expires_at.
    -- Assigning those RPC-only columns (even to null) requires INSERT/UPDATE
    -- privilege; with no column ACL, Postgres checks table INSERT/UPDATE
    -- (revoked) and raises 42501 "permission denied for table vehicles".
    return new;
  end if;

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

  return new;
end;
$$;

revoke all on function public.drevora_vehicles_archive_reason_guard() from public;
revoke all on function public.drevora_vehicles_archive_reason_guard() from anon;

comment on function public.drevora_vehicles_archive_reason_guard() is
  'SECURITY INVOKER lifecycle guard. Validates archive_reason/retention; does not assign RPC-only columns on active inserts (column-allowlist safe).';

notify pgrst, 'reload schema';

commit;
