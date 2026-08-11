-- =============================================================================
-- DREVORA — Add Trailer subtype column to public.vehicles
-- File: supabase/migrations/20260811210000_add_trailer_type_to_vehicles.sql
-- =============================================================================
-- PURPOSE
--   Add public.vehicles.trailer_type (plain text, no enum) so Trailer fleet
--   assets (vehicle_type = 'Trailer') can carry a subtype — e.g. Curtainsider,
--   Box, Reefer, Bulk, Tanker, Tipper, Flatbed, Low Loader, Other. This subtype
--   will later drive DREVORA Recommended trailer checks (not implemented here).
--
-- SCOPE
--   vehicles.trailer_type column + backfill + CHECK constraint only.
--   Does NOT create a trailers table. Does NOT change RLS/policies.
--   Does NOT touch Vehicle Checks, checklist items, or Worker UI.
--   Does NOT reinterpret the existing powered vehicle_type option
--   'Low Loader' as a Trailer. Only vehicle_type = 'Trailer' rows are
--   Trailer fleet assets; trailer_type = 'Low Loader' is a separate,
--   unrelated subtype value that only applies to those Trailer rows.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicles'
      and column_name = 'vehicle_type'
  ) then
    raise exception
      'DREVORA STOP: public.vehicles.vehicle_type is missing. Cannot distinguish Trailer vehicles.';
  end if;
end;
$$;

alter table public.vehicles
  add column if not exists trailer_type text;

comment on column public.vehicles.trailer_type is
  'Trailer subtype (Curtainsider, Box, Reefer, Bulk, Tanker, Tipper, Flatbed, Low Loader, Other). '
  'Only set when vehicle_type = Trailer. NULL for all other vehicle types. '
  'Distinct from the powered vehicle_type option "Low Loader" — that option does '
  'not make a row a Trailer fleet asset.';

-- Backfill existing Trailer rows that predate this column with the safe default.
update public.vehicles
set trailer_type = 'Other'
where coalesce(btrim(vehicle_type), '') = 'Trailer'
  and trailer_type is null;

-- Non-Trailer rows must never carry a trailer_type value.
update public.vehicles
set trailer_type = null
where coalesce(btrim(vehicle_type), '') is distinct from 'Trailer'
  and trailer_type is not null;

alter table public.vehicles
  drop constraint if exists vehicles_trailer_type_matches_vehicle_type;

alter table public.vehicles
  add constraint vehicles_trailer_type_matches_vehicle_type
  check (
    (
      vehicle_type is not null
      and btrim(vehicle_type) = 'Trailer'
      and trailer_type is not null
      and btrim(trailer_type) <> ''
    )
    or (
      coalesce(btrim(vehicle_type), '') is distinct from 'Trailer'
      and trailer_type is null
    )
  );

comment on constraint vehicles_trailer_type_matches_vehicle_type on public.vehicles is
  'trailer_type is required and non-empty when vehicle_type = Trailer, and must be NULL for every other vehicle_type.';
