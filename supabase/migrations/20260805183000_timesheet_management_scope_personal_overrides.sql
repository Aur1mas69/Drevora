-- Gate Worker personal Timesheet override writes on timesheet_management_scope,
-- and clear all company overrides when Admin switches to Office-managed mode.
-- Idempotent; safe to re-run.
-- Requires:
--   20260722190000_create_driver_timesheet_settings.sql
--   20260801120000_timesheet_management_scope.sql
--   20260804180000_timesheet_management_scope_worker_writes.sql
--     (drevora_company_workers_manage_timesheets)

do $$
begin
  if to_regclass('public.driver_timesheet_settings') is null then
    raise exception
      'Apply 20260722190000_create_driver_timesheet_settings.sql before this migration.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'timesheet_management_scope'
  ) then
    raise exception
      'Apply 20260801120000_timesheet_management_scope.sql before this migration.';
  end if;

  if to_regprocedure('public.drevora_company_workers_manage_timesheets(uuid)') is null then
    raise exception
      'Apply 20260804180000_timesheet_management_scope_worker_writes.sql before this migration.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- One-time cleanup: companies already in Office-managed mode.
-- Removes leftover personal Timesheet overrides that would otherwise remain
-- until the next worker→office transition (trigger only fires on change).
-- Worker-managed companies are untouched. Zero matching rows succeeds.
-- -----------------------------------------------------------------------------
delete from public.driver_timesheet_settings dts
using public.companies c
where dts.company_id = c.id
  and c.timesheet_management_scope = 'office';

-- -----------------------------------------------------------------------------
-- Explicit office-only clear for one company (service / tooling).
-- Deletes every driver_timesheet_settings row for that company only.
-- -----------------------------------------------------------------------------
create or replace function public.drevora_clear_company_driver_timesheet_settings(
  p_company_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_company_id is null then
    raise exception 'DREVORA: company id is required to clear Timesheet overrides.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception
      'DREVORA: Only Office can clear Worker Timesheet overrides for this company.';
  end if;

  delete from public.driver_timesheet_settings
  where company_id = p_company_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.drevora_clear_company_driver_timesheet_settings(uuid) is
  'Office-only: delete all driver_timesheet_settings rows for one company.';

revoke all on function public.drevora_clear_company_driver_timesheet_settings(uuid) from public;
revoke all on function public.drevora_clear_company_driver_timesheet_settings(uuid) from anon;
grant execute on function public.drevora_clear_company_driver_timesheet_settings(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Auto-clear overrides in the same transaction when scope becomes office.
-- Ensures old personal values cannot return when Worker mode is re-enabled.
-- -----------------------------------------------------------------------------
create or replace function public.drevora_clear_driver_timesheet_settings_on_office_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.timesheet_management_scope = 'office'
     and (
       tg_op = 'INSERT'
       or coalesce(old.timesheet_management_scope, '') is distinct from 'office'
     )
  then
    delete from public.driver_timesheet_settings
    where company_id = new.id;
  end if;

  return new;
end;
$$;

comment on function public.drevora_clear_driver_timesheet_settings_on_office_scope() is
  'When companies.timesheet_management_scope becomes office, delete that company''s Worker Timesheet overrides.';

drop trigger if exists drevora_clear_driver_timesheet_settings_on_office_scope
  on public.companies;

create trigger drevora_clear_driver_timesheet_settings_on_office_scope
  after insert or update of timesheet_management_scope
  on public.companies
  for each row
  execute function public.drevora_clear_driver_timesheet_settings_on_office_scope();

-- -----------------------------------------------------------------------------
-- Worker write policies: own row + Workers-manage-Timesheets mode only.
-- SELECT remains available in both modes so Workers can read effective rules.
-- -----------------------------------------------------------------------------
drop policy if exists driver_timesheet_settings_worker_insert_own on public.driver_timesheet_settings;
create policy driver_timesheet_settings_worker_insert_own
  on public.driver_timesheet_settings
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_company_workers_manage_timesheets(company_id)
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
    and public.drevora_company_workers_manage_timesheets(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_company_workers_manage_timesheets(company_id)
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_id
        and d.company_id = company_id
    )
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
    and public.drevora_company_workers_manage_timesheets(company_id)
  );

notify pgrst, 'reload schema';
