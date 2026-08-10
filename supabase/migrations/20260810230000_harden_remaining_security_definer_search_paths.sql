-- Security Advisor hardening — Batch 7 (search_path only).
--
-- Targets (7) — all already confirmed intentional, active, authenticated-
-- executable SECURITY DEFINER browser RPCs (Batch 6B audit). This migration
-- changes NOTHING about their authorization logic, signatures, SECURITY
-- DEFINER status, or EXECUTE privileges. It ONLY tightens:
--   SET search_path = public
-- to:
--   SET search_path = ''
-- via pure ALTER FUNCTION ... SET search_path — no CREATE OR REPLACE, no
-- SET SCHEMA, no body rewrite of any kind.
--
--   1. public.drevora_accept_customer_legal_documents(uuid,boolean,boolean,boolean,boolean,text,text,text,text,text)
--   2. public.drevora_accept_worker_legal_documents(uuid,boolean,boolean,text,text,text,text,text)
--   3. public.drevora_clear_company_driver_timesheet_settings(uuid)
--   4. public.drevora_get_customer_legal_status(uuid)
--   5. public.drevora_get_worker_legal_status(uuid)
--   6. public.drevora_office_apply_tyre_check_correction(uuid,text,text,jsonb)
--   7. public.drevora_office_soft_delete_tyre_check(uuid,text)
--
-- WHY THIS IS SAFE (Batch 7 preflight, 2026-08-10)
--   Every relation, function, sequence, and type referenced in all 7 bodies
--   is already schema-qualified (public.*, auth.*). The only unqualified
--   references are core PostgreSQL built-ins (now(), gen_random_uuid(),
--   coalesce, btrim, jsonb_build_object, jsonb_agg, current_setting,
--   set_config, jsonb_typeof, jsonb_array_length, jsonb_array_elements,
--   round, unnest, array_remove, and base-type casts such as ::uuid /
--   ::numeric) which always resolve via the implicit pg_catalog search
--   path regardless of the search_path GUC. This mirrors the exact pattern
--   already applied (and proven safe in production) to sibling Office RPCs
--   drevora_archive_driver / drevora_restore_driver / drevora_archive_vehicle
--   / etc. in 20260808190000_office_write_require_aal2.sql, which already
--   use `set search_path = ''` with byte-identical bodies otherwise.
--
-- SCOPE
--   Touches ONLY the search_path GUC and a defense-in-depth privilege
--   reassertion (REVOKE/GRANT — unaffected by ALTER FUNCTION SET, but
--   reasserted explicitly per this repo's migration convention) for these
--   7 functions. Does NOT move anything to drevora_private, does NOT change
--   EXECUTE privileges (authenticated stays true, anon/PUBLIC stay false),
--   does NOT touch AAL2/auth/business logic, and does NOT change the
--   remaining 32 intentional authenticated SECURITY DEFINER Advisor count
--   (all 7 functions were already counted in that 32; this migration only
--   hardens search_path on functions already classified KEEP in Batch 6B).
--
-- Wrapped in one explicit transaction. Fails closed: any precondition or
-- postcondition assertion failure raises an exception and rolls back the
-- entire migration. Does NOT apply itself — run manually after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions + capture pre-change state (OID, body, return type,
--    language, volatility) for all 7 targets, for post-change equality proof.
-- -----------------------------------------------------------------------------
create temporary table drevora_batch7_captured (
  fn_sig text primary key,
  oid_before oid not null,
  prosrc_before text not null,
  prorettype_before oid not null,
  prolang_before oid not null,
  provolatile_before "char" not null
) on commit drop;

do $$
declare
  v_targets constant text[] := array[
    'public.drevora_accept_customer_legal_documents(uuid,boolean,boolean,boolean,boolean,text,text,text,text,text)',
    'public.drevora_accept_worker_legal_documents(uuid,boolean,boolean,text,text,text,text,text)',
    'public.drevora_clear_company_driver_timesheet_settings(uuid)',
    'public.drevora_get_customer_legal_status(uuid)',
    'public.drevora_get_worker_legal_status(uuid)',
    'public.drevora_office_apply_tyre_check_correction(uuid,text,text,jsonb)',
    'public.drevora_office_soft_delete_tyre_check(uuid,text)'
  ];
  v_sig text;
  v_oid oid;
begin
  if cardinality(v_targets) <> 7 then
    raise exception
      'BATCH7_PRECONDITION: target list cardinality % <> 7', cardinality(v_targets);
  end if;

  foreach v_sig in array v_targets loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is null then
      raise exception
        'BATCH7_PRECONDITION: % does not resolve (missing or wrong signature)', v_sig;
    end if;

    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.oid = v_oid
        and n.nspname = 'public'
        and p.prosecdef
    ) then
      raise exception
        'BATCH7_PRECONDITION: % is not a public-schema SECURITY DEFINER function', v_sig;
    end if;

    if not exists (
      select 1
      from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = v_oid
        and cfg = 'search_path=public'
    ) then
      raise exception
        'BATCH7_PRECONDITION: % does not currently have search_path=public', v_sig;
    end if;

    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception
        'BATCH7_PRECONDITION: authenticated lacks EXECUTE on %', v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception
        'BATCH7_PRECONDITION: anon unexpectedly has EXECUTE on %', v_sig;
    end if;
    if has_function_privilege('public', v_oid, 'EXECUTE') then
      raise exception
        'BATCH7_PRECONDITION: PUBLIC unexpectedly has EXECUTE on %', v_sig;
    end if;

    insert into drevora_batch7_captured (
      fn_sig, oid_before, prosrc_before, prorettype_before, prolang_before, provolatile_before
    )
    select v_sig, p.oid, p.prosrc, p.prorettype, p.prolang, p.provolatile
    from pg_proc p
    where p.oid = v_oid;
  end loop;

  if (select count(*) from drevora_batch7_captured) <> 7 then
    raise exception
      'BATCH7_PRECONDITION: expected exactly 7 captured targets, found %',
      (select count(*) from drevora_batch7_captured);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Harden search_path — pure ALTER FUNCTION, no body rewrite, no schema
