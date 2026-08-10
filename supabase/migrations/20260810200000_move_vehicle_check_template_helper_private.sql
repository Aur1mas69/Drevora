-- Security Advisor hardening — Batch 4B (orphaned vehicle-check-template
-- manager helper, no live caller).
--
-- Target (1):
--   public.drevora_auth_user_can_manage_vehicle_check_templates()
--     -> drevora_private.drevora_auth_user_can_manage_vehicle_check_templates()
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--
-- BACKGROUND
--   Canonical definition: 20260709210000_vehicle_check_templates_rls_multi_company.sql
--   (SQL, stable, SECURITY DEFINER, originally search_path = public). Never
--   included in the 20260802160000 14-function harden list, so search_path
--   was still `public` prior to this batch.
--
--   Live callers: operator-confirmed zero pg_policy dependencies on this
--   function OID. Repository review found zero frontend `.rpc()` / Edge
--   Function callers, and zero references from other function/trigger bodies
--   in current chronology. Historical 2026-07-09 vehicle_check_templates
--   policies that named this helper were superseded by later company_id +
--   drevora_auth_user_has_office_role_for_company policies.
--
-- WHY THIS IS A PURE SET SCHEMA MOVE (when still in public)
--   Body is self-contained (public.drivers + auth.users only). Zero live
--   policy dependents means nothing observes the schema move. No CREATE OR
--   REPLACE, no DROP FUNCTION, no policy modification.
--
-- RECONCILABLE / IDEMPOTENT STARTING STATES
--   A. function still exists in public  -> ALTER FUNCTION ... SET SCHEMA
--   B. function already in drevora_private (partial prior apply) -> skip move
--   Exactly one of (A) or (B) must hold; fail if both or neither.
--   Final OID must equal the captured starting OID in either case.
--
-- FINAL STATE (enforced in both paths)
--   schema            = drevora_private
--   search_path       = ''
--   SECURITY DEFINER  = retained
--   authenticated EXECUTE = true
--   PUBLIC EXECUTE    = false
--   anon EXECUTE      = false
--   pg_policy deps    = zero
--
-- SCOPE
--   Touches ONLY this one function's schema/search_path/privileges.
--   Does NOT touch any other SECURITY DEFINER function, table, trigger, or
--   RLS/Storage policy. Does NOT recreate drevora_private (Batch 3A).
--
-- OID capture uses a single DO-block local variable (no temporary table).
-- Wrapped in one explicit transaction. Fails closed on any assertion.
-- Does NOT apply itself — run manually after review.

begin;

do $batch4b$
declare
  v_fn_public  constant text := 'public.drevora_auth_user_can_manage_vehicle_check_templates()';
  v_fn_private constant text := 'drevora_private.drevora_auth_user_can_manage_vehicle_check_templates()';
  v_public_oid oid;
  v_private_oid oid;
  v_oid_before oid;
  v_oid_after oid;
  v_search_path text;
  v_sql_lang oid := (select oid from pg_language where lanname = 'sql');
begin
  -- ---------------------------------------------------------------------------
  -- 0) Preconditions: exactly one of public / drevora_private must exist.
  -- ---------------------------------------------------------------------------
  v_public_oid := to_regprocedure(v_fn_public);
  v_private_oid := to_regprocedure(v_fn_private);

  if v_public_oid is not null and v_private_oid is not null then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_PRECONDITION: function exists in BOTH public (oid=%) and drevora_private (oid=%) — refuse to continue',
      v_public_oid, v_private_oid;
  end if;

  if v_public_oid is null and v_private_oid is null then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_PRECONDITION: function missing from both public and drevora_private';
  end if;

  -- Capture starting OID regardless of which schema it currently lives in.
  v_oid_before := coalesce(v_public_oid, v_private_oid);

  if exists (
    select 1 from pg_depend d
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_oid_before
  ) then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_PRECONDITION: function unexpectedly has a live pg_policy dependency (oid=%)',
      v_oid_before;
  end if;

  -- ---------------------------------------------------------------------------
  -- 1) Move only when still in public. Skip SET SCHEMA if already private.
  -- ---------------------------------------------------------------------------
  if v_public_oid is not null then
    alter function public.drevora_auth_user_can_manage_vehicle_check_templates()
      set schema drevora_private;
  end if;

  -- ---------------------------------------------------------------------------
  -- 2) Enforce final posture (both starting states).
  -- ---------------------------------------------------------------------------
  alter function drevora_private.drevora_auth_user_can_manage_vehicle_check_templates()
    set search_path = '';

  revoke all on function drevora_private.drevora_auth_user_can_manage_vehicle_check_templates() from public;
  revoke all on function drevora_private.drevora_auth_user_can_manage_vehicle_check_templates() from anon;
  grant execute on function drevora_private.drevora_auth_user_can_manage_vehicle_check_templates() to authenticated;

  comment on function drevora_private.drevora_auth_user_can_manage_vehicle_check_templates() is
    'SECURITY DEFINER office/admin template-manager helper (orphaned — zero live pg_policy dependents). Moved from public via ALTER FUNCTION SET SCHEMA when needed (2026-08-10 Batch 4B) — same OID, body untouched. search_path hardened to ''''. EXECUTE: authenticated only.';

  -- ---------------------------------------------------------------------------
  -- 3) In-transaction assertions. Any failure rolls back the whole migration.
  -- ---------------------------------------------------------------------------
  if to_regprocedure(v_fn_public) is not null then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: public.drevora_auth_user_can_manage_vehicle_check_templates() still resolves';
  end if;

  v_oid_after := to_regprocedure(v_fn_private);
  if v_oid_after is null then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: drevora_private.drevora_auth_user_can_manage_vehicle_check_templates() does not resolve';
  end if;

  if v_oid_after is distinct from v_oid_before then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: OID changed (before=%, after=%) — object was not preserved',
      v_oid_before, v_oid_after;
  end if;

  if not exists (select 1 from pg_proc where oid = v_oid_after and prosecdef) then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: function is not SECURITY DEFINER after reconcile';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = v_oid_after
      and prolang = v_sql_lang
      and provolatile = 's'
      and prorettype = 'boolean'::regtype
  ) then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: language/volatility/return type changed unexpectedly';
  end if;

  select cfg into v_search_path
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_oid_after
    and cfg like 'search_path=%';

  if v_search_path is distinct from 'search_path=""' then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: search_path not pinned to empty string (got %)',
      v_search_path;
  end if;

  if has_function_privilege('public', v_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: PUBLIC still has EXECUTE';
  end if;
  if has_function_privilege('anon', v_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: anon still has EXECUTE';
  end if;
  if not has_function_privilege('authenticated', v_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: authenticated is missing EXECUTE';
  end if;

  if exists (
    select 1 from pg_depend d
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_oid_after
  ) then
    raise exception
      'MOVE_VEHICLE_CHECK_TEMPLATE_HELPER_ASSERT: function unexpectedly has a pg_policy dependency after reconcile';
  end if;
end
$batch4b$;

notify pgrst, 'reload schema';

commit;
