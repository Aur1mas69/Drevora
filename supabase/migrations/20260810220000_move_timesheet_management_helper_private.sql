-- Security Advisor hardening — Batch 5B (single Timesheet-management helper
-- + its 2 known trigger callers' schema-prefix fix).
--
-- Target (1 helper):
--   public.drevora_company_workers_manage_timesheets(uuid)
--     -> drevora_private.drevora_company_workers_manage_timesheets(uuid)
--
-- Only caller bodies updated (same-signature CREATE OR REPLACE, schema
-- prefix on the single existing call to the moved helper only):
--   public.drevora_enforce_timesheet_worker_write()
--   public.drevora_enforce_timesheet_entry_worker_write()
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--   (1 of the current 33 warnings -> expected 33 -> 32 after apply)
--
-- BACKGROUND
--   Canonical helper + both trigger bodies:
--     20260804180000_timesheet_management_scope_worker_writes.sql
--   Helper: SQL, stable, SECURITY DEFINER, search_path = public, body reads
--   only public.companies — self-contained, no sibling-function calls of its
--   own. Never superseded since. Confirmed live: OID 20086, SECURITY
--   DEFINER, search_path=public, authenticated EXECUTE=true, anon
--   EXECUTE=false.
--
--   Exactly 7 unique RLS policies depend on this helper by OID (confirmed
--   live: 10 raw pg_depend rows, because the 3 UPDATE policies below record
--   the dependency twice — once for USING, once for WITH CHECK):
--     driver_timesheet_settings_worker_delete_own   (DELETE, USING only)
--     driver_timesheet_settings_worker_insert_own   (INSERT, WITH CHECK only)
--     driver_timesheet_settings_worker_update_own   (UPDATE, USING + WITH CHECK)
--     timesheet_entries_worker_insert_own           (INSERT, WITH CHECK only)
--     timesheet_entries_worker_update_own           (UPDATE, USING + WITH CHECK)
--     timesheets_worker_insert_own                  (INSERT, WITH CHECK only)
--     timesheets_worker_update_own                  (UPDATE, USING + WITH CHECK)
--   This migration counts DISTINCT policy OIDs/names (not raw pg_depend
--   rows) so the 3 double-counted UPDATE policies are never mistaken for 10
--   distinct dependents.
--
-- WHY THIS IS A PURE SET SCHEMA MOVE FOR THE HELPER
--   Body is self-contained (public.companies only, no sibling-function
--   call). ALTER FUNCTION ... SET SCHEMA updates pg_proc.pronamespace in
--   place — same OID, owner, SECURITY DEFINER flag, volatility, return
--   type, body, and ACL are all preserved. No CREATE OR REPLACE, no DROP,
--   for the helper itself.
--
--   RLS policy expressions bind to the callee by function OID (pg_policy.
--   polqual / polwithcheck store FuncExpr nodes referencing funcid, with a
--   pg_depend row recording the dependency) — not by a stored
--   `public.fn(...)` text reference. Because SET SCHEMA preserves the OID,
--   all 7 policies above continue to resolve to the same function object
--   with zero policy changes required. pg_get_expr()/pg_policies will
--   simply re-deparse the call under the new drevora_private.* schema name
--   after the move.
--
-- WHY THE 2 TRIGGER FUNCTIONS NEED A BODY EDIT (unlike RLS policies)
--   A LANGUAGE plpgsql function body is opaque text (pg_proc.prosrc),
--   name-resolved fresh at each execution — no pg_depend protection exists
--   for a literal `public.<fn>(...)` call inside another function's body.
--   Both trigger functions call `public.drevora_company_workers_manage_
--   timesheets(...)` exactly once each; once the helper moves out of
--   `public`, that literal reference would fail (function does not exist)
--   at first invocation. This migration therefore uses CREATE OR REPLACE
--   FUNCTION for both, changing ONLY the schema prefix on that one call
--   site per function. Same-signature CREATE OR REPLACE preserves the
--   function's OID and existing ACL, so trigger attachments and privileges
--   are untouched. NO other authorization condition, SQL logic, return
--   behavior, volatility, SECURITY INVOKER status, signature, or
--   search_path is changed in either trigger function.
--
-- PRIVATE SCHEMA
--   drevora_private already exists (created by
--   20260808230000_move_support_storage_helpers_private.sql, Batch 3A) with
--   authenticated USAGE / no CREATE for any application role. Reused
--   unchanged here; this migration only adds the helper's own EXECUTE grant.
--
-- POLICIES
--   The 7 policies listed above are NOT dropped, recreated, or altered by
--   this migration. Their pg_depend rows remain bound to the same (moved)
--   function OID.
--
-- SCOPE
--   Touches ONLY: the 1 helper's schema/search_path/privileges, and the
--   1 call-site schema prefix inside each of the 2 named trigger functions.
--   Does NOT touch any other SECURITY DEFINER function, table, RLS/Storage
--   policy, or the other 32 remaining Advisor warnings.
--
-- Wrapped in one explicit transaction. Fails closed: any assertion failure
-- raises an exception and rolls back the entire transaction, leaving the
-- helper in `public` and both trigger bodies untouched. Does NOT apply
-- itself — run manually after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions + capture pre-move state for the helper and both trigger
--    functions (OID + identity attributes, for post-change equality proof).
-- -----------------------------------------------------------------------------
create temporary table drevora_batch5b_captured_oids (
  fn_name text primary key,
  oid_before oid not null,
  prorettype_before oid not null,
  prolang_before oid not null,
  provolatile_before "char" not null,
  prosecdef_before boolean not null
) on commit drop;

do $$
declare
  v_helper_oid oid;
  v_trigger1_oid oid;
  v_trigger2_oid oid;
  v_raw_dep_count integer;
  v_distinct_policy_count integer;
  v_policy_names text[];
  v_expected_names constant text[] := array[
    'driver_timesheet_settings_worker_delete_own',
    'driver_timesheet_settings_worker_insert_own',
    'driver_timesheet_settings_worker_update_own',
    'timesheet_entries_worker_insert_own',
    'timesheet_entries_worker_update_own',
    'timesheets_worker_insert_own',
    'timesheets_worker_update_own'
  ];
begin
  if to_regnamespace('drevora_private') is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: schema drevora_private is missing — apply 20260808230000_move_support_storage_helpers_private.sql (Batch 3A) first';
  end if;

  v_helper_oid := to_regprocedure('public.drevora_company_workers_manage_timesheets(uuid)');
  v_trigger1_oid := to_regprocedure('public.drevora_enforce_timesheet_worker_write()');
  v_trigger2_oid := to_regprocedure('public.drevora_enforce_timesheet_entry_worker_write()');

  if v_helper_oid is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: public.drevora_company_workers_manage_timesheets(uuid) missing';
  end if;
  if v_trigger1_oid is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: public.drevora_enforce_timesheet_worker_write() missing';
  end if;
  if v_trigger2_oid is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: public.drevora_enforce_timesheet_entry_worker_write() missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname = 'drevora_enforce_timesheet_worker_write'
      and n.nspname = 'public'
      and c.relname = 'timesheets'
      and t.tgfoid = v_trigger1_oid
  ) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: expected trigger drevora_enforce_timesheet_worker_write on public.timesheets bound to the captured function OID';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname = 'drevora_enforce_timesheet_entry_worker_write'
      and n.nspname = 'public'
      and c.relname = 'timesheet_entries'
      and t.tgfoid = v_trigger2_oid
  ) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: expected trigger drevora_enforce_timesheet_entry_worker_write on public.timesheet_entries bound to the captured function OID';
  end if;

  -- Exactly 7 DISTINCT policies must depend on the helper (10 raw pg_depend
  -- rows expected: 3 UPDATE policies each record USING + WITH CHECK, 4
  -- single-clause policies record one row each).
  select count(*) into v_raw_dep_count
  from pg_depend d
  join pg_policy pol on pol.oid = d.objid
  where d.classid = 'pg_policy'::regclass
    and d.refclassid = 'pg_proc'::regclass
    and d.refobjid = v_helper_oid;

  select count(distinct pol.oid), array_agg(distinct pol.polname order by pol.polname)
    into v_distinct_policy_count, v_policy_names
  from pg_depend d
  join pg_policy pol on pol.oid = d.objid
  where d.classid = 'pg_policy'::regclass
    and d.refclassid = 'pg_proc'::regclass
    and d.refobjid = v_helper_oid;

  if v_raw_dep_count <> 10 then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: expected 10 raw pg_depend rows on the helper (3 UPDATE policies x USING+WITH CHECK + 4 single-clause policies), found %',
      v_raw_dep_count;
  end if;

  if v_distinct_policy_count <> 7 then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: expected exactly 7 DISTINCT dependent policies, found %',
      v_distinct_policy_count;
  end if;

  if v_policy_names is distinct from v_expected_names then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_PRECONDITION: dependent policy set does not match the expected 7 (got: %)',
      v_policy_names;
  end if;

  insert into drevora_batch5b_captured_oids (
    fn_name, oid_before, prorettype_before, prolang_before, provolatile_before, prosecdef_before
  )
  select
    'drevora_company_workers_manage_timesheets', p.oid, p.prorettype, p.prolang, p.provolatile, p.prosecdef
  from pg_proc p where p.oid = v_helper_oid;

  insert into drevora_batch5b_captured_oids (
    fn_name, oid_before, prorettype_before, prolang_before, provolatile_before, prosecdef_before
  )
  select
    'drevora_enforce_timesheet_worker_write', p.oid, p.prorettype, p.prolang, p.provolatile, p.prosecdef
  from pg_proc p where p.oid = v_trigger1_oid;

  insert into drevora_batch5b_captured_oids (
    fn_name, oid_before, prorettype_before, prolang_before, provolatile_before, prosecdef_before
  )
  select
    'drevora_enforce_timesheet_entry_worker_write', p.oid, p.prorettype, p.prolang, p.provolatile, p.prosecdef
  from pg_proc p where p.oid = v_trigger2_oid;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Move the helper — pure ALTER FUNCTION SET SCHEMA, no body change.
