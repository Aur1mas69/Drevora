-- Timesheet Holiday (H) days + half-day leave (H-AM / H-PM).
-- Idempotent; safe to re-run.

-- -----------------------------------------------------------------------------
-- companies.default_paid_holiday_hours
-- -----------------------------------------------------------------------------
alter table public.companies
  add column if not exists default_paid_holiday_hours numeric not null default 8;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_default_paid_holiday_hours_check'
  ) then
    alter table public.companies
      add constraint companies_default_paid_holiday_hours_check
      check (
        default_paid_holiday_hours >= 0
        and default_paid_holiday_hours <= 24
      );
  end if;
end $$;

comment on column public.companies.default_paid_holiday_hours is
  'Default payable hours credited for a full Timesheet Holiday (H) day. Half-day leave uses 50%. 0 = unpaid. Decimals allowed (e.g. 7.5).';

-- -----------------------------------------------------------------------------
-- driver_timesheet_settings.default_paid_holiday_hours (null = company default)
-- -----------------------------------------------------------------------------
alter table public.driver_timesheet_settings
  add column if not exists default_paid_holiday_hours numeric null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_timesheet_settings_holiday_hours_check'
  ) then
    alter table public.driver_timesheet_settings
      add constraint driver_timesheet_settings_holiday_hours_check
      check (
        default_paid_holiday_hours is null
        or (
          default_paid_holiday_hours >= 0
          and default_paid_holiday_hours <= 24
        )
      );
  end if;
end $$;

comment on column public.driver_timesheet_settings.default_paid_holiday_hours is
  'Worker override for full Holiday (H) day hours. Null inherits companies.default_paid_holiday_hours. Half-day = 50%. 0 = unpaid.';

-- -----------------------------------------------------------------------------
-- timesheet_entries.day_type + holiday_minutes
-- -----------------------------------------------------------------------------
alter table public.timesheet_entries
  add column if not exists day_type text not null default 'work';

alter table public.timesheet_entries
  add column if not exists holiday_minutes integer not null default 0;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'timesheet_entries_day_type_check'
  ) then
    alter table public.timesheet_entries
      drop constraint timesheet_entries_day_type_check;
  end if;

  alter table public.timesheet_entries
    add constraint timesheet_entries_day_type_check
    check (day_type in ('work', 'holiday', 'holiday_am', 'holiday_pm'));
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'timesheet_entries_holiday_minutes_check'
  ) then
    alter table public.timesheet_entries
      add constraint timesheet_entries_holiday_minutes_check
      check (holiday_minutes >= 0);
  end if;
end $$;

comment on column public.timesheet_entries.day_type is
  'Leave portion on the Timesheet day: work | holiday (H full) | holiday_am (H-AM first_half) | holiday_pm (H-PM second_half). Not limited to work|holiday — half-day leave is a first-class day_type. Half-day may also store worked hours on the same date (no fixed clock boundary).';

comment on column public.timesheet_entries.holiday_minutes is
  'Historical snapshot of payable holiday hours for the day (minutes). Full day = configured hours; half day = exactly 50%. OT never applies. Work stays in total_minutes / clocks.';

-- -----------------------------------------------------------------------------
-- holiday_requests start/end day portions (half-day leave)
-- -----------------------------------------------------------------------------
alter table public.holiday_requests
  add column if not exists start_day_portion text not null default 'full';

alter table public.holiday_requests
  add column if not exists end_day_portion text not null default 'full';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'holiday_requests_start_day_portion_check'
  ) then
    alter table public.holiday_requests
      add constraint holiday_requests_start_day_portion_check
      check (start_day_portion in ('full', 'first_half', 'second_half'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'holiday_requests_end_day_portion_check'
  ) then
    alter table public.holiday_requests
      add constraint holiday_requests_end_day_portion_check
      check (end_day_portion in ('full', 'first_half', 'second_half'));
  end if;
end $$;

comment on column public.holiday_requests.start_day_portion is
  'Portion of start_date taken as leave: full (1.0), first_half (0.5 AM), second_half (0.5 PM).';

comment on column public.holiday_requests.end_day_portion is
  'Portion of end_date taken as leave. Middle dates between start and end are always full days.';

notify pgrst, 'reload schema';
