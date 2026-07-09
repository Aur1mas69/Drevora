-- Add odometer unit to vehicle_checks (miles | km).
-- Safe to re-run in Supabase SQL Editor.

alter table public.vehicle_checks
  add column if not exists odometer_unit text;

update public.vehicle_checks
set odometer_unit = 'miles'
where odometer_unit is null;

alter table public.vehicle_checks
  alter column odometer_unit set default 'miles';

alter table public.vehicle_checks
  alter column odometer_unit set not null;

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_odometer_unit_check;

alter table public.vehicle_checks
  add constraint vehicle_checks_odometer_unit_check check (
    odometer_unit in ('miles', 'km')
  );
