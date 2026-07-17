-- =============================================================================
-- DREVORA — Allow Trailer vehicles without a Registration number
-- File: supabase/migrations/20260717223000_allow_trailer_without_registration.sql
-- =============================================================================
-- PURPOSE
--   Make public.vehicles.registration nullable ONLY for vehicle_type = 'Trailer'.
--   All other vehicle types (and NULL / unknown types) must keep a non-empty
--   registration.
--
-- SCOPE
--   Vehicles table registration nullability + CHECK constraint only.
--   Does NOT alter Tyre Check tables/functions.
--   Does NOT invent a second vehicle-type system (uses existing vehicle_type).
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
      and column_name = 'registration'
  ) then
    raise exception 'DREVORA STOP: public.vehicles.registration is missing.';
  end if;

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

-- Fail closed if any non-Trailer row would violate the new rule.
do $$
declare
  bad_count integer;
begin
  select count(*)::integer
  into bad_count
  from public.vehicles v
  where coalesce(btrim(v.vehicle_type), '') is distinct from 'Trailer'
    and (
      v.registration is null
      or btrim(v.registration) = ''
    );

  if bad_count > 0 then
    raise exception
      'DREVORA STOP: % non-Trailer vehicle row(s) have a null/empty registration. Fix those rows before applying this migration.',
      bad_count;
  end if;
end;
$$;

-- Trailers: empty registration strings become NULL (no fake plates).
update public.vehicles
set registration = null
where coalesce(btrim(vehicle_type), '') = 'Trailer'
  and registration is not null
  and btrim(registration) = '';

alter table public.vehicles
  alter column registration drop not null;

alter table public.vehicles
  drop constraint if exists vehicles_registration_required_unless_trailer;

alter table public.vehicles
  add constraint vehicles_registration_required_unless_trailer
  check (
    (
      vehicle_type is not null
      and btrim(vehicle_type) = 'Trailer'
      and (
        registration is null
        or btrim(registration) <> ''
      )
    )
    or (
      coalesce(btrim(vehicle_type), '') is distinct from 'Trailer'
      and registration is not null
      and btrim(registration) <> ''
    )
  );

comment on constraint vehicles_registration_required_unless_trailer on public.vehicles is
  'Registration may be NULL only when vehicle_type is exactly Trailer. All other types require a non-empty registration.';

-- Existing vehicles_registration_idx is a non-unique btree index.
-- PostgreSQL allows multiple NULL registration values under that index.
-- No unique registration constraint exists in the current schema, so no unique-index change is required.

-- Keep empty Trailer registrations normalised to NULL on write.
create or replace function public.drevora_normalize_vehicle_registration()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.registration is not null then
    new.registration := nullif(btrim(new.registration), '');
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_normalize_registration on public.vehicles;
create trigger vehicles_normalize_registration
  before insert or update of registration, vehicle_type on public.vehicles
  for each row
  execute function public.drevora_normalize_vehicle_registration();

revoke all on function public.drevora_normalize_vehicle_registration() from public;
revoke all on function public.drevora_normalize_vehicle_registration() from anon;
revoke all on function public.drevora_normalize_vehicle_registration() from authenticated;

comment on column public.vehicles.registration is
  'UK registration / plate when applicable. Nullable only for vehicle_type = Trailer; required and non-empty for all other types.';
