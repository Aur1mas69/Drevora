-- Paste into Supabase SQL Editor to add vehicle_checks signature columns.
-- Safe to re-run.

alter table public.vehicle_checks
  add column if not exists signature_url text;

alter table public.vehicle_checks
  add column if not exists signed_at timestamptz;
