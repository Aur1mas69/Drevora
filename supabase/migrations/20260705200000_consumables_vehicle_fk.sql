-- Ensure consumables.vehicle_id references vehicles.id (idempotent)

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'consumables'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'vehicles'
  )
  and not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'consumables'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name = 'consumables_vehicle_id_fkey'
  ) then
    alter table public.consumables
      add constraint consumables_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles (id) on delete set null;
  end if;
end $$;
