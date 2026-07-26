-- =============================================================================
-- DREVORA — Timesheets Office lifecycle RPCs
-- File: supabase/migrations/20260726240000_timesheets_office_lifecycle_rpcs.sql
-- =============================================================================
-- Purpose:
--   Office-only SECURITY DEFINER RPCs for lifecycle transitions that fail under
--   direct table UPDATE because timesheets_office_update WITH CHECK re-validates
--   the full NEW row, including:
--     drevora_driver_in_company(driver_id, company_id)
--     and (vehicle_id is null or drevora_vehicle_in_company(vehicle_id, company_id))
--   Historical rows whose driver_id / vehicle_id no longer satisfy those helpers
--   raise HTTP 403 / SQLSTATE 42501 on Clean, Approve (Submitted → Approved) and
--   Reject (Submitted → Rejected).
--
-- RPCs in this file:
--   1) drevora_clean_timesheets_current_view(uuid, date, date)
--   2) drevora_approve_timesheets(uuid, uuid[])
--   3) drevora_reject_timesheets(uuid, uuid[])
--
-- Does NOT drop/alter Timesheets RLS policies or table grants.
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.
-- Idempotent. Preserves all rows, IDs, entries, totals, retention.
-- =============================================================================

begin;

-- =============================================================================
-- 0) Pre-apply diagnostics (commented — read-only)
-- =============================================================================
-- select polname, pg_get_expr(polqual, polrelid) as using_expr,
--        pg_get_expr(polwithcheck, polrelid) as with_check_expr
-- from pg_policy
-- where polrelid = 'public.timesheets'::regclass
--   and polname = 'timesheets_office_update';
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and p.proname in (
--     'drevora_clean_timesheets_current_view',
--     'drevora_approve_timesheets',
--     'drevora_reject_timesheets'
--   )
-- order by p.proname;
-- -- Expected before apply: 0 rows

-- =============================================================================
-- 1) Clean Current View RPC
-- =============================================================================
create or replace function public.drevora_clean_timesheets_current_view(
  p_company_id uuid,
  p_week_start_from date default null,
  p_week_start_to date default null
)
returns table (
  id uuid,
  cleaned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleaned_at timestamptz := transaction_timestamp();
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_CLEAN_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'TIMESHEET_CLEAN_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_CLEAN_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_week_start_from is not null
     and p_week_start_to is not null
     and p_week_start_from > p_week_start_to then
    raise exception 'TIMESHEET_CLEAN_INVALID_RANGE'
      using errcode = '22023',
            hint = 'week_start From must be on or before To.';
  end if;

  return query
  update public.timesheets t
  set
    cleaned_at = v_cleaned_at,
    updated_at = v_cleaned_at
  where t.company_id = p_company_id
    and t.deleted_at is null
    and t.cleaned_at is null
    and (p_week_start_from is null or t.week_start >= p_week_start_from)
    and (p_week_start_to is null or t.week_start <= p_week_start_to)
  returning t.id, t.cleaned_at;
end;
$$;

comment on function public.drevora_clean_timesheets_current_view(uuid, date, date) is
  'Office-only soft-clean Current view: sets cleaned_at and updated_at on company Timesheets matching optional week_start From/To. Does not delete rows, touch entries, or alter status/approvals/retention.';

revoke all on function public.drevora_clean_timesheets_current_view(uuid, date, date) from public;
revoke all on function public.drevora_clean_timesheets_current_view(uuid, date, date) from anon;
grant execute on function public.drevora_clean_timesheets_current_view(uuid, date, date) to authenticated;

-- =============================================================================
-- 2) Approve Timesheets RPC (single or bulk; atomic)
-- =============================================================================
create or replace function public.drevora_approve_timesheets(
  p_company_id uuid,
  p_timesheet_ids uuid[]
)
returns table (
  id uuid,
  status text,
  approved_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved_at timestamptz := transaction_timestamp();
  v_ids uuid[];
  v_requested integer;
  v_locked integer;
  v_invalid integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_APPROVE_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'TIMESHEET_APPROVE_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_APPROVE_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_timesheet_ids is null or coalesce(cardinality(p_timesheet_ids), 0) = 0 then
    raise exception 'TIMESHEET_APPROVE_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  if exists (
    select 1
    from unnest(p_timesheet_ids) as x(id)
    where x.id is null
  ) then
    raise exception 'TIMESHEET_APPROVE_INVALID'
      using errcode = '22023',
            hint = 'Timesheet ids must not contain null.';
  end if;

  -- Normalize duplicates; keep deterministic order for lock acquisition.
  select array_agg(distinct x.id order by x.id)
  into v_ids
  from unnest(p_timesheet_ids) as x(id);

  v_requested := coalesce(cardinality(v_ids), 0);
  if v_requested = 0 then
    raise exception 'TIMESHEET_APPROVE_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  -- Lock every requested row that belongs to this company (ordered to reduce deadlocks).
  perform 1
  from (
    select t.id
    from public.timesheets t
    where t.company_id = p_company_id
      and t.id = any (v_ids)
    order by t.id
    for update
  ) as locked;

  select count(*)::integer
  into v_locked
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids);

  if v_locked is distinct from v_requested then
    raise exception 'TIMESHEET_APPROVE_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'One or more Timesheets were not found for this company.';
  end if;

  select count(*)::integer
  into v_invalid
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and (
      t.deleted_at is not null
      or t.cleaned_at is not null
      or t.status is distinct from 'Submitted'
    );

  if v_invalid > 0 then
    raise exception 'TIMESHEET_APPROVE_INVALID_STATE'
      using errcode = 'P0001',
            hint = 'Every selected Timesheet must be Current, not deleted, and Submitted.';
  end if;

  -- Approved-only fields (no approved_by column in schema). Does not clear rejected_at
  -- because the existing direct Approve path never cleared rejection metadata.
  return query
  update public.timesheets t
  set
    status = 'Approved',
    approved_at = v_approved_at,
    updated_at = v_approved_at
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and t.deleted_at is null
    and t.cleaned_at is null
    and t.status = 'Submitted'
  returning t.id, t.status, t.approved_at, t.updated_at;

  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_requested then
    raise exception 'TIMESHEET_APPROVE_PARTIAL'
      using errcode = 'P0001',
            hint = 'Approve aborted: not every requested Timesheet could be approved.';
  end if;
