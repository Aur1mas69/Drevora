-- MVP default vehicle check templates (HGV Truck, Forklift, Trailer)
-- Safe to re-run: skips rows that already exist for (vehicle_type, section, item_name).

insert into public.vehicle_check_templates (
  vehicle_type,
  section,
  item_name,
  sort_order,
  is_required,
  is_active
)
select
  seed.vehicle_type,
  seed.section,
  seed.item_name,
  seed.sort_order,
  true,
  true
from (
  values
    -- HGV Truck
    ('HGV Truck', 'Exterior', 'Lights', 1),
    ('HGV Truck', 'Exterior', 'Tyres and wheels', 2),
    ('HGV Truck', 'Exterior', 'Mirrors and glass', 3),
    ('HGV Truck', 'Safety', 'Brakes', 1),
    ('HGV Truck', 'Safety', 'Steering', 2),
    ('HGV Truck', 'Safety', 'Horn', 3),
    ('HGV Truck', 'Safety', 'Seatbelt', 4),
    ('HGV Truck', 'Safety', 'Tachograph', 5),
    ('HGV Truck', 'Fluids', 'Oil', 1),
    ('HGV Truck', 'Fluids', 'Coolant', 2),
    ('HGV Truck', 'Fluids', 'Washer fluid', 3),
    ('HGV Truck', 'Equipment', 'Fire extinguisher', 1),
    ('HGV Truck', 'Equipment', 'First aid kit', 2),
    ('HGV Truck', 'Equipment', 'Warning triangle', 3),
    ('HGV Truck', 'Defects', 'Body damage', 1),
    ('HGV Truck', 'Defects', 'Leaks', 2),
    -- Forklift
    ('Forklift', 'Safety', 'Brakes', 1),
    ('Forklift', 'Safety', 'Steering', 2),
    ('Forklift', 'Safety', 'Horn', 3),
    ('Forklift', 'Safety', 'Seatbelt', 4),
    ('Forklift', 'Safety', 'Reversing alarm', 5),
    ('Forklift', 'Mast', 'Mast and carriage', 1),
    ('Forklift', 'Mast', 'Forks', 2),
    ('Forklift', 'Mast', 'Chains', 3),
    ('Forklift', 'Tyres', 'Tyres and wheels', 1),
    ('Forklift', 'Fluids', 'Hydraulic leaks', 1),
    ('Forklift', 'Battery or Fuel', 'Battery charge or fuel level', 1),
    ('Forklift', 'Defects', 'Visible damage', 1),
    -- Trailer
    ('Trailer', 'Exterior', 'Lights', 1),
    ('Trailer', 'Exterior', 'Tyres and wheels', 2),
    ('Trailer', 'Exterior', 'Reflectors', 3),
    ('Trailer', 'Coupling', 'Kingpin or coupling', 1),
    ('Trailer', 'Coupling', 'Air lines', 2),
    ('Trailer', 'Coupling', 'Electrical connections', 3),
    ('Trailer', 'Safety', 'Brakes', 1),
    ('Trailer', 'Safety', 'Landing legs', 2),
    ('Trailer', 'Load', 'Load security', 1),
    ('Trailer', 'Defects', 'Body damage', 1),
    ('Trailer', 'Defects', 'Leaks', 2)
) as seed (vehicle_type, section, item_name, sort_order)
where not exists (
  select 1
  from public.vehicle_check_templates existing
  where existing.vehicle_type = seed.vehicle_type
    and existing.section = seed.section
    and existing.item_name = seed.item_name
);
