-- =============================================================================
-- Secure timesheet_submission_confirmations (RLS + minimum INSERT policies)
-- File: supabase/migrations/20260802140000_timesheet_submission_confirmations_rls.sql
-- =============================================================================
-- ROOT CAUSE
--   Table was created with RLS disabled and broad anon/authenticated
--   SELECT+INSERT grants (20260731230000). Live Security Advisor reports RLS
--   enabled with zero policies ("RLS Enabled No Policy"), which denies all
--   client access by default and leaves isolation undocumented.
--
-- SECURITY MODEL B — DIRECT FRONTEND ACCESS REQUIRED (INSERT only)
--   timesheetsService.submitTimesheet inserts one audit row after updating
--   public.timesheets. Called from Worker self-service and Office submit.
--   No application code SELECTs, UPDATEs, or DELETEs this table.
--   Current confirmation state is read from timesheets columns only.
--   Reject RPC clears timesheets confirmation fields; it does not touch this
--   audit table (history is preserved).
--
-- POLICIES
--   - Worker INSERT: own company + confirmed_by_driver_id = own driver_id
--     + parent timesheet ownership/week_start match
--   - Office INSERT: office role for company + driver/timesheet in company
--   - No SELECT / UPDATE / DELETE policies (append-only; clients cannot read
--     or mutate history via PostgREST)
--
-- GRANTS
--   Revoke anon/public. Authenticated INSERT only. service_role unchanged
--   (bypasses RLS for trusted maintenance).
--
-- Idempotent. Do not auto-apply; run on the Supabase project before testing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.timesheet_submission_confirmations') is null then
    raise exception
      'TSC_CONFIRM_RLS_PRECONDITION: public.timesheet_submission_confirmations missing; apply 20260731230000_timesheet_worker_submission_confirmation.sql first';
  end if;

  if to_regprocedure('public.drevora_auth_user_belongs_to_company_id(uuid)') is null
     or to_regprocedure('public.drevora_auth_user_has_office_role_for_company(uuid)') is null
     or to_regprocedure('public.drevora_auth_user_driver_id()') is null
     or to_regprocedure('public.drevora_driver_in_company(uuid,uuid)') is null then
    raise exception
      'TSC_CONFIRM_RLS_PRECONDITION: tenant RLS helpers missing; apply 20260715210000_enable_full_tenant_rls.sql first';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Keep / enable RLS (do not disable)
-- -----------------------------------------------------------------------------
alter table public.timesheet_submission_confirmations enable row level security;

comment on table public.timesheet_submission_confirmations is
  'Append-only audit of Worker Timesheet submission confirmations. Survives Office return/reject resets of timesheets.worker_confirmed. RLS: authenticated INSERT only (Worker own / Office company); no client SELECT/UPDATE/DELETE.';

-- -----------------------------------------------------------------------------
-- 2) Privileges — revoke unsafe access; grant INSERT only
-- -----------------------------------------------------------------------------
revoke all on table public.timesheet_submission_confirmations from public;
revoke all on table public.timesheet_submission_confirmations from anon;
revoke all on table public.timesheet_submission_confirmations from authenticated;

grant insert on table public.timesheet_submission_confirmations to authenticated;
-- Defense in depth: never allow client mutation of audit rows
revoke update, delete, truncate on table public.timesheet_submission_confirmations from authenticated;
revoke update, delete, truncate on table public.timesheet_submission_confirmations from anon;

-- -----------------------------------------------------------------------------
-- 3) Drop only policies owned by this migration (idempotent re-run)
-- -----------------------------------------------------------------------------
drop policy if exists timesheet_submission_confirmations_worker_insert_own
  on public.timesheet_submission_confirmations;
drop policy if exists timesheet_submission_confirmations_office_insert
  on public.timesheet_submission_confirmations;

-- -----------------------------------------------------------------------------
-- 4) Minimum INSERT policies
-- -----------------------------------------------------------------------------

-- Worker self-service: confirm only own Timesheet in own company
create policy timesheet_submission_confirmations_worker_insert_own
  on public.timesheet_submission_confirmations
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and confirmed_by_driver_id is not null
    and confirmed_by_driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_driver_in_company(confirmed_by_driver_id, company_id)
    and exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id = company_id
        and t.driver_id = confirmed_by_driver_id
        and t.week_start = week_start
        and t.deleted_at is null
    )
  );

comment on policy timesheet_submission_confirmations_worker_insert_own
  on public.timesheet_submission_confirmations is
  'Worker may insert an audit confirmation only for their own driver_id and matching company Timesheet.';

-- Office submit-on-behalf (Admin Timesheets drawer): company-scoped only
create policy timesheet_submission_confirmations_office_insert
  on public.timesheet_submission_confirmations
  for insert
  to authenticated
  with check (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and confirmed_by_driver_id is not null
    and public.drevora_driver_in_company(confirmed_by_driver_id, company_id)
    and exists (
      select 1
      from public.timesheets t
      where t.id = timesheet_id
        and t.company_id = company_id
        and t.driver_id = confirmed_by_driver_id
        and t.week_start = week_start
        and t.deleted_at is null
    )
  );

comment on policy timesheet_submission_confirmations_office_insert
  on public.timesheet_submission_confirmations is
  'Office may insert an audit confirmation for a Worker Timesheet in their company only.';

-- -----------------------------------------------------------------------------
-- 5) Reload PostgREST schema cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
