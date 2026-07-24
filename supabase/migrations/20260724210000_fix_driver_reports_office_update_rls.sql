-- =============================================================================
-- Fix Office Driver Report status updates (HTTP 403 on UPDATE)
-- File: supabase/migrations/20260724210000_fix_driver_reports_office_update_rls.sql
-- =============================================================================
-- Root cause:
--   driver_reports_office_update WITH CHECK required
--   drevora_driver_in_company(worker_id) / drevora_vehicle_in_company(vehicle_id).
--   Historical rows can retain worker_id/vehicle_id that no longer pass those
--   helpers (null company_id on parent, mismatch, etc.). RLS then rejects EVERY
--   Office UPDATE — including status-only changes (New → In Progress → Closed)
--   — with HTTP 403, while SELECT still succeeds.
--
-- Fix:
--   1) Office UPDATE policy USING + WITH CHECK: same-company Office role only.
--   2) Enforce worker/vehicle company match in the write trigger only when
--      those FKs actually change (status updates keep existing FKs).
--   3) Preserve Worker update policy and company isolation.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Office UPDATE policy — status/management writes for same-company Office
-- -----------------------------------------------------------------------------
drop policy if exists driver_reports_office_update on public.driver_reports;

create policy driver_reports_office_update
  on public.driver_reports
  for update
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  )
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
  );

comment on policy driver_reports_office_update on public.driver_reports is
  'Office roles may update Driver Reports for their verified company. Cross-company worker/vehicle assignment is enforced on FK change by drevora_enforce_driver_report_worker_write.';

-- -----------------------------------------------------------------------------
-- 2) Trigger — Office may update status/notes; FK changes must stay in-company
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_driver_report_worker_write()
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

  if public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    if tg_op = 'UPDATE' then
      if new.company_id is distinct from old.company_id then
        raise exception 'DREVORA: Cannot change Driver Report company.';
      end if;

      -- Only validate when Office changes the FK (status-only updates keep orphans).
      if new.worker_id is distinct from old.worker_id
         and new.worker_id is not null
         and not public.drevora_driver_in_company(new.worker_id, new.company_id) then
        raise exception 'DREVORA: Worker must belong to the same company as the Driver Report.';
      end if;

      if new.vehicle_id is distinct from old.vehicle_id
         and new.vehicle_id is not null
         and not public.drevora_vehicle_in_company(new.vehicle_id, new.company_id) then
        raise exception 'DREVORA: Vehicle must belong to the same company as the Driver Report.';
      end if;
    end if;

    if tg_op = 'INSERT' then
      if new.worker_id is not null
         and not public.drevora_driver_in_company(new.worker_id, new.company_id) then
        raise exception 'DREVORA: Worker must belong to the same company as the Driver Report.';
      end if;

      if new.vehicle_id is not null
         and not public.drevora_vehicle_in_company(new.vehicle_id, new.company_id) then
        raise exception 'DREVORA: Vehicle must belong to the same company as the Driver Report.';
      end if;
    end if;

    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'DREVORA: Driver Report write denied (no exact Worker link / not office).';
  end if;

  if tg_op = 'INSERT' then
    if new.worker_id is distinct from v_worker_id then
      raise exception 'DREVORA: Workers may only create their own Driver Reports.';
    end if;
    new.status := 'New';
    new.office_notes := null;
    new.cleaned_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.worker_id is distinct from old.worker_id
       or new.worker_id is distinct from v_worker_id
       or old.worker_id is distinct from v_worker_id
       or new.created_at is distinct from old.created_at
       or new.office_notes is distinct from old.office_notes
       or new.cleaned_at is distinct from old.cleaned_at
       or new.status is distinct from 'New'
       or old.status is distinct from 'New' then
      raise exception 'DREVORA: Workers may only edit New Driver Reports with allowlisted fields.';
    end if;
    new.office_notes := old.office_notes;
    new.cleaned_at := old.cleaned_at;
    new.status := 'New';
    return new;
  end if;

  raise exception 'DREVORA: Workers may not delete Driver Reports.';
end;
$$;

revoke all on function public.drevora_enforce_driver_report_worker_write() from public;
revoke all on function public.drevora_enforce_driver_report_worker_write() from anon;
revoke all on function public.drevora_enforce_driver_report_worker_write() from authenticated;

notify pgrst, 'reload schema';

commit;
