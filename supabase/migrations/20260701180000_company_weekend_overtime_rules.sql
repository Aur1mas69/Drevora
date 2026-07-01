alter table public.companies
add column if not exists saturday_overtime_enabled boolean not null default false;

alter table public.companies
add column if not exists saturday_overtime_after_hours numeric not null default 6.0;

alter table public.companies
add column if not exists saturday_overtime_multiplier numeric not null default 1.5;

alter table public.companies
add column if not exists sunday_overtime_enabled boolean not null default false;

alter table public.companies
add column if not exists sunday_overtime_after_hours numeric not null default 0.0;

alter table public.companies
add column if not exists sunday_overtime_multiplier numeric not null default 2.0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_saturday_overtime_after_hours_check'
  ) then
    alter table public.companies
    add constraint companies_saturday_overtime_after_hours_check
    check (
      saturday_overtime_after_hours >= 0
      and saturday_overtime_after_hours <= 15.5
      and (saturday_overtime_after_hours * 2) = floor(saturday_overtime_after_hours * 2)
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_sunday_overtime_after_hours_check'
  ) then
    alter table public.companies
    add constraint companies_sunday_overtime_after_hours_check
    check (
      sunday_overtime_after_hours >= 0
      and sunday_overtime_after_hours <= 15.5
      and (sunday_overtime_after_hours * 2) = floor(sunday_overtime_after_hours * 2)
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_saturday_overtime_multiplier_check'
  ) then
    alter table public.companies
    add constraint companies_saturday_overtime_multiplier_check
    check (
      saturday_overtime_multiplier >= 1.0
      and saturday_overtime_multiplier <= 2.5
      and (saturday_overtime_multiplier * 10) = floor(saturday_overtime_multiplier * 10)
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_sunday_overtime_multiplier_check'
  ) then
    alter table public.companies
    add constraint companies_sunday_overtime_multiplier_check
    check (
      sunday_overtime_multiplier >= 1.0
      and sunday_overtime_multiplier <= 2.5
      and (sunday_overtime_multiplier * 10) = floor(sunday_overtime_multiplier * 10)
    );
  end if;
end $$;

notify pgrst, 'reload schema';
