-- Manual overtime and payroll per timesheet day + company overtime mode

alter table public.timesheet_entries
  add column if not exists overtime_minutes integer not null default 0;

alter table public.timesheet_entries
  add column if not exists payroll_minutes integer not null default 0;

alter table public.companies
  add column if not exists overtime_mode text not null default 'Manual';

alter table public.companies drop constraint if exists companies_overtime_mode_check;
alter table public.companies
  add constraint companies_overtime_mode_check
  check (overtime_mode in ('Manual', 'Automatic'));
