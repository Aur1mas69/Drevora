-- Daily vehicle inspections and defect reports

create table if not exists public.vehicle_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  worker_id uuid not null references public.drivers (id) on delete cascade,
  inspection_date date not null,
  odometer integer,
  status text not null default 'Completed',
  overall_result text not null default 'Pass',
  notes text,
  constraint vehicle_checks_status_check check (
    status in ('Completed', 'Pending', 'In Progress')
  ),
  constraint vehicle_checks_overall_result_check check (
    overall_result in ('Pass', 'Advisory', 'Fail')
  )
);

create table if not exists public.vehicle_check_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_check_id uuid not null references public.vehicle_checks (id) on delete cascade,
  category text not null,
  item_name text not null,
  result text not null default 'Pass',
  comment text,
  photo_url text,
  constraint vehicle_check_items_result_check check (
    result in ('Pass', 'Advisory', 'Fail')
  )
);

create index if not exists vehicle_checks_vehicle_id_idx
  on public.vehicle_checks (vehicle_id);

create index if not exists vehicle_checks_worker_id_idx
  on public.vehicle_checks (worker_id);

create index if not exists vehicle_checks_inspection_date_idx
  on public.vehicle_checks (inspection_date);

create index if not exists vehicle_checks_status_idx
  on public.vehicle_checks (status);

create index if not exists vehicle_checks_overall_result_idx
  on public.vehicle_checks (overall_result);

create index if not exists vehicle_check_items_check_id_idx
  on public.vehicle_check_items (vehicle_check_id);

create index if not exists vehicle_check_items_result_idx
  on public.vehicle_check_items (result);

alter table public.vehicle_checks disable row level security;
alter table public.vehicle_check_items disable row level security;

grant select, insert, update, delete on public.vehicle_checks to anon, authenticated;
grant select, insert, update, delete on public.vehicle_check_items to anon, authenticated;
