-- Security Advisor hardening — Batch 3B (document / worker-submission
-- storage helpers only).
-- Targets:
--   public.drevora_storage_can_select_document_file(text)
--   public.drevora_storage_can_write_document_file(text)
--   public.drevora_storage_can_select_worker_submission_file(text)
--   public.drevora_storage_can_write_worker_submission_file(text)
--   public.drevora_storage_can_delete_worker_submission_staging_file(text)
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--   (5 of the current 54 warnings)
--
-- ROOT CAUSE
--   All 5 are SECURITY DEFINER, authenticated-executable, and live in
--   `public`, a PostgREST-exposed schema (Exposed schemas = public,
--   graphql_public only). Repo-wide audit (2026-08-08, Batch 3B preflight)
--   confirmed zero frontend/Edge/RPC callers for any of the 5 — every
--   caller is a storage.objects RLS policy on the document-files bucket,
--   or another one of these 5 helpers, evaluated in caller (authenticated)
--   context.
--
-- WHY THIS IS NOT A PLAIN "ALTER FUNCTION ... SET SCHEMA" FOR ALL 5
--   Independent body inspection found 3 of the 5 contain a literal,
--   schema-qualified call to a sibling in this same batch:
--     can_delete_worker_submission_staging_file
--       -> public.drevora_storage_can_write_worker_submission_file(...)
--     can_select_document_file
--       -> public.drevora_storage_can_select_worker_submission_file(...)
--     can_write_document_file
--       -> public.drevora_storage_can_write_worker_submission_file(...)
--   Unlike storage.objects policies (whose USING/WITH CHECK expressions are
--   parsed at CREATE POLICY time into a node tree bound to the callee's
--   OID, with a pg_depend row recorded), a LANGUAGE sql/plpgsql function
--   body is opaque text (pg_proc.prosrc) that is name-resolved fresh at
--   each execution. A literal `public.<fn>(...)` reference inside a moved
--   function's body would silently keep looking in `public` and fail at
--   first invocation once the callee is moved to drevora_private — no
--   pg_depend protection exists for this case. This migration therefore
--   moves the two leaf helpers (no sibling calls) with pure
--   ALTER FUNCTION ... SET SCHEMA, and for the 3 dependent helpers uses
--   CREATE OR REPLACE FUNCTION to change ONLY the sibling schema prefix on
--   the single already-existing internal call, before also moving them.
--   CREATE OR REPLACE FUNCTION on an unchanged signature preserves the
--   function's OID and existing ACL (PostgreSQL-documented behavior), so
--   OID-based dependency proofs remain valid for these 3 as well.
--
--   NO authorization condition, SQL logic, return behavior, volatility,
--   SECURITY DEFINER status, signature, or search_path is changed for any
--   of the 3 edited functions — only the schema qualifier on one existing
--   internal call per function.
--
-- PRIVATE SCHEMA
--   drevora_private already exists (created by
--   20260808230000_move_support_storage_helpers_private.sql, Batch 3A) with
--   authenticated USAGE / no CREATE for any application role. That posture
--   is reused unchanged here; this migration only adds per-function EXECUTE
--   grants for the 5 functions it moves.
--
-- search_path
--   All 5 functions already use `set search_path = ''` (confirmed at
--   creation in 20260726150000_create_worker_document_submissions.sql, not
--   changed since). This migration preserves that; the 3 CREATE OR REPLACE
--   statements re-declare the same `set search_path = ''`.
--
-- POLICIES
--   drevora_storage_document_files_select / _insert / _update / _delete are
--   NOT dropped, recreated, or altered by this migration. Their direct
--   function dependencies remain bound by OID (unchanged by SET SCHEMA and
--   by same-signature CREATE OR REPLACE).
--
-- SCOPE
--   Touches ONLY these 5 functions' schema/body-prefix/privileges. Does NOT
--   touch any other SECURITY DEFINER function, table, trigger, or Storage
--   policy. Does NOT touch the other 49 remaining Advisor warnings.
--
-- Wrapped in one explicit transaction. Fails closed: any assertion failure
-- raises an exception and rolls back the entire transaction, leaving all
-- 5 functions in `public` untouched. Does NOT apply itself — run manually
-- after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions + capture pre-move OIDs for all 5.
-- -----------------------------------------------------------------------------
create temporary table drevora_batch3b_captured_oids (
  fn_name text primary key,
  oid_before oid not null
) on commit drop;

