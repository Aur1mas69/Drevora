create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  registration text not null,
  fleet_number text,
  make text not null,
  model text not null,
  year integer,
  vin text,
  current_odometer integer,
  status text default 'Available',
  current_driver_id uuid references public.drivers(id) on delete set null,
  insurance_expiry date,
  mot_expiry date,
  road_tax_expiry date,
  tachograph_expiry date,
  notes text
);

create index if not exists vehicles_registration_idx on public.vehicles (registration);
create index if not exists vehicles_status_idx on public.vehicles (status);
create index if not exists vehicles_current_driver_idx on public.vehicles (current_driver_id);
