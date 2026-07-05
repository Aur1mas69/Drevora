-- Vehicle consumables usage log (fuel, fluids, admixtures, etc.)

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  worker_id uuid references public.drivers (id) on delete set null,
  consumable_type text not null,
  item_name text,
  quantity numeric not null,
  unit text not null default 'L',
  cost numeric,
  supplier text,
  site text,
  odometer numeric,
  receipt_url text,
  notes text,
  entry_date date not null,
  entry_time time,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  constraint consumables_type_check check (
    consumable_type in (
      'Diesel',
      'Petrol',
      'AdBlue',
      'Engine Oil',
      'Coolant',
      'Screenwash',
      'Hydraulic Oil',
      'Grease',
      'Admixture',
      'Concrete Additive',
      'Other'
    )
  ),
  constraint consumables_unit_check check (
    unit in ('L', 'ml', 'kg', 'pcs', 'other')
  ),
  constraint consumables_quantity_non_negative check (quantity >= 0),
  constraint consumables_cost_non_negative check (cost is null or cost >= 0),
  constraint consumables_odometer_non_negative check (odometer is null or odometer >= 0)
);

create index if not exists consumables_entry_date_idx
  on public.consumables (entry_date);

create index if not exists consumables_type_idx
  on public.consumables (consumable_type);

create index if not exists consumables_vehicle_id_idx
  on public.consumables (vehicle_id);

create index if not exists consumables_worker_id_idx
  on public.consumables (worker_id);

create index if not exists consumables_not_deleted_idx
  on public.consumables (entry_date, deleted_at);

alter table public.consumables disable row level security;

grant select, insert, update, delete on public.consumables to anon, authenticated;
