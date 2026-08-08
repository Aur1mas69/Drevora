-- Security Advisor hardening — Batch 3C (remaining Storage tenant-scope
-- helpers: worker-avatars, vehicle-check-photos, consumable-receipts,
-- driver-report-files, plus the orphaned object_company_id resolver).
--
-- Targets (10):
--   public.drevora_storage_can_select_worker_avatar(text)
--   public.drevora_storage_can_write_worker_avatar(text)
--   public.drevora_storage_can_select_vehicle_check_file(text)
--   public.drevora_storage_can_write_vehicle_check_file(text)
--   public.drevora_storage_can_delete_vehicle_check_file(text)
--   public.drevora_storage_can_select_consumable_receipt(text)
--   public.drevora_storage_can_write_consumable_receipt(text)
--   public.drevora_storage_can_select_driver_report_file(text)
--   public.drevora_storage_can_write_driver_report_file(text)
--   public.drevora_storage_object_company_id(text, text)
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--   (10 of the current 49 warnings)
--
-- ROOT CAUSE
--   All 10 are SECURITY DEFINER, authenticated-executable, and live in
--   `public`, a PostgREST-exposed schema (Exposed schemas = public,
--   graphql_public only).
--
-- WHY THIS IS A PURE SET SCHEMA MOVE (simpler than Batch 3B)
--   Read-only preflight (2026-08-08, Batch 3C) confirmed NONE of these 10
--   functions call any other function in this same set of 10 — each only
--   calls sibling helpers that are staying in `public`
--   (drevora_storage_try_parse_uuid, drevora_storage_worker_avatar_*,
--   drevora_storage_vehicle_check_ids_from_path,
--   drevora_storage_path_is_vehicle_check_signature, drevora_auth_user_*,
--   drevora_vehicle_check_is_worker_editable/_final) plus record tables.
--   Those callees remain `public.`-qualified in the bodies and remain in
--   `public`, so no CREATE OR REPLACE / body edit is needed for any of the
--   10 — unlike Batch 3B, this is a pure `ALTER FUNCTION ... SET SCHEMA`
--   for all 10.
--
-- drevora_storage_object_company_id(text, text)
--   Repo-wide search found ZERO storage.objects policy or application
--   caller for this function — it is an orphaned helper (every bucket it
--   resolves is instead gated directly by the bucket-specific
--   can_select_*/can_write_* helpers below). It is moved alongside the
--   other 9 for consistency and Advisor credit, NOT deleted, and this
--   migration explicitly asserts it has no policy dependency before and
--   after the move.
--
-- search_path
--   9 of the 10 functions currently carry `set search_path = public`
--   (never hardened before this batch). Their bodies are already fully
--   `public.`-schema-qualified (verified in the Batch 3C preflight), so
--   repinning to `''` after the move changes no behavior. The 10th,
--   drevora_storage_object_company_id, already has `search_path = ''`
--   (hardened in 20260726150000_create_worker_document_submissions.sql)
--   and is left untouched.
--
-- POLICIES
--   The 16 storage.objects policies across worker-avatars,
--   vehicle-check-photos, consumable-receipts, and driver-report-files are
--   NOT dropped, recreated, or altered by this migration. Their direct
--   function dependencies remain bound by OID (unchanged by SET SCHEMA).
--
-- SCOPE
--   Touches ONLY these 10 functions' schema/search_path/privileges. Does
--   NOT touch any other SECURITY DEFINER function, table, trigger, or
--   Storage policy.
--
-- Wrapped in one explicit transaction. Fails closed: any assertion failure
-- raises an exception and rolls back the entire transaction, leaving all
-- 10 functions in `public` untouched. Does NOT apply itself — run manually
-- after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions + capture pre-move OIDs for all 10.
-- -----------------------------------------------------------------------------
create temporary table drevora_batch3c_captured_oids (
  fn_name text primary key,
  oid_before oid not null
) on commit drop;

do $$
declare
  v_fn text;
  v_oid oid;
  v_policy_count integer;
