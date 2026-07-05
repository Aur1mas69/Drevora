-- Worker profile fields for UK HGV / logistics.
-- Reuses existing expiry columns: driving_licence_expiry, cpc_expiry, driver_card_expiry, medical_expiry.

alter table public.drivers
  add column if not exists licence_categories text[],
  add column if not exists tacho_card_number text,
  add column if not exists default_vehicle_id uuid references public.vehicles (id) on delete set null,
  add column if not exists start_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text;

create index if not exists drivers_default_vehicle_id_idx
  on public.drivers (default_vehicle_id);
