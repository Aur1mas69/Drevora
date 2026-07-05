-- Ensure all Worker profile columns exist on public.drivers (legacy table name).
-- Safe to run once in Supabase SQL Editor even if earlier profile migrations were skipped.

alter table public.drivers
  add column if not exists worker_code text,
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists role text default 'Driver',
  add column if not exists employment_type text,
  add column if not exists licence_categories text[],
  add column if not exists driving_licence_expiry date,
  add column if not exists cpc_expiry date,
  add column if not exists driver_card_expiry date,
  add column if not exists medical_expiry date,
  add column if not exists tacho_card_number text,
  add column if not exists default_vehicle_id uuid,
  add column if not exists start_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text;

-- FK to vehicles (only when vehicles table exists and constraint is missing)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'vehicles'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_default_vehicle_id_fkey'
  ) then
    alter table public.drivers
      add constraint drivers_default_vehicle_id_fkey
      foreign key (default_vehicle_id)
      references public.vehicles (id)
      on delete set null;
  end if;
end;
$$;

create index if not exists drivers_default_vehicle_id_idx
  on public.drivers (default_vehicle_id);

-- worker_code helpers (idempotent)
create or replace function public.generate_worker_code()
returns text
language plpgsql
volatile
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..5 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.generate_unique_worker_code(p_company text)
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := public.generate_worker_code();
    if not exists (
      select 1
      from public.drivers d
      where coalesce(d.company, '') = coalesce(p_company, '')
        and d.worker_code = candidate
    ) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts >= 100 then
      raise exception 'Could not generate unique worker_code for company after 100 attempts';
    end if;
  end loop;
end;
$$;

-- Backfill worker_code for rows missing it (before NOT NULL)
do $$
declare
  worker_row record;
begin
  for worker_row in
    select id, company
    from public.drivers
    where worker_code is null
    order by created_at nulls last, id
  loop
    update public.drivers
    set worker_code = public.generate_unique_worker_code(worker_row.company)
    where id = worker_row.id;
  end loop;
end;
$$;

-- NOT NULL only when every row has a code
do $$
begin
  if not exists (select 1 from public.drivers where worker_code is null) then
    alter table public.drivers
      alter column worker_code set not null;
  end if;
end;
$$;

create unique index if not exists drivers_company_worker_code_unique_idx
  on public.drivers (coalesce(company, ''), worker_code);

create or replace function public.drivers_set_worker_code()
returns trigger
language plpgsql
as $$
begin
  if new.worker_code is null or btrim(new.worker_code) = '' then
    new.worker_code := public.generate_unique_worker_code(new.company);
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_set_worker_code_trigger on public.drivers;

create trigger drivers_set_worker_code_trigger
  before insert on public.drivers
  for each row
  execute function public.drivers_set_worker_code();

update public.drivers
set role = 'Driver'
where role is null;