begin
  for v_fn in
    select unnest(array[
      'drevora_storage_can_select_worker_avatar(text)',
      'drevora_storage_can_write_worker_avatar(text)',
      'drevora_storage_can_select_vehicle_check_file(text)',
      'drevora_storage_can_write_vehicle_check_file(text)',
      'drevora_storage_can_delete_vehicle_check_file(text)',
      'drevora_storage_can_select_consumable_receipt(text)',
      'drevora_storage_can_write_consumable_receipt(text)',
      'drevora_storage_can_select_driver_report_file(text)',
      'drevora_storage_can_write_driver_report_file(text)',
      'drevora_storage_object_company_id(text, text)'
    ])
  loop
    v_oid := to_regprocedure('public.' || v_fn);
    if v_oid is null then
      raise exception 'MOVE_REMAINING_STORAGE_HELPERS_PRECONDITION: public.% missing', v_fn;
    end if;
    insert into drevora_batch3c_captured_oids (fn_name, oid_before)
    values (split_part(v_fn, '(', 1), v_oid);
  end loop;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'drevora_storage_worker_avatars_select',
      'drevora_storage_worker_avatars_insert',
      'drevora_storage_worker_avatars_update',
      'drevora_storage_worker_avatars_delete',
      'drevora_storage_vehicle_check_photos_select',
      'drevora_storage_vehicle_check_photos_insert',
      'drevora_storage_vehicle_check_photos_update',
      'drevora_storage_vehicle_check_photos_delete',
      'drevora_storage_consumable_receipts_select',
      'drevora_storage_consumable_receipts_insert',
      'drevora_storage_consumable_receipts_update',
      'drevora_storage_consumable_receipts_delete',
      'drevora_storage_driver_report_files_select',
      'drevora_storage_driver_report_files_insert',
      'drevora_storage_driver_report_files_update',
      'drevora_storage_driver_report_files_delete'
    );

  if v_policy_count <> 16 then
    raise exception
      'MOVE_REMAINING_STORAGE_HELPERS_PRECONDITION: expected 16 storage.objects policies across worker-avatars/vehicle-check-photos/consumable-receipts/driver-report-files, found %',
      v_policy_count;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Move all 10 — pure ALTER FUNCTION SET SCHEMA, no body change.
--    None of these 10 references another function in this same set, so no
--    CREATE OR REPLACE / sibling schema-prefix edit is needed for any of
--    them (unlike Batch 3B).
-- -----------------------------------------------------------------------------
alter function public.drevora_storage_can_select_worker_avatar(text) set schema drevora_private;
alter function public.drevora_storage_can_write_worker_avatar(text) set schema drevora_private;
alter function public.drevora_storage_can_select_vehicle_check_file(text) set schema drevora_private;
alter function public.drevora_storage_can_write_vehicle_check_file(text) set schema drevora_private;
alter function public.drevora_storage_can_delete_vehicle_check_file(text) set schema drevora_private;
alter function public.drevora_storage_can_select_consumable_receipt(text) set schema drevora_private;
alter function public.drevora_storage_can_write_consumable_receipt(text) set schema drevora_private;
alter function public.drevora_storage_can_select_driver_report_file(text) set schema drevora_private;
alter function public.drevora_storage_can_write_driver_report_file(text) set schema drevora_private;
alter function public.drevora_storage_object_company_id(text, text) set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 2) search_path hardening — 9 functions move from `public` to `''`.
--    drevora_storage_object_company_id already has `''` and is left as-is.
--    Bodies are already fully public.-schema-qualified (verified in the
--    Batch 3C preflight); this changes no behavior.
-- -----------------------------------------------------------------------------
alter function drevora_private.drevora_storage_can_select_worker_avatar(text) set search_path = '';
alter function drevora_private.drevora_storage_can_write_worker_avatar(text) set search_path = '';
alter function drevora_private.drevora_storage_can_select_vehicle_check_file(text) set search_path = '';
alter function drevora_private.drevora_storage_can_write_vehicle_check_file(text) set search_path = '';
alter function drevora_private.drevora_storage_can_delete_vehicle_check_file(text) set search_path = '';
alter function drevora_private.drevora_storage_can_select_consumable_receipt(text) set search_path = '';
alter function drevora_private.drevora_storage_can_write_consumable_receipt(text) set search_path = '';
alter function drevora_private.drevora_storage_can_select_driver_report_file(text) set search_path = '';
alter function drevora_private.drevora_storage_can_write_driver_report_file(text) set search_path = '';

