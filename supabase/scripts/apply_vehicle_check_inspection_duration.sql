-- Paste into Supabase SQL Editor to add vehicle_checks duration columns.
-- Safe to re-run.

alter table public.vehicle_checks
  add column if not exists inspection_started_at timestamptz,
  add column if not exists inspection_completed_at timestamptz,
  add column if not exists duration_seconds integer;

alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_duration_seconds_non_negative;

alter table public.vehicle_checks
  add constraint vehicle_checks_duration_seconds_non_negative check (
    duration_seconds is null or duration_seconds >= 0
  );