-- -----------------------------------------------------------------------------
alter function public.drevora_company_workers_manage_timesheets(uuid)
  set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 2) Harden search_path + privileges (helper only).
-- -----------------------------------------------------------------------------
alter function drevora_private.drevora_company_workers_manage_timesheets(uuid)
  set search_path = '';

revoke all on function drevora_private.drevora_company_workers_manage_timesheets(uuid) from public;
revoke all on function drevora_private.drevora_company_workers_manage_timesheets(uuid) from anon;
grant execute on function drevora_private.drevora_company_workers_manage_timesheets(uuid) to authenticated;

comment on function drevora_private.drevora_company_workers_manage_timesheets(uuid) is
  'True when company timesheet_management_scope is worker (Workers manage their own Timesheets). Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-10 Batch 5B) — same OID, body untouched, search_path hardened to ''''. EXECUTE: authenticated only. Referenced by 7 RLS policies bound by OID (unaffected by this move) and by drevora_enforce_timesheet_worker_write / drevora_enforce_timesheet_entry_worker_write (call-site schema prefix rewritten in this same migration).';

-- -----------------------------------------------------------------------------
-- 3) Rewrite ONLY the two trigger callers — schema prefix on the single call
--    site each makes to the moved helper. Signature / SECURITY INVOKER /
--    search_path = public / all authorization + business logic otherwise
--    byte-for-byte unchanged from 20260804180000_timesheet_management_scope_
--    worker_writes.sql. Same-signature CREATE OR REPLACE preserves the
--    function OID (trigger attachments stay bound).
-- -----------------------------------------------------------------------------
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

  if not drevora_private.drevora_company_workers_manage_timesheets(v_company_id) then
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

  if not drevora_private.drevora_company_workers_manage_timesheets(v_company_id) then
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

-- -----------------------------------------------------------------------------
-- 4) In-transaction assertions. Any failure rolls back the entire migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_helper_before oid;
  v_trigger1_before oid;
  v_trigger2_before oid;
  v_helper_rettype oid;
  v_helper_after oid;
  v_trigger1_after oid;
  v_trigger2_after oid;
  v_search_path text;
  v_src text;
  v_sql_lang oid := (select oid from pg_language where lanname = 'sql');
  v_plpgsql_lang oid := (select oid from pg_language where lanname = 'plpgsql');
  v_raw_dep_count integer;
  v_distinct_policy_count integer;
  v_policy_names text[];
  v_expected_names constant text[] := array[
    'driver_timesheet_settings_worker_delete_own',
    'driver_timesheet_settings_worker_insert_own',
    'driver_timesheet_settings_worker_update_own',
    'timesheet_entries_worker_insert_own',
    'timesheet_entries_worker_update_own',
    'timesheets_worker_insert_own',
    'timesheets_worker_update_own'
  ];
begin
  select oid_before, prorettype_before
    into v_helper_before, v_helper_rettype
  from drevora_batch5b_captured_oids
  where fn_name = 'drevora_company_workers_manage_timesheets';

  select oid_before into v_trigger1_before
  from drevora_batch5b_captured_oids
  where fn_name = 'drevora_enforce_timesheet_worker_write';

  select oid_before into v_trigger2_before
  from drevora_batch5b_captured_oids
  where fn_name = 'drevora_enforce_timesheet_entry_worker_write';

  -- ---------------------------------------------------------------------
  -- Helper: public version gone, private version exists, OID unchanged.
  -- ---------------------------------------------------------------------
  if to_regprocedure('public.drevora_company_workers_manage_timesheets(uuid)') is not null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: public.drevora_company_workers_manage_timesheets(uuid) still resolves';
  end if;

  v_helper_after := to_regprocedure('drevora_private.drevora_company_workers_manage_timesheets(uuid)');
  if v_helper_after is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_private.drevora_company_workers_manage_timesheets(uuid) does not resolve';
  end if;

  if v_helper_after is distinct from v_helper_before then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: helper OID changed (before=%, after=%) — object was not preserved',
      v_helper_before, v_helper_after;
  end if;

  -- SECURITY DEFINER / volatility / language / return type retained.
  if not exists (
    select 1 from pg_proc
    where oid = v_helper_after
      and prosecdef
      and provolatile = 's'
      and prolang = v_sql_lang
      and prorettype = v_helper_rettype
      and prorettype = 'boolean'::regtype
  ) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: helper SECURITY DEFINER/volatility/language/return type changed unexpectedly';
  end if;

  -- search_path hardened to empty string.
  select cfg into v_search_path
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_helper_after
    and cfg like 'search_path=%';
  if v_search_path is distinct from 'search_path=""' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: helper search_path not pinned to empty string (got %)',
      v_search_path;
  end if;

  -- Privileges: authenticated only.
  if has_function_privilege('public', v_helper_after, 'EXECUTE') then
    raise exception 'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: PUBLIC still has EXECUTE on the helper';
  end if;
  if has_function_privilege('anon', v_helper_after, 'EXECUTE') then
    raise exception 'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: anon still has EXECUTE on the helper';
  end if;
  if not has_function_privilege('authenticated', v_helper_after, 'EXECUTE') then
    raise exception 'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: authenticated is missing EXECUTE on the helper';
  end if;

  -- Exactly 7 DISTINCT policy dependencies remain (10 raw rows), bound to
  -- the SAME (preserved) helper OID.
  select count(*) into v_raw_dep_count
  from pg_depend d
  join pg_policy pol on pol.oid = d.objid
  where d.classid = 'pg_policy'::regclass
    and d.refclassid = 'pg_proc'::regclass
    and d.refobjid = v_helper_after;

  select count(distinct pol.oid), array_agg(distinct pol.polname order by pol.polname)
    into v_distinct_policy_count, v_policy_names
  from pg_depend d
  join pg_policy pol on pol.oid = d.objid
  where d.classid = 'pg_policy'::regclass
    and d.refclassid = 'pg_proc'::regclass
    and d.refobjid = v_helper_after;

  if v_raw_dep_count <> 10 then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: expected 10 raw pg_depend rows on the moved helper, found %',
      v_raw_dep_count;
  end if;

  if v_distinct_policy_count <> 7 then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: expected exactly 7 DISTINCT dependent policies post-move, found %',
      v_distinct_policy_count;
  end if;

  if v_policy_names is distinct from v_expected_names then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: dependent policy set changed post-move (got: %)',
      v_policy_names;
  end if;

  -- ---------------------------------------------------------------------
  -- Trigger functions: same OIDs before/after CREATE OR REPLACE, trigger
  -- attachments unchanged, still SECURITY INVOKER / plpgsql / trigger /
  -- search_path = public.
  -- ---------------------------------------------------------------------
  v_trigger1_after := to_regprocedure('public.drevora_enforce_timesheet_worker_write()');
  v_trigger2_after := to_regprocedure('public.drevora_enforce_timesheet_entry_worker_write()');

  if v_trigger1_after is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: public.drevora_enforce_timesheet_worker_write() missing after replace';
  end if;
  if v_trigger2_after is null then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: public.drevora_enforce_timesheet_entry_worker_write() missing after replace';
  end if;

  if v_trigger1_after is distinct from v_trigger1_before then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_worker_write OID changed (before=%, after=%) — same-signature REPLACE did not preserve object',
      v_trigger1_before, v_trigger1_after;
  end if;
  if v_trigger2_after is distinct from v_trigger2_before then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_entry_worker_write OID changed (before=%, after=%) — same-signature REPLACE did not preserve object',
      v_trigger2_before, v_trigger2_after;
  end if;

  if exists (select 1 from pg_proc where oid in (v_trigger1_after, v_trigger2_after) and prosecdef) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: a trigger function unexpectedly became SECURITY DEFINER';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = v_trigger1_after and prolang = v_plpgsql_lang and prorettype = 'trigger'::regtype
  ) or not exists (
    select 1 from pg_proc
    where oid = v_trigger2_after and prolang = v_plpgsql_lang and prorettype = 'trigger'::regtype
  ) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: a trigger function language/return type changed unexpectedly';
  end if;

  for v_search_path in
    select cfg
    from (values (v_trigger1_after), (v_trigger2_after)) as t(oid)
    cross join lateral (
      select cfg
      from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = t.oid
        and cfg like 'search_path=%'
    ) s
  loop
    if v_search_path is distinct from 'search_path=public' then
      raise exception
        'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: a trigger function search_path changed (got %)',
        v_search_path;
    end if;
  end loop;

  -- Trigger attachments unchanged (same name, table, function OID).
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname = 'drevora_enforce_timesheet_worker_write'
      and n.nspname = 'public'
      and c.relname = 'timesheets'
      and t.tgfoid = v_trigger1_after
  ) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: timesheets trigger attachment missing or unbound from preserved function OID';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and t.tgname = 'drevora_enforce_timesheet_entry_worker_write'
      and n.nspname = 'public'
      and c.relname = 'timesheet_entries'
      and t.tgfoid = v_trigger2_after
  ) then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: timesheet_entries trigger attachment missing or unbound from preserved function OID';
  end if;

  -- Required drevora_private reference exists; no stale public reference remains.
  select prosrc into v_src from pg_proc where oid = v_trigger1_after;
  if v_src not like '%drevora_private.drevora_company_workers_manage_timesheets%' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_worker_write missing required drevora_private.drevora_company_workers_manage_timesheets reference';
  end if;
  if v_src like '%public.drevora_company_workers_manage_timesheets%' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_worker_write still contains a stale public.drevora_company_workers_manage_timesheets reference';
  end if;
  if v_src not like '%public.drevora_is_trusted_tenant_writer%'
     or v_src not like '%public.drevora_auth_user_has_office_role_for_company%'
     or v_src not like '%public.drevora_auth_user_driver_id%' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_worker_write unrelated public.* helper references were unexpectedly altered';
  end if;

  select prosrc into v_src from pg_proc where oid = v_trigger2_after;
  if v_src not like '%drevora_private.drevora_company_workers_manage_timesheets%' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_entry_worker_write missing required drevora_private.drevora_company_workers_manage_timesheets reference';
  end if;
  if v_src like '%public.drevora_company_workers_manage_timesheets%' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_entry_worker_write still contains a stale public.drevora_company_workers_manage_timesheets reference';
  end if;
  if v_src not like '%public.drevora_is_trusted_tenant_writer%'
     or v_src not like '%public.drevora_auth_user_has_office_role_for_company%'
     or v_src not like '%public.drevora_auth_user_driver_id%'
     or v_src not like '%public.timesheets%' then
    raise exception
      'MOVE_TIMESHEET_MANAGEMENT_HELPER_ASSERT: drevora_enforce_timesheet_entry_worker_write unrelated public.* references were unexpectedly altered';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
