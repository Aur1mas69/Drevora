-- Security Advisor hardening — Batch 4A (deprecated company-context stub
-- helpers, no live caller).
--
-- Targets (3):
--   public.drevora_current_company_id()
--   public.drevora_current_company_name()
--   public.drevora_company_text_matches_current(text)
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--   (3 of the current 39 warnings)
--
-- BACKGROUND
--   These 3 were neutralized to safe no-op stubs by
--   20260715210000_enable_full_tenant_rls.sql ("Neutralize unsafe
--   oldest-company / company-text helpers used by legacy policies"):
--     drevora_current_company_id()             -> always returns null::uuid
--     drevora_current_company_name()           -> always returns null::text
--     drevora_company_text_matches_current(text) -> always returns false
--   They exist only so that any leftover policy still referencing them by
--   OID fails closed (denies) rather than erroring. Repository review
--   (Batch 4 preflight, 2026-08-08) found zero references to any of the 3
--   in current-chronology function/trigger bodies, and a live database
--   check (operator-confirmed) found zero pg_policy dependencies on any of
--   the 3 function OIDs. No frontend `.rpc()` or Edge Function caller
--   exists for any of the 3.
--
-- WHY THIS IS A PURE SET SCHEMA MOVE
--   None of the 3 calls another function in this set, or any other
--   drevora_* helper (each body is a single literal SELECT with no table
--   or function reference). Zero policy dependents means there is nothing
--   left that could observe the schema move. This is the simplest possible
--   Batch in this hardening project.
--
-- search_path
--   All 3 already have `search_path = ''` (hardened by
--   20260802160000_restrict_internal_auth_company_helper_execute.sql).
--   Preserved unchanged.
--
-- POLICIES
--   Confirmed live: zero pg_policy rows depend on any of these 3 function
--   OIDs. This migration does not touch any RLS policy, and re-asserts the
--   zero-dependency invariant before COMMIT (belt-and-suspenders, in case
--   of drift between the preflight check and apply time).
--
-- SCOPE
--   Touches ONLY these 3 functions' schema/privileges. Does NOT touch any
--   other SECURITY DEFINER function, table, trigger, or RLS/Storage policy.
--
-- Wrapped in one explicit transaction. Fails closed: any assertion failure
-- raises an exception and rolls back the entire transaction, leaving all 3
-- functions in `public` untouched. Does NOT apply itself — run manually
-- after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions + capture pre-move OIDs for all 3.
-- -----------------------------------------------------------------------------
create temporary table drevora_batch4a_captured_oids (
  fn_name text primary key,
  oid_before oid not null
) on commit drop;

do $$
declare
  v_current_company_id_oid oid;
  v_current_company_name_oid oid;
  v_company_text_matches_current_oid oid;
begin
  v_current_company_id_oid := to_regprocedure('public.drevora_current_company_id()');
  v_current_company_name_oid := to_regprocedure('public.drevora_current_company_name()');
  v_company_text_matches_current_oid := to_regprocedure('public.drevora_company_text_matches_current(text)');

  if v_current_company_id_oid is null then
    raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_PRECONDITION: public.drevora_current_company_id() missing';
  end if;
  if v_current_company_name_oid is null then
    raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_PRECONDITION: public.drevora_current_company_name() missing';
  end if;
  if v_company_text_matches_current_oid is null then
    raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_PRECONDITION: public.drevora_company_text_matches_current(text) missing';
  end if;

  -- Belt-and-suspenders: re-confirm the operator-provided live check
  -- (zero pg_policy dependencies) before making any change.
  if exists (
    select 1 from pg_depend d
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid in (
        v_current_company_id_oid,
        v_current_company_name_oid,
        v_company_text_matches_current_oid
      )
  ) then
    raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_PRECONDITION: at least one of the 3 functions unexpectedly has a live pg_policy dependency';
  end if;

  insert into drevora_batch4a_captured_oids (fn_name, oid_before)
  values
    ('drevora_current_company_id', v_current_company_id_oid),
    ('drevora_current_company_name', v_current_company_name_oid),
    ('drevora_company_text_matches_current', v_company_text_matches_current_oid);
end $$;

-- -----------------------------------------------------------------------------
-- 1) Move all 3 — pure ALTER FUNCTION SET SCHEMA, no body change.
-- -----------------------------------------------------------------------------
alter function public.drevora_current_company_id() set schema drevora_private;
alter function public.drevora_current_company_name() set schema drevora_private;
alter function public.drevora_company_text_matches_current(text) set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 2) Reaffirm function privileges post-move (defense-in-depth; SET SCHEMA
--    preserves the pre-existing ACL unchanged). No service_role grant is
--    added or removed here — these already carry service_role EXECUTE from
--    20260802160000 and that grant is intentionally left as-is.
-- -----------------------------------------------------------------------------
revoke all on function drevora_private.drevora_current_company_id() from public;
revoke all on function drevora_private.drevora_current_company_id() from anon;
grant execute on function drevora_private.drevora_current_company_id() to authenticated;

