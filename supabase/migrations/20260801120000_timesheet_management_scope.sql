-- Who manages Timesheets? (company-wide workflow ownership).
-- Replaces the Admin UI formerly labelled "Weekend rules apply to".
-- Weekend OT calculation ownership (weekend_rules_scope) is unchanged.
-- Default 'worker' preserves existing Worker create/edit/submit behaviour.
-- Idempotent; safe to re-run.

alter table public.companies
add column if not exists timesheet_management_scope text not null default 'worker';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_timesheet_management_scope_check'
  ) then
    alter table public.companies
    add constraint companies_timesheet_management_scope_check
      check (timesheet_management_scope in ('office', 'worker'));
  end if;
end $$;

notify pgrst, 'reload schema';
