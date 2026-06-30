-- Vehicle-type based inspection checklist templates

create table if not exists public.vehicle_check_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  vehicle_type text not null,
  section text not null,
  item_name text not null,
  sort_order integer default 0,
  is_required boolean default true,
  is_active boolean default true
);

create index if not exists vehicle_check_templates_vehicle_type_idx
  on public.vehicle_check_templates (vehicle_type);

create index if not exists vehicle_check_templates_section_idx
  on public.vehicle_check_templates (section);

create index if not exists vehicle_check_templates_is_active_idx
  on public.vehicle_check_templates (is_active);

alter table public.vehicle_check_templates disable row level security;

grant select, insert, update, delete on public.vehicle_check_templates to anon, authenticated;

-- Default templates: HGV Truck
insert into public.vehicle_check_templates (vehicle_type, section, item_name, sort_order) values
  ('HGV Truck', 'Exterior', 'Mirrors', 1),
  ('HGV Truck', 'Exterior', 'Windscreen', 2),
  ('HGV Truck', 'Exterior', 'Lights', 3),
  ('HGV Truck', 'Exterior', 'Indicators', 4),
  ('HGV Truck', 'Exterior', 'Tyres', 5),
  ('HGV Truck', 'Exterior', 'Wheels', 6),
  ('HGV Truck', 'Exterior', 'Body Damage', 7),
  ('HGV Truck', 'Safety', 'Brakes', 1),
  ('HGV Truck', 'Safety', 'Steering', 2),
  ('HGV Truck', 'Safety', 'Horn', 3),
  ('HGV Truck', 'Safety', 'Seatbelt', 4),
  ('HGV Truck', 'Safety', 'Fire Extinguisher', 5),
  ('HGV Truck', 'Fluids', 'Engine Oil', 1),
  ('HGV Truck', 'Fluids', 'Coolant', 2),
  ('HGV Truck', 'Fluids', 'Washer Fluid', 3),
  ('HGV Truck', 'Load', 'Load Security', 1),
  ('HGV Truck', 'Load', 'Tail Lift', 2),
  ('HGV Truck', 'Load', 'Coupling', 3);

-- Default templates: Forklift
insert into public.vehicle_check_templates (vehicle_type, section, item_name, sort_order) values
  ('Forklift', 'Exterior', 'Forks', 1),
  ('Forklift', 'Exterior', 'Tyres', 2),
  ('Forklift', 'Exterior', 'Body Damage', 3),
  ('Forklift', 'Safety', 'Horn', 1),
  ('Forklift', 'Safety', 'Brakes', 2),
  ('Forklift', 'Safety', 'Seatbelt', 3),
  ('Forklift', 'Safety', 'Beacon', 4),
  ('Forklift', 'Mechanical', 'Hydraulics', 1),
  ('Forklift', 'Mechanical', 'Chains', 2),
  ('Forklift', 'Mechanical', 'Battery/Fuel', 3),
  ('Forklift', 'Mechanical', 'Leaks', 4);

-- Default templates: Trailer
insert into public.vehicle_check_templates (vehicle_type, section, item_name, sort_order) values
  ('Trailer', 'Exterior', 'Tyres', 1),
  ('Trailer', 'Exterior', 'Lights', 2),
  ('Trailer', 'Exterior', 'Body Damage', 3),
  ('Trailer', 'Safety', 'Brakes', 1),
  ('Trailer', 'Safety', 'Coupling', 2),
  ('Trailer', 'Safety', 'Air Lines', 3),
  ('Trailer', 'Safety', 'Electrical Lines', 4),
  ('Trailer', 'Load', 'Load Security', 1);
