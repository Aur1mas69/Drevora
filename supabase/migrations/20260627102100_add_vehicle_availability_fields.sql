alter table public.vehicles
  add column if not exists availability_status text default 'Available',
  add column if not exists off_road_start date,
  add column if not exists off_road_return date,
  add column if not exists off_road_notes text;
