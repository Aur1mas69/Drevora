-- Holiday counting settings for company-level holiday requests.

alter table public.companies
  add column if not exists holiday_counting_method text not null default 'working_days',
  add column if not exists holiday_working_days text[] not null default array[
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday'
  ]::text[];

update public.companies
set
  holiday_counting_method = coalesce(holiday_counting_method, 'working_days'),
  holiday_working_days = coalesce(
    holiday_working_days,
    array['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::text[]
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_holiday_counting_method_check'
  ) then
    alter table public.companies
      add constraint companies_holiday_counting_method_check
      check (
        holiday_counting_method in ('working_days', 'calendar_days', 'custom_working_week')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_holiday_working_days_check'
  ) then
    alter table public.companies
      add constraint companies_holiday_working_days_check
      check (
        holiday_working_days <@ array[
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday'
        ]::text[]
      );
  end if;
end $$;
