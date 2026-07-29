-- Configurable Weekend Timesheet Rules ownership.
-- Admin chooses whether Saturday/Sunday overtime rules are owned centrally
-- ("company") or individually by each Worker ("worker"). Weekday rules are
-- never affected. Idempotent; safe to re-run.

-- 1) Company-level scope flag. Existing companies default to 'company'
--    (Whole company), which preserves current behaviour exactly.
alter table public.companies
add column if not exists weekend_rules_scope text not null default 'company';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_weekend_rules_scope_check'
  ) then
    alter table public.companies
    add constraint companies_weekend_rules_scope_check
      check (weekend_rules_scope in ('company', 'worker'));
  end if;
end $$;

-- 2) Worker-owned "use company default break" overrides for Saturday/Sunday.
--    Null = inherit company default_break behaviour for that day (existing
--    fallback pattern used by every other column on this table).
alter table public.driver_timesheet_settings
add column if not exists saturday_use_company_default_break boolean null;

alter table public.driver_timesheet_settings
add column if not exists sunday_use_company_default_break boolean null;

notify pgrst, 'reload schema';