--    move, no signature change. Order matches the target list above.
-- -----------------------------------------------------------------------------
alter function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) set search_path = '';

alter function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) set search_path = '';

alter function public.drevora_clear_company_driver_timesheet_settings(uuid)
  set search_path = '';

alter function public.drevora_get_customer_legal_status(uuid)
  set search_path = '';

alter function public.drevora_get_worker_legal_status(uuid)
  set search_path = '';

alter function public.drevora_office_apply_tyre_check_correction(
  uuid, text, text, jsonb
) set search_path = '';

alter function public.drevora_office_soft_delete_tyre_check(uuid, text)
  set search_path = '';

-- -----------------------------------------------------------------------------
-- 2) Reassert privileges explicitly. ALTER FUNCTION ... SET does not touch
--    the ACL, but this repo's migrations reassert grants explicitly for
--    auditability whenever a SECURITY DEFINER function is touched.
-- -----------------------------------------------------------------------------
revoke all on function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) from public;
revoke all on function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) from anon;
grant execute on function public.drevora_accept_customer_legal_documents(
  uuid, boolean, boolean, boolean, boolean, text, text, text, text, text
) to authenticated;

revoke all on function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) from public;
revoke all on function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) from anon;
grant execute on function public.drevora_accept_worker_legal_documents(
  uuid, boolean, boolean, text, text, text, text, text
) to authenticated;

revoke all on function public.drevora_clear_company_driver_timesheet_settings(uuid) from public;
revoke all on function public.drevora_clear_company_driver_timesheet_settings(uuid) from anon;
grant execute on function public.drevora_clear_company_driver_timesheet_settings(uuid) to authenticated;