end;
$$;

comment on function public.drevora_approve_timesheets(uuid, uuid[]) is
  'Office-only atomic Approve: sets status=Approved, approved_at and updated_at for company Current Submitted Timesheets. Fails entirely if any requested id is missing, cross-company, deleted, cleaned, or not Submitted. Does not touch entries, week_start, submitted_at, cleaned_at, deleted_at or retention.';

revoke all on function public.drevora_approve_timesheets(uuid, uuid[]) from public;
revoke all on function public.drevora_approve_timesheets(uuid, uuid[]) from anon;
grant execute on function public.drevora_approve_timesheets(uuid, uuid[]) to authenticated;

-- =============================================================================
-- 3) Reject Timesheets RPC (single or bulk; atomic)
-- =============================================================================
-- Established direct Reject PATCH fields: status, rejected_at, updated_at.
-- No timesheets.rejection_reason column and no Reject-reason UI/modal.
-- Does not clear approved_at (prior direct Reject path never cleared it).
create or replace function public.drevora_reject_timesheets(
  p_company_id uuid,
  p_timesheet_ids uuid[]
)
returns table (
  id uuid,
  status text,
  rejected_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rejected_at timestamptz := transaction_timestamp();
  v_ids uuid[];
  v_requested integer;
  v_locked integer;
  v_invalid integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_REJECT_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'TIMESHEET_REJECT_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_REJECT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_timesheet_ids is null or coalesce(cardinality(p_timesheet_ids), 0) = 0 then
    raise exception 'TIMESHEET_REJECT_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  if exists (
    select 1
    from unnest(p_timesheet_ids) as x(id)
    where x.id is null
  ) then
    raise exception 'TIMESHEET_REJECT_INVALID'
      using errcode = '22023',
            hint = 'Timesheet ids must not contain null.';
  end if;

  -- Normalize duplicates; keep deterministic order for lock acquisition.
  select array_agg(distinct x.id order by x.id)
  into v_ids
  from unnest(p_timesheet_ids) as x(id);

  v_requested := coalesce(cardinality(v_ids), 0);
  if v_requested = 0 then
    raise exception 'TIMESHEET_REJECT_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  -- Lock every requested row that belongs to this company (ordered to reduce deadlocks).
  perform 1
  from (
    select t.id
    from public.timesheets t
    where t.company_id = p_company_id
      and t.id = any (v_ids)
    order by t.id
    for update
  ) as locked;

  select count(*)::integer
  into v_locked
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids);

  if v_locked is distinct from v_requested then
    raise exception 'TIMESHEET_REJECT_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'One or more Timesheets were not found for this company.';
  end if;

  select count(*)::integer
  into v_invalid
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and (
      t.deleted_at is not null
      or t.cleaned_at is not null
      or t.status is distinct from 'Submitted'
    );

  if v_invalid > 0 then
    raise exception 'TIMESHEET_REJECT_INVALID_STATE'
      using errcode = 'P0001',
            hint = 'Every selected Timesheet must be Current, not deleted, and Submitted.';
  end if;

  return query
  update public.timesheets t
  set
    status = 'Rejected',
    rejected_at = v_rejected_at,
    updated_at = v_rejected_at
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and t.deleted_at is null
    and t.cleaned_at is null
    and t.status = 'Submitted'
  returning t.id, t.status, t.rejected_at, t.updated_at;

  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_requested then
    raise exception 'TIMESHEET_REJECT_PARTIAL'
      using errcode = 'P0001',
            hint = 'Reject aborted: not every requested Timesheet could be rejected.';
  end if;