do $$
declare
  v_select_doc_oid oid;
  v_write_doc_oid oid;
  v_select_sub_oid oid;
  v_write_sub_oid oid;
  v_delete_staging_oid oid;
  v_policy_count integer;
begin
  v_select_doc_oid := to_regprocedure('public.drevora_storage_can_select_document_file(text)');
  v_write_doc_oid := to_regprocedure('public.drevora_storage_can_write_document_file(text)');
  v_select_sub_oid := to_regprocedure('public.drevora_storage_can_select_worker_submission_file(text)');
  v_write_sub_oid := to_regprocedure('public.drevora_storage_can_write_worker_submission_file(text)');
  v_delete_staging_oid := to_regprocedure('public.drevora_storage_can_delete_worker_submission_staging_file(text)');

  if v_select_doc_oid is null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_select_document_file(text) missing';
  end if;
  if v_write_doc_oid is null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_write_document_file(text) missing';
  end if;
  if v_select_sub_oid is null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_select_worker_submission_file(text) missing';
  end if;
  if v_write_sub_oid is null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_write_worker_submission_file(text) missing';
  end if;
  if v_delete_staging_oid is null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_delete_worker_submission_staging_file(text) missing';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'drevora_storage_document_files_select',
      'drevora_storage_document_files_insert',
      'drevora_storage_document_files_update',
      'drevora_storage_document_files_delete'
    );

  if v_policy_count <> 4 then
    raise exception
      'MOVE_DOCUMENT_STORAGE_HELPERS_PRECONDITION: expected 4 document-files storage.objects policies, found %',
      v_policy_count;
  end if;

  insert into drevora_batch3b_captured_oids (fn_name, oid_before)
  values
    ('drevora_storage_can_select_document_file', v_select_doc_oid),
    ('drevora_storage_can_write_document_file', v_write_doc_oid),
    ('drevora_storage_can_select_worker_submission_file', v_select_sub_oid),
    ('drevora_storage_can_write_worker_submission_file', v_write_sub_oid),
    ('drevora_storage_can_delete_worker_submission_staging_file', v_delete_staging_oid);
end $$;

-- -----------------------------------------------------------------------------
-- 1) Move the two LEAF helpers first — pure ALTER FUNCTION SET SCHEMA, no
--    body change. Neither body references any of the other 4 functions in
--    this batch.
-- -----------------------------------------------------------------------------
alter function public.drevora_storage_can_select_worker_submission_file(text)
  set schema drevora_private;

alter function public.drevora_storage_can_write_worker_submission_file(text)
  set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 2) For the 3 DEPENDENT helpers only: CREATE OR REPLACE with the SAME
--    signature/language/volatility/SECURITY DEFINER/search_path/return
--    type/authorization logic — changing ONLY the sibling schema prefix on
--    the one existing internal call each already makes. Both leaf helpers
--    now live in drevora_private (step 1, same transaction), so these
--    qualified references resolve correctly the instant they are declared.
--    Same-signature CREATE OR REPLACE preserves the function's OID and ACL.
-- -----------------------------------------------------------------------------

