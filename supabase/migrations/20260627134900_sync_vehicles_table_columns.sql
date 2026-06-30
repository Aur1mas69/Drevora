create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid()
);

alter table public.vehicles
  add column if not exists created_at timestamptz default now(),
  add column if not exists registration text,
  add column if not exists fleet_number text,
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists year integer,
  add column if not exists vin text,
  add column if not exists current_odometer integer,
  add column if not exists status text default 'Available',
  add column if not exists availability_status text default 'Available',
  add column if not exists current_driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists insurance_expiry date,
  add column if not exists mot_expiry date,
  add column if not exists road_tax_expiry date,
  add column if not exists tachograph_expiry date,
  add column if not exists off_road_reason text,
  add column if not exists off_road_start_date date,
  add column if not exists off_road_expected_return_date date,
  add column if not exists off_road_start date,
  add column if not exists off_road_return date,
  add column if not exists off_road_notes text,
  add column if not exists notes text;

create index if not exists vehicles_registration_idx
  on public.vehicles (registration);

create index if not exists vehicles_status_idx
  on public.vehicles (status);

create index if not exists vehicles_availability_status_idx
  on public.vehicles (availability_status);

create index if not exists vehicles_current_driver_idx
  on public.vehicles (current_driver_id);

create index if not exists vehicles_mot_expiry_idx
  on public.vehicles (mot_expiry);

create index if not exists vehicles_insurance_expiry_idx
  on public.vehicles (insurance_expiry);
