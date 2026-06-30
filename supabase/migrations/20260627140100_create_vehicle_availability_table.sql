create table if not exists public.vehicle_availability (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  status text not null,
  start_date date not null,
  end_date date,
  reason text,
  notes text
);

create index if not exists vehicle_availability_vehicle_id_idx
  on public.vehicle_availability (vehicle_id);

create index if not exists vehicle_availability_date_range_idx
  on public.vehicle_availability (start_date, end_date);

create index if not exists vehicle_availability_status_idx
  on public.vehicle_availability (status);

alter table public.vehicle_availability disable row level security;
