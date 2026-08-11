-- =============================================================================
-- DREVORA — Grant vehicles.trailer_type on the existing column allowlist
-- File: supabase/migrations/20260811230000_grant_vehicles_trailer_type_column.sql
-- =============================================================================
-- PURPOSE
--   20260811210000 added public.vehicles.trailer_type and the client writes it
--   via vehiclesService.buildVehiclePayload. Vehicles INSERT/UPDATE are
--   column-allowlisted (no table INSERT/UPDATE). trailer_type was never added
--   to that allowlist, so Add/Edit Trailer returns HTTP 403 / 42501
--   "permission denied for column trailer_type".
--
-- SCOPE
--   GRANT INSERT/UPDATE (trailer_type) to authenticated only.
--   Does NOT change RLS policies, CHECK constraints, or tenant isolation.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicles'
      and column_name = 'trailer_type'
  ) then
    raise exception
      'DREVORA STOP: public.vehicles.trailer_type is missing. Apply 20260811210000_add_trailer_type_to_vehicles.sql first.';
  end if;
end;
$$;

-- Same allowlist pattern as trailer_number in 20260726180000.
-- Idempotent: re-granting an existing column privilege is a no-op.
grant insert (trailer_type) on table public.vehicles to authenticated;
grant update (trailer_type) on table public.vehicles to authenticated;

notify pgrst, 'reload schema';

commit;
