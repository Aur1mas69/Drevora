alter table public.vehicles
  add column if not exists off_road_reason text,
  add column if not exists off_road_start_date date,
  add column if not exists off_road_expected_return_date date;