revoke all on function public.drevora_get_customer_legal_status(uuid) from public;
revoke all on function public.drevora_get_customer_legal_status(uuid) from anon;
grant execute on function public.drevora_get_customer_legal_status(uuid) to authenticated;

revoke all on function public.drevora_get_worker_legal_status(uuid) from public;
revoke all on function public.drevora_get_worker_legal_status(uuid) from anon;
grant execute on function public.drevora_get_worker_legal_status(uuid) to authenticated;

revoke all on function public.drevora_office_apply_tyre_check_correction(
  uuid, text, text, jsonb
) from public;
revoke all on function public.drevora_office_apply_tyre_check_correction(
  uuid, text, text, jsonb
) from anon;
grant execute on function public.drevora_office_apply_tyre_check_correction(
  uuid, text, text, jsonb
) to authenticated;

revoke all on function public.drevora_office_soft_delete_tyre_check(uuid, text) from public;
revoke all on function public.drevora_office_soft_delete_tyre_check(uuid, text) from anon;
grant execute on function public.drevora_office_soft_delete_tyre_check(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Postconditions. Any failure rolls back the entire migration.
--    Proves: same OID, same schema, same SECURITY DEFINER flag, IDENTICAL
--    body/return type/language/volatility (i.e. no recreation occurred),
--    search_path pinned to empty string, and unchanged EXECUTE privileges.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_oid_after oid;
  v_search_path text;
  v_checked integer := 0;
begin
  for r in select * from drevora_batch7_captured loop
    v_oid_after := to_regprocedure(r.fn_sig);

    if v_oid_after is null then
      raise exception 'BATCH7_ASSERT: % no longer resolves', r.fn_sig;
    end if;

    if v_oid_after is distinct from r.oid_before then
      raise exception
        'BATCH7_ASSERT: % OID changed (before=%, after=%) — object was not preserved',
        r.fn_sig, r.oid_before, v_oid_after;
    end if;

    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.oid = v_oid_after
        and n.nspname = 'public'
    ) then
      raise exception 'BATCH7_ASSERT: % is no longer in schema public', r.fn_sig;
    end if;

    if not exists (
      select 1 from pg_proc where oid = v_oid_after and prosecdef
    ) then
      raise exception 'BATCH7_ASSERT: % lost SECURITY DEFINER', r.fn_sig;
    end if;

    if not exists (
      select 1
      from pg_proc
      where oid = v_oid_after
        and prosrc = r.prosrc_before
        and prorettype = r.prorettype_before
        and prolang = r.prolang_before
        and provolatile = r.provolatile_before
    ) then
      raise exception
        'BATCH7_ASSERT: % body/return type/language/volatility changed unexpectedly (not a pure search_path change)',
        r.fn_sig;
    end if;

    select cfg into v_search_path
    from pg_proc p
    cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
    where p.oid = v_oid_after
      and cfg like 'search_path=%';

    if v_search_path is distinct from 'search_path=""' then
      raise exception
        'BATCH7_ASSERT: % search_path not pinned to empty string (got %)',
        r.fn_sig, v_search_path;
    end if;

    if not has_function_privilege('authenticated', v_oid_after, 'EXECUTE') then
      raise exception 'BATCH7_ASSERT: authenticated missing EXECUTE on %', r.fn_sig;
    end if;
    if has_function_privilege('anon', v_oid_after, 'EXECUTE') then
      raise exception 'BATCH7_ASSERT: anon unexpectedly has EXECUTE on %', r.fn_sig;
    end if;
    if has_function_privilege('public', v_oid_after, 'EXECUTE') then
      raise exception 'BATCH7_ASSERT: PUBLIC unexpectedly has EXECUTE on %', r.fn_sig;
    end if;

    v_checked := v_checked + 1;
  end loop;

  if v_checked <> 7 then
    raise exception
      'BATCH7_ASSERT: expected exactly 7 functions checked, found %', v_checked;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
