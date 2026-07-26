-- =============================================================================
-- DREVORA — Timesheets Clean Current View: Approved-only + repair
-- File: supabase/migrations/20260726250000_timesheets_clean_only_approved.sql
-- =============================================================================
-- Purpose:
--   1) Restore accidentally cleaned non-Approved Timesheets to Current
--      (Draft / Submitted / Rejected with cleaned_at set).
--   2) Replace only drevora_clean_timesheets_current_view so future Clean
--      moves Approved Timesheets only.
--
-- Product rule:
--   Draft / Submitted / Rejected stay in Current.
--   Approved may move to History via Clean (archive/view lifecycle, not delete).
--   Clean never changes status or retention_expires_at.
--
-- Does NOT edit migration 20260726240000.
-- Does NOT replace Approve or Reject RPCs.
-- Does NOT change Timesheets RLS policies or table grants.
-- Does NOT apply itself — run manually in the Supabase SQL editor after review.
-- Idempotent. Preserves all rows, IDs, entries, totals, approvals, retention.
-- =============================================================================

begin;

-- =============================================================================
-- 0) Preflight diagnostics (commented — read-only)
-- =============================================================================
-- select status,
--        count(*) filter (
--          where deleted_at is null and cleaned_at is not null
--        ) as cleaned_current_lifecycle,
--        count(*) filter (
--          where deleted_at is null
--            and cleaned_at is not null
--            and status is distinct from 'Approved'
--        ) as incorrectly_cleaned_non_approved
-- from public.timesheets
-- group by status
-- order by status;
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--        p.prosecdef as security_definer
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and p.proname in (
--     'drevora_clean_timesheets_current_view',
--     'drevora_approve_timesheets',
--     'drevora_reject_timesheets'
--   )
-- order by p.proname;

-- =============================================================================
-- 1) Repair: restore incorrectly cleaned non-Approved Timesheets to Current
-- =============================================================================
-- Global lifecycle invariant correction (all tenants). Does not expose rows
-- to clients; only clears cleaned_at (+ updated_at) for eligible parents.
update public.timesheets t
set
  cleaned_at = null,
  updated_at = transaction_timestamp()
where t.deleted_at is null
  and t.cleaned_at is not null
  and t.status is distinct from 'Approved';

-- =============================================================================
-- 2) Replace Clean Current View RPC — Approved only
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
    and t.status = 'Approved'
    and (p_week_start_from is null or t.week_start >= p_week_start_from)
    and (p_week_start_to is null or t.week_start <= p_week_start_to)
  returning t.id, t.cleaned_at;
end;
$$;

comment on function public.drevora_clean_timesheets_current_view(uuid, date, date) is
  'Office-only soft-clean Current view: sets cleaned_at and updated_at on company Approved Timesheets matching optional week_start From/To. Draft/Submitted/Rejected stay in Current. Does not delete rows, touch entries, or alter status/approvals/retention.';

revoke all on function public.drevora_clean_timesheets_current_view(uuid, date, date) from public;
revoke all on function public.drevora_clean_timesheets_current_view(uuid, date, date) from anon;
grant execute on function public.drevora_clean_timesheets_current_view(uuid, date, date) to authenticated;

commit;

-- =============================================================================
-- 3) Post-apply diagnostics (commented — read-only; run AFTER COMMIT)
-- =============================================================================
-- select
--   case when cleaned_at is null then 'Current' else 'History' end as view_bucket,
--   status,
--   count(*) filter (where deleted_at is null) as active_count,
--   count(*) filter (where deleted_at is not null) as soft_deleted_count
-- from public.timesheets
-- group by 1, status
-- order by 1, status;
-- -- Expected after repair:
-- --   Current may include Draft/Submitted/Rejected/Approved
-- --   History Active should be Approved only (non-deleted)
-- --   incorrectly_cleaned_non_approved = 0:
-- select count(*) as incorrectly_cleaned_non_approved
-- from public.timesheets
-- where deleted_at is null
--   and cleaned_at is not null
--   and status is distinct from 'Approved';
--
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
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
-- -- Expected: clean still SECURITY DEFINER + search_path=;
-- -- Approve/Reject signatures unchanged from 240000.
--
-- select
--   has_function_privilege('public', 'public.drevora_clean_timesheets_current_view(uuid, date, date)', 'EXECUTE') as clean_public,
--   has_function_privilege('anon', 'public.drevora_clean_timesheets_current_view(uuid, date, date)', 'EXECUTE') as clean_anon,
--   has_function_privilege('authenticated', 'public.drevora_clean_timesheets_current_view(uuid, date, date)', 'EXECUTE') as clean_auth;
-- -- Expected: public/anon = false; authenticated = true
--
-- -- Behavioural:
-- -- Clean with mixed Current → only Approved move to History
-- -- Draft/Submitted/Rejected remain in Current
-- -- Restored Submitted rows can Approve/Reject via existing 240000 RPCs
-- -- Soft-deleted cleaned non-Approved rows keep cleaned_at (untouched)