revoke all on function drevora_private.drevora_current_company_name() from public;
revoke all on function drevora_private.drevora_current_company_name() from anon;
grant execute on function drevora_private.drevora_current_company_name() to authenticated;

revoke all on function drevora_private.drevora_company_text_matches_current(text) from public;
revoke all on function drevora_private.drevora_company_text_matches_current(text) from anon;
grant execute on function drevora_private.drevora_company_text_matches_current(text) to authenticated;

comment on function drevora_private.drevora_current_company_id() is
  'DEPRECATED no-op stub (always returns null::uuid). Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 4A) — same OID, body untouched, search_path already '''' (unchanged). EXECUTE: authenticated only. Confirmed live: zero pg_policy dependents. Retained only so any leftover reference fails closed.';

comment on function drevora_private.drevora_current_company_name() is
  'DEPRECATED no-op stub (always returns null::text). Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 4A) — same OID, body untouched, search_path already '''' (unchanged). EXECUTE: authenticated only. Confirmed live: zero pg_policy dependents. Retained only so any leftover reference fails closed.';

comment on function drevora_private.drevora_company_text_matches_current(text) is
  'DEPRECATED no-op stub (always returns false). Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 4A) — same OID, body untouched, search_path already '''' (unchanged). EXECUTE: authenticated only. Confirmed live: zero pg_policy dependents. Retained only so any leftover reference fails closed.';

-- -----------------------------------------------------------------------------
-- 3) In-transaction assertions. Any failure rolls back the entire migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_sql_lang oid := (select oid from pg_language where lanname = 'sql');
  r record;
begin
  for r in
    select *
    from (
      values
        ('drevora_current_company_id', '()', 'uuid'::regtype),
        ('drevora_current_company_name', '()', 'text'::regtype),
        ('drevora_company_text_matches_current', '(text)', 'boolean'::regtype)
    ) as t(fn_name, fn_args, expected_rettype)
  loop
    declare
      v_oid_before oid;
      v_oid_after oid;
      v_search_path text;
    begin
      select oid_before into v_oid_before
      from drevora_batch4a_captured_oids
      where fn_name = r.fn_name;

      if to_regprocedure(format('public.%I%s', r.fn_name, r.fn_args)) is not null then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: public.% still resolves', r.fn_name;
      end if;

      v_oid_after := to_regprocedure(format('drevora_private.%I%s', r.fn_name, r.fn_args));
      if v_oid_after is null then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: drevora_private.% does not resolve', r.fn_name;
      end if;

      if v_oid_after is distinct from v_oid_before then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: % OID changed (before=%, after=%)', r.fn_name, v_oid_before, v_oid_after;
      end if;

      if not exists (select 1 from pg_proc where oid = v_oid_after and prosecdef) then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: % is not SECURITY DEFINER after move', r.fn_name;
      end if;

      if not exists (
        select 1 from pg_proc
        where oid = v_oid_after
          and prolang = v_sql_lang
          and provolatile = 's'
          and prorettype = r.expected_rettype
      ) then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: % language/volatility/return type changed unexpectedly', r.fn_name;
      end if;

      select cfg into v_search_path
      from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = v_oid_after
        and cfg like 'search_path=%';

      if v_search_path is distinct from 'search_path=""' then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: % search_path not pinned to empty string (got %)', r.fn_name, v_search_path;
      end if;

      if has_function_privilege('public', v_oid_after, 'EXECUTE') then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: PUBLIC still has EXECUTE on %', r.fn_name;
      end if;
      if has_function_privilege('anon', v_oid_after, 'EXECUTE') then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: anon still has EXECUTE on %', r.fn_name;
      end if;
      if not has_function_privilege('authenticated', v_oid_after, 'EXECUTE') then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: authenticated is missing EXECUTE on %', r.fn_name;
      end if;

      if exists (
        select 1 from pg_depend d
        where d.classid = 'pg_policy'::regclass
          and d.refclassid = 'pg_proc'::regclass
          and d.refobjid = v_oid_after
      ) then
        raise exception 'MOVE_DEPRECATED_COMPANY_HELPERS_ASSERT: % unexpectedly has a pg_policy dependency after move', r.fn_name;
      end if;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
