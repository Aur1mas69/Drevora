-- Worker signature reference for completed vehicle inspections.
-- Safe to re-run in Supabase SQL Editor.

alter table public.vehicle_checks
  add column if not exists signature_url text;

alter table public.vehicle_checks
  add column if not exists signed_at timestamptz;
