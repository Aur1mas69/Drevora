-- Enforce company timesheet_management_scope for Worker self-service writes.
-- When scope is 'office', Workers may not insert/update timesheets or entries.
-- Idempotent: safe to re-run (CREATE OR REPLACE only; triggers unchanged).
-- Requires: 20260801120000_timesheet_management_scope.sql

do $$
begin
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
end $$;

create or replace function public.drevora_company_workers_manage_timesheets(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select c.timesheet_management_scope = 'worker'
      from public.companies c
      where c.id = p_company_id
    ),
    false
  );
$$;

comment on function public.drevora_company_workers_manage_timesheets(uuid) is
  'True when company timesheet_management_scope is worker (Workers manage their own Timesheets).';

create or replace function public.drevora_enforce_timesheet_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_company_id uuid;
begin
  v_company_id := case when tg_op = 'DELETE' then old.company_id else new.company_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Reopen consistency for all authenticated writers.
  if tg_op = 'UPDATE' and new.status in ('Draft', 'Submitted') then
    new.approved_at := null;
    new.rejected_at := null;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Timesheet write denied (no exact Worker link / not office).';
  end if;

  if not public.drevora_company_workers_manage_timesheets(v_company_id) then
    raise exception
      'DREVORA: Office manages Timesheets for this company. Workers cannot create or edit.';
  end if;

  if tg_op = 'INSERT' then
    if new.driver_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Timesheets.';
    end if;
    -- Force non-allowlisted fields.
    new.driver_id := v_worker_id;
    new.status := 'Draft';
    new.bonus_amount := 0;
    new.submitted_at := null;
    new.approved_at := null;
    new.rejected_at := null;
    new.deleted_at := null;
    new.deleted_by := null;
    new.delete_reason := null;
    new.cleaned_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Strict allowlist: only vehicle_id, week_start, notes, status, submitted_at, updated_at
    -- may differ (approved_at/rejected_at forced null above when Draft/Submitted).
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.driver_id is distinct from old.driver_id
       or new.driver_id is distinct from v_worker_id
       or old.driver_id is distinct from v_worker_id
       or new.created_at is distinct from old.created_at
       or new.bonus_amount is distinct from old.bonus_amount
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.delete_reason is distinct from old.delete_reason
       or new.cleaned_at is distinct from old.cleaned_at then
      raise exception 'DREVORA: Workers may not change immutable Timesheet fields.';
    end if;

    if new.vehicle_id is not distinct from old.vehicle_id
       and new.week_start is not distinct from old.week_start
       and new.notes is not distinct from old.notes
       and new.status is not distinct from old.status
       and new.submitted_at is not distinct from old.submitted_at
       and new.updated_at is not distinct from old.updated_at
       and new.approved_at is not distinct from old.approved_at
       and new.rejected_at is not distinct from old.rejected_at then
      return new;
    end if;

    if new.status is distinct from old.status then
      if new.status in ('Approved', 'Rejected') then
        raise exception 'DREVORA: Workers may not approve or reject Timesheets.';
      end if;
      if not (
        (old.status = 'Draft' and new.status = 'Submitted')
        or (old.status in ('Rejected', 'Approved') and new.status in ('Draft', 'Submitted'))
        or (old.status = 'Submitted' and new.status = 'Draft')
      ) then
        raise exception
          'DREVORA: Invalid Worker Timesheet status transition % -> %.',
          old.status, new.status;
      end if;
    end if;

    if new.submitted_at is distinct from old.submitted_at then
      if not (
        old.submitted_at is null
        and new.submitted_at is not null
        and new.status = 'Submitted'
      ) then
        raise exception 'DREVORA: Workers may only set submitted_at when submitting.';
      end if;
    end if;

    if new.status in ('Draft', 'Submitted')
       and (new.approved_at is not null or new.rejected_at is not null) then
      raise exception 'DREVORA: Draft/Submitted Timesheets cannot retain approval timestamps.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function public.drevora_enforce_timesheet_entry_worker_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_driver_id uuid;
  v_worker_id uuid;
begin
  select t.company_id, t.driver_id
    into v_company_id, v_driver_id
  from public.timesheets t
  where t.id = case when tg_op = 'DELETE' then old.timesheet_id else new.timesheet_id end;

  if public.drevora_is_trusted_tenant_writer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null or v_driver_id is distinct from v_worker_id then
    raise exception 'DREVORA: Workers may only write entries on their own Timesheets.';
  end if;

  if not public.drevora_company_workers_manage_timesheets(v_company_id) then
    raise exception
      'DREVORA: Office manages Timesheets for this company. Workers cannot create or edit.';
  end if;

  if tg_op = 'INSERT' then
    -- Allowlist: timesheet_id, day_date, start_time, break_minutes, finish_time,
    -- total_minutes, overtime_minutes, payroll_minutes, additional_hours, daily_comment.
    new.deleted_at := null;
    new.deleted_by := null;
    new.delete_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.timesheet_id is distinct from old.timesheet_id
       or new.deleted_at is distinct from old.deleted_at
       or new.deleted_by is distinct from old.deleted_by
       or new.delete_reason is distinct from old.delete_reason then
      raise exception 'DREVORA: Workers may not change immutable Timesheet entry fields.';
    end if;
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Timesheet entries.';
end;
$$;

revoke all on function public.drevora_company_workers_manage_timesheets(uuid) from public;
revoke all on function public.drevora_company_workers_manage_timesheets(uuid) from anon;
grant execute on function public.drevora_company_workers_manage_timesheets(uuid) to authenticated;

-- PostgREST connects as supabase_admin, so worker-write triggers may bypass via
-- drevora_is_trusted_tenant_writer(). Enforce Workers-manage scope in RLS too.
drop policy if exists timesheets_worker_insert_own on public.timesheets;
create policy timesheets_worker_insert_own
  on public.timesheets
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(driver_id, company_id)
    and public.drevora_company_workers_manage_timesheets(company_id)
    and status = 'Draft'
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists timesheets_worker_update_own on public.timesheets;
create policy timesheets_worker_update_own
  on public.timesheets
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and deleted_at is null
    and public.drevora_company_workers_manage_timesheets(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(driver_id, company_id)
    and public.drevora_company_workers_manage_timesheets(company_id)
    and deleted_at is null
    and (
      vehicle_id is null
      or public.drevora_vehicle_in_company(vehicle_id, company_id)
    )
  );

drop policy if exists timesheet_entries_worker_insert_own on public.timesheet_entries;
create policy timesheet_entries_worker_insert_own
  on public.timesheet_entries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
        and public.drevora_company_workers_manage_timesheets(t.company_id)
    )
  );

drop policy if exists timesheet_entries_worker_update_own on public.timesheet_entries;
create policy timesheet_entries_worker_update_own
  on public.timesheet_entries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
        and public.drevora_company_workers_manage_timesheets(t.company_id)
    )
  )
  with check (
    exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id is not null
        and public.drevora_auth_user_belongs_to_company_id(t.company_id)
        and t.driver_id = public.drevora_auth_user_driver_id()
        and public.drevora_company_workers_manage_timesheets(t.company_id)
    )
  );

notify pgrst, 'reload schema';