-- 2a) drevora_storage_can_select_document_file(text)
--     Only change: public.drevora_storage_can_select_worker_submission_file
--       -> drevora_private.drevora_storage_can_select_worker_submission_file
create or replace function public.drevora_storage_can_select_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    drevora_private.drevora_storage_can_select_worker_submission_file(p_name)
    or exists (
      select 1
      from public.documents d
      where split_part(coalesce(p_name, ''), '/', 1) = 'documents'
        and d.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
        and d.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
        and d.company_id is not null
        and (
          public.drevora_auth_user_has_office_role_for_company(d.company_id)
          or (
            public.drevora_auth_user_belongs_to_company_id(d.company_id)
            and d.worker_id = public.drevora_auth_user_driver_id()
          )
        )
    );
$$;

-- 2b) drevora_storage_can_write_document_file(text)
--     Only change: public.drevora_storage_can_write_worker_submission_file
--       -> drevora_private.drevora_storage_can_write_worker_submission_file
create or replace function public.drevora_storage_can_write_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Office manage for documents/... OR Worker staging write for worker-submissions/...
  select
    drevora_private.drevora_storage_can_write_worker_submission_file(p_name)
    or exists (
      select 1
      from public.documents d
      where split_part(coalesce(p_name, ''), '/', 1) = 'documents'
        and d.id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 3))
        and d.company_id = public.drevora_storage_try_parse_uuid(split_part(p_name, '/', 2))
        and d.company_id is not null
        and public.drevora_auth_user_has_office_role_for_company(d.company_id)
    );
$$;

-- 2c) drevora_storage_can_delete_worker_submission_staging_file(text)
--     Only change: public.drevora_storage_can_write_worker_submission_file
--       -> drevora_private.drevora_storage_can_write_worker_submission_file
create or replace function public.drevora_storage_can_delete_worker_submission_staging_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Compensation cleanup only: own staging path and not yet linked as an attachment.
  select drevora_private.drevora_storage_can_write_worker_submission_file(p_name);
$$;

-- -----------------------------------------------------------------------------
-- 3) Move the 3 now-corrected dependent helpers into drevora_private.
-- -----------------------------------------------------------------------------
alter function public.drevora_storage_can_select_document_file(text)
  set schema drevora_private;

alter function public.drevora_storage_can_write_document_file(text)
  set schema drevora_private;

alter function public.drevora_storage_can_delete_worker_submission_staging_file(text)
  set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 4) Reaffirm function privileges post-move (defense-in-depth; SET SCHEMA
--    and same-signature CREATE OR REPLACE both preserve the pre-existing
--    ACL unchanged). No unnecessary service_role grant: no repository
--    evidence of a direct service_role caller for any of these 5.
-- -----------------------------------------------------------------------------
revoke all on function drevora_private.drevora_storage_can_select_document_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_select_document_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_select_document_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_document_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_write_document_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_write_document_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_select_worker_submission_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_select_worker_submission_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_select_worker_submission_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_worker_submission_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_write_worker_submission_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_write_worker_submission_file(text) to authenticated;

revoke all on function drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text) from public;
revoke all on function drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text) from anon;
grant execute on function drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text) to authenticated;

comment on function drevora_private.drevora_storage_can_select_document_file(text) is
  'SECURITY DEFINER storage helper for document-files SELECT (documents/... or worker-submissions/...). Moved from public via CREATE OR REPLACE (sibling schema prefix only) + ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3B) — same OID, authorization logic untouched. EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_document_files_select (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_write_document_file(text) is
  'SECURITY DEFINER storage helper for document-files INSERT/UPDATE/DELETE (documents/... or worker-submissions/...). Moved from public via CREATE OR REPLACE (sibling schema prefix only) + ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3B) — same OID, authorization logic untouched. EXECUTE: authenticated only. Used by storage.objects policies drevora_storage_document_files_insert / _update / _delete (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_select_worker_submission_file(text) is
  'SECURITY DEFINER storage helper for worker-submissions/... reads. Moved from public via ALTER FUNCTION SET SCHEMA only (2026-08-08 Batch 3B) — leaf helper, body untouched. EXECUTE: authenticated only. Reached only as a second-hop call from drevora_private.drevora_storage_can_select_document_file (no storage.objects policy calls this directly).';