-- -----------------------------------------------------------------------------
-- 3) Reaffirm function privileges post-move (defense-in-depth; SET SCHEMA
--    preserves the pre-existing ACL unchanged). No service_role grants:
--    no repository evidence of a direct service_role caller for any of
--    these 10.
-- -----------------------------------------------------------------------------
revoke all on function drevora_private.drevora_storage_can_select_worker_avatar(text) from public;
revoke all on function drevora_private.drevora_storage_can_select_worker_avatar(text) from anon;
grant execute on function drevora_private.drevora_storage_can_select_worker_avatar(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_worker_avatar(text) from public;
revoke all on function drevora_private.drevora_storage_can_write_worker_avatar(text) from anon;
grant execute on function drevora_private.drevora_storage_can_write_worker_avatar(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_select_vehicle_check_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_select_vehicle_check_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_select_vehicle_check_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_vehicle_check_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_write_vehicle_check_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_write_vehicle_check_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_delete_vehicle_check_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_delete_vehicle_check_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_delete_vehicle_check_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_select_consumable_receipt(text) from public;
revoke all on function drevora_private.drevora_storage_can_select_consumable_receipt(text) from anon;
grant execute on function drevora_private.drevora_storage_can_select_consumable_receipt(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_consumable_receipt(text) from public;
revoke all on function drevora_private.drevora_storage_can_write_consumable_receipt(text) from anon;
grant execute on function drevora_private.drevora_storage_can_write_consumable_receipt(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_select_driver_report_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_select_driver_report_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_select_driver_report_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_driver_report_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_write_driver_report_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_write_driver_report_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_object_company_id(text, text) from public;
revoke all on function drevora_private.drevora_storage_object_company_id(text, text) from anon;
grant execute on function drevora_private.drevora_storage_object_company_id(text, text) to authenticated;

comment on function drevora_private.drevora_storage_can_select_worker_avatar(text) is
  'SECURITY DEFINER storage helper for worker-avatars SELECT. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_worker_avatars_select (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_write_worker_avatar(text) is
  'SECURITY DEFINER storage helper for worker-avatars INSERT/UPDATE/DELETE. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policies drevora_storage_worker_avatars_insert/_update/_delete (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_select_vehicle_check_file(text) is
  'SECURITY DEFINER storage helper for vehicle-check-photos SELECT. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_vehicle_check_photos_select (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_write_vehicle_check_file(text) is
  'SECURITY DEFINER storage helper for vehicle-check-photos INSERT/UPDATE. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policies drevora_storage_vehicle_check_photos_insert/_update (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_delete_vehicle_check_file(text) is
  'SECURITY DEFINER storage helper for vehicle-check-photos DELETE. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_vehicle_check_photos_delete (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_select_consumable_receipt(text) is
  'SECURITY DEFINER storage helper for consumable-receipts SELECT. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_consumable_receipts_select (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_write_consumable_receipt(text) is
  'SECURITY DEFINER storage helper for consumable-receipts INSERT/UPDATE/DELETE. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policies drevora_storage_consumable_receipts_insert/_update/_delete (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_select_driver_report_file(text) is
  'SECURITY DEFINER storage helper for driver-report-files SELECT. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_driver_report_files_select (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_write_driver_report_file(text) is
  'SECURITY DEFINER storage helper for driver-report-files INSERT/UPDATE/DELETE. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path hardened to '''' (was public). EXECUTE: authenticated only. Used by storage.objects policies drevora_storage_driver_report_files_insert/_update/_delete (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_object_company_id(text, text) is
  'SECURITY DEFINER path->tenant resolver. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3C) — same OID, body untouched, search_path already '''' (unchanged). EXECUTE: authenticated only. Repo-wide audit found NO storage.objects policy or application caller depends on this function; every bucket it resolves is instead gated directly by the bucket-specific can_select_*/can_write_* helpers. Retained (not deleted) for potential future path-resolution use.';

-- -----------------------------------------------------------------------------
-- 4) In-transaction assertions. Any failure rolls back the entire migration.
-- -----------------------------------------------------------------------------

-- Per-function assertions: location/OID, security posture, search_path,
-- grants. Explicit target return type / language per function (9 boolean
-- SQL functions + 1 plpgsql uuid function).
do $$
declare
  v_sql_lang oid := (select oid from pg_language where lanname = 'sql');
  v_plpgsql_lang oid := (select oid from pg_language where lanname = 'plpgsql');
  v_boolean_type oid := 'boolean'::regtype;
  v_uuid_type oid := 'uuid'::regtype;
  r record;
begin
  for r in
    select *
    from (
      values
        ('drevora_storage_can_select_worker_avatar', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_write_worker_avatar', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_select_vehicle_check_file', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_write_vehicle_check_file', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_delete_vehicle_check_file', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_select_consumable_receipt', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_write_consumable_receipt', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_select_driver_report_file', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_can_write_driver_report_file', '(text)', v_sql_lang, v_boolean_type),
        ('drevora_storage_object_company_id', '(text, text)', v_plpgsql_lang, v_uuid_type)
    ) as t(fn_name, fn_args, expected_lang, expected_rettype)
  loop
    declare
      v_oid_before oid;
      v_oid_after oid;
      v_search_path text;
    begin
      select oid_before into v_oid_before
      from drevora_batch3c_captured_oids
      where fn_name = r.fn_name;

      if to_regprocedure(format('public.%I%s', r.fn_name, r.fn_args)) is not null then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: public.% still resolves', r.fn_name;
      end if;

      v_oid_after := to_regprocedure(format('drevora_private.%I%s', r.fn_name, r.fn_args));
      if v_oid_after is null then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: drevora_private.% does not resolve', r.fn_name;
      end if;

      if v_oid_after is distinct from v_oid_before then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: % OID changed (before=%, after=%)', r.fn_name, v_oid_before, v_oid_after;
      end if;

      if not exists (select 1 from pg_proc where oid = v_oid_after and prosecdef) then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: % is not SECURITY DEFINER after move', r.fn_name;
      end if;

      if not exists (
        select 1 from pg_proc
        where oid = v_oid_after
          and prolang = r.expected_lang
          and provolatile = 's'
          and prorettype = r.expected_rettype
      ) then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: % language/volatility/return type changed unexpectedly', r.fn_name;
      end if;

      select cfg into v_search_path
      from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = v_oid_after
        and cfg like 'search_path=%';

      if v_search_path is distinct from 'search_path=""' then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: % search_path not pinned to empty string (got %)', r.fn_name, v_search_path;
      end if;

      if has_function_privilege('public', v_oid_after, 'EXECUTE') then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: PUBLIC still has EXECUTE on %', r.fn_name;
      end if;
      if has_function_privilege('anon', v_oid_after, 'EXECUTE') then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: anon still has EXECUTE on %', r.fn_name;
      end if;
      if not has_function_privilege('authenticated', v_oid_after, 'EXECUTE') then
        raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: authenticated is missing EXECUTE on %', r.fn_name;
      end if;
    end;
  end loop;
end $$;

-- drevora_storage_object_company_id: explicit no-policy-dependency assertion
-- (before AND after the move — same OID, so the "before" check is implicit
-- in the "after" check since the OID never changes; confirmed explicitly
-- here for clarity/documentation of the security invariant).
do $$
declare
  v_oid oid := to_regprocedure('drevora_private.drevora_storage_object_company_id(text, text)');
begin
  if v_oid is null then
    raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: drevora_private.drevora_storage_object_company_id(text, text) does not resolve';
  end if;

  if exists (
    select 1
    from pg_depend d
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_oid
  ) then
    raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: drevora_storage_object_company_id unexpectedly has a storage policy dependency';
  end if;
end $$;

-- Policies — untouched objects; existence, command/role, and OID-based
-- pg_depend proof (not fragile string-only matching) for the 8
-- directly-referenced functions.
do $$
declare
  v_policy_count integer;
  v_select_avatar_oid oid := to_regprocedure('drevora_private.drevora_storage_can_select_worker_avatar(text)');
  v_write_avatar_oid oid := to_regprocedure('drevora_private.drevora_storage_can_write_worker_avatar(text)');
  v_select_vc_oid oid := to_regprocedure('drevora_private.drevora_storage_can_select_vehicle_check_file(text)');
  v_write_vc_oid oid := to_regprocedure('drevora_private.drevora_storage_can_write_vehicle_check_file(text)');
  v_delete_vc_oid oid := to_regprocedure('drevora_private.drevora_storage_can_delete_vehicle_check_file(text)');
  v_select_cr_oid oid := to_regprocedure('drevora_private.drevora_storage_can_select_consumable_receipt(text)');
  v_write_cr_oid oid := to_regprocedure('drevora_private.drevora_storage_can_write_consumable_receipt(text)');
  v_select_dr_oid oid := to_regprocedure('drevora_private.drevora_storage_can_select_driver_report_file(text)');
  v_write_dr_oid oid := to_regprocedure('drevora_private.drevora_storage_can_write_driver_report_file(text)');

  r record;
begin
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'drevora_storage_worker_avatars_select',
      'drevora_storage_worker_avatars_insert',
      'drevora_storage_worker_avatars_update',
      'drevora_storage_worker_avatars_delete',
      'drevora_storage_vehicle_check_photos_select',
      'drevora_storage_vehicle_check_photos_insert',
      'drevora_storage_vehicle_check_photos_update',
      'drevora_storage_vehicle_check_photos_delete',
      'drevora_storage_consumable_receipts_select',
      'drevora_storage_consumable_receipts_insert',
      'drevora_storage_consumable_receipts_update',
      'drevora_storage_consumable_receipts_delete',
      'drevora_storage_driver_report_files_select',
      'drevora_storage_driver_report_files_insert',
      'drevora_storage_driver_report_files_update',
      'drevora_storage_driver_report_files_delete'
    );

  if v_policy_count <> 16 then
    raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: expected 16 storage.objects policies, found %', v_policy_count;
  end if;

  -- command/role unchanged, per policy
  for r in
    select *
    from (
      values
        ('drevora_storage_worker_avatars_select', 'r'),
        ('drevora_storage_worker_avatars_insert', 'a'),
        ('drevora_storage_worker_avatars_update', 'w'),
        ('drevora_storage_worker_avatars_delete', 'd'),
        ('drevora_storage_vehicle_check_photos_select', 'r'),
        ('drevora_storage_vehicle_check_photos_insert', 'a'),
        ('drevora_storage_vehicle_check_photos_update', 'w'),
        ('drevora_storage_vehicle_check_photos_delete', 'd'),
        ('drevora_storage_consumable_receipts_select', 'r'),
        ('drevora_storage_consumable_receipts_insert', 'a'),
        ('drevora_storage_consumable_receipts_update', 'w'),
        ('drevora_storage_consumable_receipts_delete', 'd'),
        ('drevora_storage_driver_report_files_select', 'r'),
        ('drevora_storage_driver_report_files_insert', 'a'),
        ('drevora_storage_driver_report_files_update', 'w'),
        ('drevora_storage_driver_report_files_delete', 'd')
    ) as t(policy_name, expected_cmd)
  loop
    if not exists (
      select 1 from pg_policy pol
      where pol.polname = r.policy_name
        and pol.polrelid = 'storage.objects'::regclass
        and pol.polcmd = r.expected_cmd
        and pol.polroles = array[to_regrole('authenticated')::oid]
    ) then
      raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: % command/role changed unexpectedly', r.policy_name;
    end if;
  end loop;

  -- pg_depend: policy -> function, keyed by the SAME OIDs captured before
  -- the move (proves the dependency graph still points at the moved
  -- objects).
  for r in
    select *
    from (
      values
        ('drevora_storage_worker_avatars_select', v_select_avatar_oid),
        ('drevora_storage_worker_avatars_insert', v_write_avatar_oid),
        ('drevora_storage_worker_avatars_update', v_write_avatar_oid),
        ('drevora_storage_worker_avatars_delete', v_write_avatar_oid),
        ('drevora_storage_vehicle_check_photos_select', v_select_vc_oid),
        ('drevora_storage_vehicle_check_photos_insert', v_write_vc_oid),
        ('drevora_storage_vehicle_check_photos_update', v_write_vc_oid),
        ('drevora_storage_vehicle_check_photos_delete', v_delete_vc_oid),
        ('drevora_storage_consumable_receipts_select', v_select_cr_oid),
        ('drevora_storage_consumable_receipts_insert', v_write_cr_oid),
        ('drevora_storage_consumable_receipts_update', v_write_cr_oid),
        ('drevora_storage_consumable_receipts_delete', v_write_cr_oid),
        ('drevora_storage_driver_report_files_select', v_select_dr_oid),
        ('drevora_storage_driver_report_files_insert', v_write_dr_oid),
        ('drevora_storage_driver_report_files_update', v_write_dr_oid),
        ('drevora_storage_driver_report_files_delete', v_write_dr_oid)
    ) as t(policy_name, expected_fn_oid)
  loop
    if not exists (
      select 1
      from pg_depend d
      join pg_policy pol on pol.oid = d.objid
      where d.classid = 'pg_policy'::regclass
        and d.refclassid = 'pg_proc'::regclass
        and d.refobjid = r.expected_fn_oid
        and pol.polname = r.policy_name
        and pol.polrelid = 'storage.objects'::regclass
    ) then
      raise exception 'MOVE_REMAINING_STORAGE_HELPERS_ASSERT: % no longer depends on the expected moved function OID', r.policy_name;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
