-- =============================================================================
-- DREVORA — Company Timesheet OT calculation defaults (Daily / Weekly / None)
-- File: supabase/migrations/20260723200000_add_company_overtime_calculation_defaults.sql
-- =============================================================================
-- PURPOSE
--   Persist Admin → Settings → Timesheets overtime calculation method and
--   weekly threshold so Workers using company defaults receive the same
--   Daily / Weekly / None options already supported on Worker mobile settings.
--
-- SCOPE
--   Adds two columns on public.companies only.
--   Does NOT alter driver_timesheet_settings or calculation formulas.
--
-- DEPLOYMENT
--   Apply this migration on the linked Supabase project BEFORE relying on
--   Admin save of overtimeCalculationMethod / weeklyOvertimeAfterHours.
--   Frontend treats these columns as optional until present.
-- =============================================================================

alter table public.companies
  add column if not exists overtime_calculation_method text not null default 'daily';

alter table public.companies
  add column if not exists weekly_overtime_after_hours numeric not null default 45;

alter table public.companies
  drop constraint if exists companies_overtime_calculation_method_check;

alter table public.companies
  add constraint companies_overtime_calculation_method_check
  check (overtime_calculation_method in ('daily', 'weekly', 'none'));

alter table public.companies
  drop constraint if exists companies_weekly_overtime_after_hours_check;

alter table public.companies
  add constraint companies_weekly_overtime_after_hours_check
  check (
    weekly_overtime_after_hours >= 0
    and weekly_overtime_after_hours <= 168
  );

comment on column public.companies.overtime_calculation_method is
  'Automatic OT allocation for company defaults: daily, weekly, or none. Ignored when overtime_mode is Manual.';

comment on column public.companies.weekly_overtime_after_hours is
  'Weekly automatic OT threshold in hours (company default). Used when overtime_calculation_method = weekly.';
