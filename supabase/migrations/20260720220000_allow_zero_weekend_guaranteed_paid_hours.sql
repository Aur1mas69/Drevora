-- Allow Saturday/Sunday guaranteed paid hours to be 0 (and any decimal >= 0).
-- 0 is a valid configuration for:
--   - no guaranteed pay;
--   - overtime from the first hour;
--   - Sunday double-time only (guaranteed = 0, starts after = 0, multiplier = 2.0).
-- Previously: >= 5.0 AND <= 15.0 AND half-hour steps only (rejected 0 and values like 12.25).

alter table public.companies
  drop constraint if exists companies_saturday_guaranteed_paid_hours_check;

alter table public.companies
  drop constraint if exists companies_sunday_guaranteed_paid_hours_check;

alter table public.companies
  add constraint companies_saturday_guaranteed_paid_hours_check
  check (saturday_guaranteed_paid_hours >= 0);

alter table public.companies
  add constraint companies_sunday_guaranteed_paid_hours_check
  check (sunday_guaranteed_paid_hours >= 0);

notify pgrst, 'reload schema';
