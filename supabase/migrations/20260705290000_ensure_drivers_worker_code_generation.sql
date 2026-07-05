-- Ensure worker_code auto-generation on public.drivers (legacy Workers table).
-- Safe to run even if 20260705240000 was partially applied.

alter table public.drivers
  add column if not exists worker_code text;

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

do $$
declare
  worker_row record;
begin
  for worker_row in
    select id, company
    from public.drivers
    where worker_code is null or btrim(worker_code) = ''
    order by created_at nulls last, id
  loop
    update public.drivers
    set worker_code = public.generate_unique_worker_code(worker_row.company)
    where id = worker_row.id
      and (worker_code is null or btrim(worker_code) = '');
  end loop;
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