comment on function drevora_private.drevora_storage_can_write_worker_submission_file(text) is
  'SECURITY DEFINER storage helper for worker-submissions/... staging writes. Moved from public via ALTER FUNCTION SET SCHEMA only (2026-08-08 Batch 3B) — leaf helper, body untouched. EXECUTE: authenticated only. Reached only as a second-hop call from drevora_private.drevora_storage_can_write_document_file and drevora_private.drevora_storage_can_delete_worker_submission_staging_file (no storage.objects policy calls this directly).';

comment on function drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text) is
  'SECURITY DEFINER storage helper for worker-submissions/... staging cleanup deletes. Moved from public via CREATE OR REPLACE (sibling schema prefix only) + ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3B) — same OID, authorization logic untouched. EXECUTE: authenticated only. Used by storage.objects policy drevora_storage_document_files_delete (bound by function OID; unaffected by this move).';

-- -----------------------------------------------------------------------------
-- 5) In-transaction assertions. Any failure rolls back the entire migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_select_doc_before oid;
  v_write_doc_before oid;
  v_select_sub_before oid;
  v_write_sub_before oid;
  v_delete_staging_before oid;
  v_select_doc_after oid;
  v_write_doc_after oid;
  v_select_sub_after oid;
  v_write_sub_after oid;
  v_delete_staging_after oid;
begin
  select oid_before into v_select_doc_before from drevora_batch3b_captured_oids where fn_name = 'drevora_storage_can_select_document_file';
  select oid_before into v_write_doc_before from drevora_batch3b_captured_oids where fn_name = 'drevora_storage_can_write_document_file';
  select oid_before into v_select_sub_before from drevora_batch3b_captured_oids where fn_name = 'drevora_storage_can_select_worker_submission_file';
  select oid_before into v_write_sub_before from drevora_batch3b_captured_oids where fn_name = 'drevora_storage_can_write_worker_submission_file';
  select oid_before into v_delete_staging_before from drevora_batch3b_captured_oids where fn_name = 'drevora_storage_can_delete_worker_submission_staging_file';

  -- ---------------------------------------------------------------------
  -- Function location / identity — public versions gone, private exist,
  -- OIDs unchanged from pre-move capture.
  -- ---------------------------------------------------------------------
  if to_regprocedure('public.drevora_storage_can_select_document_file(text)') is not null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_select_document_file(text) still resolves';
  end if;
  if to_regprocedure('public.drevora_storage_can_write_document_file(text)') is not null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_write_document_file(text) still resolves';
  end if;
  if to_regprocedure('public.drevora_storage_can_select_worker_submission_file(text)') is not null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_select_worker_submission_file(text) still resolves';
  end if;
  if to_regprocedure('public.drevora_storage_can_write_worker_submission_file(text)') is not null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_write_worker_submission_file(text) still resolves';
  end if;
  if to_regprocedure('public.drevora_storage_can_delete_worker_submission_staging_file(text)') is not null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_delete_worker_submission_staging_file(text) still resolves';
  end if;

  v_select_doc_after := to_regprocedure('drevora_private.drevora_storage_can_select_document_file(text)');
  v_write_doc_after := to_regprocedure('drevora_private.drevora_storage_can_write_document_file(text)');
  v_select_sub_after := to_regprocedure('drevora_private.drevora_storage_can_select_worker_submission_file(text)');
  v_write_sub_after := to_regprocedure('drevora_private.drevora_storage_can_write_worker_submission_file(text)');
  v_delete_staging_after := to_regprocedure('drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text)');

  if v_select_doc_after is null or v_write_doc_after is null or v_select_sub_after is null
     or v_write_sub_after is null or v_delete_staging_after is null then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: one or more drevora_private.* functions do not resolve';
  end if;

  if v_select_doc_after is distinct from v_select_doc_before then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_select_document_file OID changed (before=%, after=%)', v_select_doc_before, v_select_doc_after;
  end if;
  if v_write_doc_after is distinct from v_write_doc_before then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_write_document_file OID changed (before=%, after=%)', v_write_doc_before, v_write_doc_after;
  end if;
  if v_select_sub_after is distinct from v_select_sub_before then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_select_worker_submission_file OID changed (before=%, after=%)', v_select_sub_before, v_select_sub_after;
  end if;
  if v_write_sub_after is distinct from v_write_sub_before then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_write_worker_submission_file OID changed (before=%, after=%)', v_write_sub_before, v_write_sub_after;
  end if;
  if v_delete_staging_after is distinct from v_delete_staging_before then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_delete_worker_submission_staging_file OID changed (before=%, after=%)', v_delete_staging_before, v_delete_staging_after;
  end if;