end;
$$;

comment on function public.drevora_reject_timesheets(uuid, uuid[]) is
  'Office-only atomic Reject: sets status=Rejected, rejected_at and updated_at for company Current Submitted Timesheets. Fails entirely if any requested id is missing, cross-company, deleted, cleaned, or not Submitted. Does not touch entries, week_start, submitted_at, cleaned_at, deleted_at, retention or approved_at.';

revoke all on function public.drevora_reject_timesheets(uuid, uuid[]) from public;
revoke all on function public.drevora_reject_timesheets(uuid, uuid[]) from anon;
grant execute on function public.drevora_reject_timesheets(uuid, uuid[]) to authenticated;

commit;

-- =============================================================================
-- 4) Post-apply diagnostics (commented — read-only; run AFTER COMMIT)
-- =============================================================================
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
--        pg_get_userbyid(p.proowner) as owner,
--        p.prosecdef as security_definer,
--        coalesce(pg_catalog.array_to_string(p.proconfig, ', '), '') as config
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and p.proname in (
--     'drevora_clean_timesheets_current_view',
--     'drevora_approve_timesheets',
--     'drevora_reject_timesheets'
--   )
-- order by p.proname;
-- -- Expected: security_definer = true, config includes search_path=
--
-- select
--   has_function_privilege('public', 'public.drevora_clean_timesheets_current_view(uuid, date, date)', 'EXECUTE') as clean_public,
--   has_function_privilege('anon', 'public.drevora_clean_timesheets_current_view(uuid, date, date)', 'EXECUTE') as clean_anon,
--   has_function_privilege('authenticated', 'public.drevora_clean_timesheets_current_view(uuid, date, date)', 'EXECUTE') as clean_auth,
--   has_function_privilege('public', 'public.drevora_approve_timesheets(uuid, uuid[])', 'EXECUTE') as approve_public,
--   has_function_privilege('anon', 'public.drevora_approve_timesheets(uuid, uuid[])', 'EXECUTE') as approve_anon,
--   has_function_privilege('authenticated', 'public.drevora_approve_timesheets(uuid, uuid[])', 'EXECUTE') as approve_auth,
--   has_function_privilege('public', 'public.drevora_reject_timesheets(uuid, uuid[])', 'EXECUTE') as reject_public,
--   has_function_privilege('anon', 'public.drevora_reject_timesheets(uuid, uuid[])', 'EXECUTE') as reject_anon,
--   has_function_privilege('authenticated', 'public.drevora_reject_timesheets(uuid, uuid[])', 'EXECUTE') as reject_auth;
-- -- Expected: public/anon = false; authenticated = true for all three
--
-- select polname, cmd,
--        pg_get_expr(polwithcheck, polrelid) as with_check_expr
-- from pg_policy
-- where polrelid = 'public.timesheets'::regclass
--   and polname = 'timesheets_office_update';
-- -- Expected: WITH CHECK still includes drevora_driver_in_company / vehicle helper
--
-- select
--   has_table_privilege('authenticated', 'public.timesheets', 'UPDATE') as auth_update,
--   has_table_privilege('anon', 'public.timesheets', 'UPDATE') as anon_update;
--
-- select company_id, status,
--        count(*) filter (where deleted_at is null and cleaned_at is null) as current_count,
--        count(*) filter (where deleted_at is null and cleaned_at is not null) as history_count
-- from public.timesheets
-- group by company_id, status
-- order by company_id, status;
--
-- -- Before/after approve: status/approved_at/updated_at change;
-- -- Before/after reject: status/rejected_at/updated_at change;
-- -- submitted_at, week_start, cleaned_at, deleted_at, retention_expires_at unchanged.
--
-- -- Behavioural (JWT):
-- -- Same-company Office approve/reject RPC → all requested ids returned
-- -- Worker-only / cross-company → TIMESHEET_*_FORBIDDEN
-- -- Mixed invalid selection → TIMESHEET_*_INVALID_STATE; zero rows changed
-- -- Direct PATCH status=Approved/Rejected on orphan-FK row → still 42501
