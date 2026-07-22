-- Per-worker Timesheet settings overrides.
-- Company settings remain defaults/fallback. Row presence = personal override active.
-- Reset to company defaults = DELETE the worker's row.
-- Idempotent. Does not modify historical timesheet_entries.

create table if not exists public.driver_timesheet_settings (
  driver_id uuid primary key references public.drivers (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Null column = inherit company default for that field.
  overtime_mode text null,
  overtime_calculation_method text null,
  overtime_after_hours numeric null,
  weekly_overtime_after_hours numeric null,
  overtime_multiplier numeric null,
  default_break_minutes integer null,
  paid_breaks boolean null,
  round_time_minutes integer null,
  currency text null,
  timesheet_week_start_day text null,

  saturday_overtime_enabled boolean null,
  saturday_overtime_after_hours numeric null,
  saturday_overtime_multiplier numeric null,
  saturday_guaranteed_paid_hours numeric null,

  sunday_overtime_enabled boolean null,
  sunday_overtime_after_hours numeric null,
  sunday_overtime_multiplier numeric null,
  sunday_guaranteed_paid_hours numeric null,

  constraint driver_timesheet_settings_overtime_mode_check
    check (overtime_mode is null or overtime_mode in ('Manual', 'Automatic')),
  constraint driver_timesheet_settings_ot_method_check
    check (
      overtime_calculation_method is null
      or overtime_calculation_method in ('daily', 'weekly', 'none')
    ),
  constraint driver_timesheet_settings_currency_check
    check (currency is null or currency in ('GBP', 'EUR', 'USD', 'RUB')),
  constraint driver_timesheet_settings_week_start_check
    check (
      timesheet_week_start_day is null
      or timesheet_week_start_day in ('monday', 'sunday')
    ),
  constraint driver_timesheet_settings_break_check
    check (
      default_break_minutes is null
      or default_break_minutes in (0, 15, 30, 45, 60)
    ),
  constraint driver_timesheet_settings_round_check
    check (
      round_time_minutes is null
      or round_time_minutes in (0, 5, 15)
    ),
  constraint driver_timesheet_settings_daily_ot_check
    check (
      overtime_after_hours is null
      or (
        overtime_after_hours >= 0
        and overtime_after_hours <= 24
      )
    ),
  constraint driver_timesheet_settings_weekly_ot_check
    check (
      weekly_overtime_after_hours is null
      or (
        weekly_overtime_after_hours >= 0
        and weekly_overtime_after_hours <= 168
      )
    ),
  constraint driver_timesheet_settings_multiplier_check
    check (
      overtime_multiplier is null
      or (
        overtime_multiplier >= 1.0
        and overtime_multiplier <= 3.0
      )
    )
);

create index if not exists driver_timesheet_settings_company_id_idx
  on public.driver_timesheet_settings (company_id);

comment on table public.driver_timesheet_settings is
  'Worker-owned Timesheet rule overrides. Missing row = use company defaults.';

alter table public.driver_timesheet_settings enable row level security;

revoke all on public.driver_timesheet_settings from public;
revoke all on public.driver_timesheet_settings from anon;
revoke all on public.driver_timesheet_settings from authenticated;

grant select, insert, update, delete on public.driver_timesheet_settings to authenticated;

drop policy if exists driver_timesheet_settings_office_select on public.driver_timesheet_settings;
create policy driver_timesheet_settings_office_select
  on public.driver_timesheet_settings
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

drop policy if exists driver_timesheet_settings_worker_select_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_select_own
  on public.driver_timesheet_settings
  for select
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );

drop policy if exists driver_timesheet_settings_worker_insert_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_insert_own
  on public.driver_timesheet_settings
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_id
        and d.company_id = company_id
    )
  );

drop policy if exists driver_timesheet_settings_worker_update_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_update_own
  on public.driver_timesheet_settings
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );

drop policy if exists driver_timesheet_settings_worker_delete_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_delete_own
  on public.driver_timesheet_settings
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
  );