end $$;

-- Per-function assertions (explicit, not a generic loop, for clearer
-- failure messages naming the exact function that failed).
do $$
declare
  v_sql_lang oid := (select oid from pg_language where lanname = 'sql');
  v_boolean_type oid := 'boolean'::regtype;
  r record;
begin
  for r in
    select *
    from (
      values
        ('drevora_storage_can_select_document_file'),
        ('drevora_storage_can_write_document_file'),
        ('drevora_storage_can_select_worker_submission_file'),
        ('drevora_storage_can_write_worker_submission_file'),
        ('drevora_storage_can_delete_worker_submission_staging_file')
    ) as t(fn_name)
  loop
    declare
      v_oid oid := to_regprocedure(format('drevora_private.%I(text)', r.fn_name));
      v_search_path text;
    begin
      if not exists (select 1 from pg_proc where oid = v_oid and prosecdef) then
        raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: % is not SECURITY DEFINER after move', r.fn_name;
      end if;

      if not exists (
        select 1 from pg_proc
        where oid = v_oid
          and prolang = v_sql_lang
          and provolatile = 's'
          and prorettype = v_boolean_type
      ) then
        raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: % language/volatility/return type changed unexpectedly', r.fn_name;
      end if;

      select cfg into v_search_path
      from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = v_oid
        and cfg like 'search_path=%';

      if v_search_path is distinct from 'search_path=""' then
        raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: % search_path not pinned to empty string (got %)', r.fn_name, v_search_path;
      end if;

      if has_function_privilege('public', v_oid, 'EXECUTE') then
        raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: PUBLIC still has EXECUTE on %', r.fn_name;
      end if;
      if has_function_privilege('anon', v_oid, 'EXECUTE') then
        raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: anon still has EXECUTE on %', r.fn_name;
      end if;
      if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
        raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: authenticated is missing EXECUTE on %', r.fn_name;
      end if;
    end;
  end loop;
end $$;

-- Stale-reference check for the 3 edited bodies + presence of the required
-- drevora_private.* sibling reference (text-level check on prosrc, used
-- ONLY to corroborate the functional edit — OID/pg_depend checks above and
-- below are the primary proof that the objects themselves are intact).
do $$
declare
  v_src text;
begin
  select prosrc into v_src
  from pg_proc
  where oid = to_regprocedure('drevora_private.drevora_storage_can_select_document_file(text)');
  if v_src like '%public.drevora_storage_can_select_worker_submission_file%' then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_select_document_file still contains a stale public.* sibling reference';
  end if;
  if v_src not like '%drevora_private.drevora_storage_can_select_worker_submission_file%' then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_select_document_file is missing the required drevora_private.* sibling reference';
  end if;

  select prosrc into v_src
  from pg_proc
  where oid = to_regprocedure('drevora_private.drevora_storage_can_write_document_file(text)');
  if v_src like '%public.drevora_storage_can_write_worker_submission_file%' then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_write_document_file still contains a stale public.* sibling reference';
  end if;
  if v_src not like '%drevora_private.drevora_storage_can_write_worker_submission_file%' then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_write_document_file is missing the required drevora_private.* sibling reference';
  end if;

  select prosrc into v_src
  from pg_proc
  where oid = to_regprocedure('drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text)');
  if v_src like '%public.drevora_storage_can_write_worker_submission_file%' then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_delete_worker_submission_staging_file still contains a stale public.* sibling reference';
  end if;
  if v_src not like '%drevora_private.drevora_storage_can_write_worker_submission_file%' then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: can_delete_worker_submission_staging_file is missing the required drevora_private.* sibling reference';
  end if;
