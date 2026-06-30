-- Sync public.companies with Company Settings UI.
-- Column names match the live Supabase public.companies table (inspected 2026-06-29).
-- Safe to re-run: every column uses ADD COLUMN IF NOT EXISTS.

alter table public.companies add column if not exists time_format text;
alter table public.companies add column if not exists logo_url text;
alter table public.companies add column if not exists date_format text;
alter table public.companies add column if not exists week_starts_on text;
alter table public.companies add column if not exists fleet_number_prefix text;
alter table public.companies add column if not exists default_vehicle_status text;
alter table public.companies add column if not exists default_driver_role text;
alter table public.companies add column if not exists default_break_minutes integer;
alter table public.companies add column if not exists overtime_after_hours integer;
alter table public.companies add column if not exists round_time_minutes integer;
alter table public.companies add column if not exists require_manager_approval boolean;
alter table public.companies add column if not exists holiday_year_start text;
alter table public.companies add column if not exists annual_leave_allowance integer;
alter table public.companies add column if not exists theme text;
alter table public.companies add column if not exists compact_tables boolean;
alter table public.companies add column if not exists email_notifications boolean;
alter table public.companies add column if not exists push_notifications boolean;
alter table public.companies add column if not exists session_timeout_minutes integer;
alter table public.companies add column if not exists require_mfa boolean;

-- Backfill nulls on existing rows
update public.companies
set
  time_format = coalesce(
    case
      when lower(trim(time_format)) in ('12-hour', '12h', '12 hour', '12') then '12-hour'
      when lower(trim(time_format)) in ('24-hour', '24h', '24 hour', '24') then '24-hour'
      else time_format
    end,
    '24-hour'
  ),
  date_format = coalesce(date_format, 'DMY'),
  week_starts_on = coalesce(week_starts_on, 'monday'),
  fleet_number_prefix = coalesce(fleet_number_prefix, ''),
  default_vehicle_status = coalesce(default_vehicle_status, 'Available'),
  default_driver_role = coalesce(default_driver_role, 'Driver'),
  default_break_minutes = coalesce(default_break_minutes, 30),
  overtime_after_hours = coalesce(overtime_after_hours, 8),
  round_time_minutes = coalesce(round_time_minutes, 0),
  require_manager_approval = coalesce(require_manager_approval, true),
  holiday_year_start = coalesce(holiday_year_start, '01-01'),
  annual_leave_allowance = coalesce(annual_leave_allowance, 28),
  theme = coalesce(theme, 'light'),
  compact_tables = coalesce(compact_tables, false),
  email_notifications = coalesce(email_notifications, true),
  push_notifications = coalesce(push_notifications, false),
  session_timeout_minutes = coalesce(session_timeout_minutes, 480),
  require_mfa = coalesce(require_mfa, false);

alter table public.companies alter column time_format set default '24-hour';
alter table public.companies alter column date_format set default 'DMY';
alter table public.companies alter column week_starts_on set default 'monday';
alter table public.companies alter column fleet_number_prefix set default '';
alter table public.companies alter column default_vehicle_status set default 'Available';
alter table public.companies alter column default_driver_role set default 'Driver';
alter table public.companies alter column default_break_minutes set default 30;
alter table public.companies alter column overtime_after_hours set default 8;
alter table public.companies alter column round_time_minutes set default 0;
alter table public.companies alter column require_manager_approval set default true;
alter table public.companies alter column holiday_year_start set default '01-01';
alter table public.companies alter column annual_leave_allowance set default 28;
alter table public.companies alter column theme set default 'light';
alter table public.companies alter column compact_tables set default false;
alter table public.companies alter column email_notifications set default true;
alter table public.companies alter column push_notifications set default false;
alter table public.companies alter column session_timeout_minutes set default 480;
alter table public.companies alter column require_mfa set default false;

alter table public.companies drop constraint if exists companies_time_format_check;
alter table public.companies
  add constraint companies_time_format_check
  check (time_format in ('24-hour', '12-hour'));

alter table public.companies drop constraint if exists companies_date_format_check;
alter table public.companies
  add constraint companies_date_format_check
  check (date_format in ('DMY', 'MDY', 'YMD'));

alter table public.companies drop constraint if exists companies_week_starts_on_check;
alter table public.companies
  add constraint companies_week_starts_on_check
  check (week_starts_on in ('monday', 'sunday'));

alter table public.companies drop constraint if exists companies_theme_check;
alter table public.companies
  add constraint companies_theme_check
  check (theme in ('light', 'dark', 'auto'));

alter table public.companies drop constraint if exists companies_default_break_check;
alter table public.companies
  add constraint companies_default_break_check
  check (default_break_minutes in (30, 45, 60));

alter table public.companies drop constraint if exists companies_overtime_after_check;
alter table public.companies
  add constraint companies_overtime_after_check
  check (overtime_after_hours in (8, 9, 10));

alter table public.companies drop constraint if exists companies_round_time_check;
alter table public.companies
  add constraint companies_round_time_check
  check (round_time_minutes in (0, 5, 15));
