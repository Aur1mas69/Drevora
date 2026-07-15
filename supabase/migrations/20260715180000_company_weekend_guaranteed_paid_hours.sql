-- Configurable guaranteed paid hours for Saturday and Sunday overtime rules.

alter table public.companies
add column if not exists saturday_guaranteed_paid_hours numeric not null default 10.0;

alter table public.companies
add column if not exists sunday_guaranteed_paid_hours numeric not null default 10.0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_saturday_guaranteed_paid_hours_check'
  ) then
    alter table public.companies
    add constraint companies_saturday_guaranteed_paid_hours_check
    check (
      saturday_guaranteed_paid_hours >= 5.0
      and saturday_guaranteed_paid_hours <= 15.0
      and (saturday_guaranteed_paid_hours * 2) = floor(saturday_guaranteed_paid_hours * 2)
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_sunday_guaranteed_paid_hours_check'
  ) then
    alter table public.companies
    add constraint companies_sunday_guaranteed_paid_hours_check
    check (
      sunday_guaranteed_paid_hours >= 5.0
      and sunday_guaranteed_paid_hours <= 15.0
      and (sunday_guaranteed_paid_hours * 2) = floor(sunday_guaranteed_paid_hours * 2)
    );
  end if;
end $$;

notify pgrst, 'reload schema';
