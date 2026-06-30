-- Vehicle type for checklist template matching (HGV Truck, Forklift, Trailer)

alter table public.vehicles
  add column if not exists vehicle_type text;

create index if not exists vehicles_vehicle_type_idx
  on public.vehicles (vehicle_type);