end $$;

-- Policies — untouched objects; existence, command/role, and OID-based
-- pg_depend proof (not fragile string-only matching).
do $$
declare
  v_policy_count integer;
  v_select_doc_oid oid := to_regprocedure('drevora_private.drevora_storage_can_select_document_file(text)');
  v_write_doc_oid oid := to_regprocedure('drevora_private.drevora_storage_can_write_document_file(text)');
  v_delete_staging_oid oid := to_regprocedure('drevora_private.drevora_storage_can_delete_worker_submission_staging_file(text)');
begin
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'drevora_storage_document_files_select',
      'drevora_storage_document_files_insert',
      'drevora_storage_document_files_update',
      'drevora_storage_document_files_delete'
    );

  if v_policy_count <> 4 then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: expected 4 document-files storage.objects policies, found %', v_policy_count;
  end if;

  if not exists (
    select 1 from pg_policy pol
    where pol.polname = 'drevora_storage_document_files_select'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'r'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_select command/role changed unexpectedly';
  end if;

  if not exists (
    select 1 from pg_policy pol
    where pol.polname = 'drevora_storage_document_files_insert'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'a'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_insert command/role changed unexpectedly';
  end if;

  if not exists (
    select 1 from pg_policy pol
    where pol.polname = 'drevora_storage_document_files_update'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'w'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_update command/role changed unexpectedly';
  end if;

  if not exists (
    select 1 from pg_policy pol
    where pol.polname = 'drevora_storage_document_files_delete'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'd'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_delete command/role changed unexpectedly';
  end if;

  -- pg_depend: policy -> function, keyed by the SAME OIDs captured before
  -- the move (proves the dependency graph still points at the moved
  -- objects, not at some newly-created replacement).
  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_select_doc_oid
      and pol.polname = 'drevora_storage_document_files_select'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_select no longer depends on the moved can_select_document_file OID';
  end if;

  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_write_doc_oid
      and pol.polname = 'drevora_storage_document_files_insert'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_insert no longer depends on the moved can_write_document_file OID';
  end if;

  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_write_doc_oid
      and pol.polname = 'drevora_storage_document_files_update'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_update no longer depends on the moved can_write_document_file OID';
  end if;

  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_write_doc_oid
      and pol.polname = 'drevora_storage_document_files_delete'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_delete no longer depends on the moved can_write_document_file OID';
  end if;

  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_delete_staging_oid
      and pol.polname = 'drevora_storage_document_files_delete'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_delete no longer depends on the moved can_delete_worker_submission_staging_file OID';
  end if;

  -- Secondary confirmation only (not the source of truth): expressions
  -- should now deparse under the new schema name for the 3 functions
  -- directly referenced by these policies.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'drevora_storage_document_files_select'
      and coalesce(qual, '') like '%drevora_private.drevora_storage_can_select_document_file%'
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_select does not deparse to drevora_private.* (secondary check)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'drevora_storage_document_files_delete'
      and coalesce(qual, '') like '%drevora_private.drevora_storage_can_write_document_file%'
      and coalesce(qual, '') like '%drevora_private.drevora_storage_can_delete_worker_submission_staging_file%'
  ) then
    raise exception 'MOVE_DOCUMENT_STORAGE_HELPERS_ASSERT: drevora_storage_document_files_delete does not deparse both drevora_private.* branches (secondary check)';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
