-- Expand companies table into full SaaS control centre settings

alter table public.companies
  add column if not exists logo_url text,
  add column if not exists date_format text not null default 'DMY',
  add column if not exists week_starts text not null default 'monday',
  add column if not exists fleet_number_prefix text not null default '',
  add column if not exists default_vehicle_status text not null default 'Available',
  add column if not exists default_driver_role text not null default 'Driver',
  add column if not exists default_break_minutes integer not null default 30,
  add column if not exists overtime_after_hours integer not null default 8,
  add column if not exists round_time_minutes integer not null default 0,
  add column if not exists require_timesheet_approval boolean not null default true,
  add column if not exists holiday_year_start text not null default '01-01',
  add column if not exists annual_leave_allowance integer not null default 28,
  add column if not exists theme text not null default 'light',
  add column if not exists compact_tables boolean not null default false,
  add column if not exists email_notifications boolean not null default true,
  add column if not exists push_notifications boolean not null default false,
  add column if not exists session_timeout_minutes integer not null default 480,
  add column if not exists require_mfa boolean not null default false;

alter table public.companies drop constraint if exists companies_date_format_check;
alter table public.companies
  add constraint companies_date_format_check
  check (date_format in ('DMY', 'MDY', 'YMD'));

alter table public.companies drop constraint if exists companies_week_starts_check;
alter table public.companies
  add constraint companies_week_starts_check
  check (week_starts in ('monday', 'sunday'));

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
