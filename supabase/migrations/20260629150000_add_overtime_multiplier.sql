-- Overtime pay multiplier for timesheet payroll (e.g. 1.5x for time-and-a-half)

alter table public.companies
  add column if not exists overtime_multiplier numeric not null default 1.5;

alter table public.companies drop constraint if exists companies_overtime_multiplier_check;
alter table public.companies
  add constraint companies_overtime_multiplier_check
  check (overtime_multiplier in (1, 1.25, 1.5, 1.75, 2));
