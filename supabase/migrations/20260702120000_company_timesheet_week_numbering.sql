alter table public.companies
add column if not exists timesheet_week_start_day text not null default 'monday';

alter table public.companies
add column if not exists timesheet_week_reset_month integer not null default 4;

alter table public.companies
add column if not exists timesheet_week_reset_day integer not null default 5;

alter table public.companies drop constraint if exists companies_timesheet_week_start_day_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_timesheet_week_start_day_check'
  ) then
    alter table public.companies
    add constraint companies_timesheet_week_start_day_check
    check (timesheet_week_start_day in ('monday', 'sunday'));
  end if;
end $$;

alter table public.companies drop constraint if exists companies_timesheet_week_reset_month_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_timesheet_week_reset_month_check'
  ) then
    alter table public.companies
    add constraint companies_timesheet_week_reset_month_check
    check (timesheet_week_reset_month >= 1 and timesheet_week_reset_month <= 12);
  end if;
end $$;

alter table public.companies drop constraint if exists companies_timesheet_week_reset_day_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_timesheet_week_reset_day_check'
  ) then
    alter table public.companies
    add constraint companies_timesheet_week_reset_day_check
    check (timesheet_week_reset_day >= 1 and timesheet_week_reset_day <= 31);
  end if;
end $$;

alter table public.companies drop constraint if exists companies_timesheet_week_numbering_check;
alter table public.companies drop column if exists timesheet_week_numbering;

notify pgrst, 'reload schema';
