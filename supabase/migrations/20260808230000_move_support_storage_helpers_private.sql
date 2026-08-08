-- Security Advisor hardening — Batch 3A (support-attachment storage helpers only).
-- Target:
--   public.drevora_storage_can_access_support_attachment(text)
--   public.drevora_storage_can_write_support_attachment(text)
--
-- Advisor finding:
--   authenticated_security_definer_function_executable
--   (2 of the current 56 warnings)
--
-- ROOT CAUSE
--   Both helpers are SECURITY DEFINER, authenticated-executable, and live in
--   `public`, which is a PostgREST-exposed schema (confirmed live: Exposed
--   schemas = public, graphql_public only). Neither function has a
--   legitimate direct frontend/Edge/RPC caller (repo-wide audit, 2026-08-08):
--   both are used exclusively by storage.objects RLS policies evaluated in
--   caller (authenticated) context. Confirmed live: neither function is in
--   the Supabase Data API per-function exposed-function list either — this
--   migration closes the Advisor's schema-level finding, not an active
--   direct-RPC exploit.
--
-- STRATEGY — ALTER FUNCTION ... SET SCHEMA (no body recreation)
--   PostgreSQL's ALTER FUNCTION ... SET SCHEMA updates pg_proc.pronamespace
--   in place: it does NOT allocate a new pg_proc row, so the OID, owner,
--   SECURITY DEFINER flag, volatility, return type, function body, and
--   EXECUTE ACL are all preserved unchanged. This migration therefore does
--   NOT use CREATE OR REPLACE and does NOT DROP either function.
--
--   storage.objects RLS policy expressions bind to the callee by function
--   OID (pg_policy.polqual / polwithcheck store FuncExpr nodes referencing
--   funcid, with a pg_depend row recording the dependency) — not by a
--   stored `public.fn(...)` text reference. Because SET SCHEMA preserves
--   the OID, the three existing storage.objects policies below continue to
--   resolve to the same function objects with zero policy changes required:
--     support_attachments_select_own
--     support_attachments_insert_own
--     support_attachments_delete_own
--   None of these three policies are dropped, recreated, or altered by this
--   migration. pg_get_expr()/pg_policies will simply re-deparse the call
--   under the new drevora_private.* schema name after the move.
--
-- PRIVATE SCHEMA
--   drevora_private is created here for the first time. It is NOT added to
--   Supabase's Exposed schemas (confirmed live: only public, graphql_public
--   are exposed) and must remain that way — this is what removes these two
--   functions from the Advisor's authenticated_security_definer_function_
--   executable check and from the public REST API surface, without changing
--   any authorization logic.
--
--   Schema privilege posture (defense-in-depth explicit grants/revokes,
--   even though CREATE SCHEMA IF NOT EXISTS defaults to owner-only on a
--   fresh schema in PostgreSQL 15+):
--     PUBLIC        : USAGE=false, CREATE=false
--     anon          : USAGE=false, CREATE=false
--     authenticated : USAGE=true,  CREATE=false
--     authenticator : USAGE=false, CREATE=false (guarded: role may not exist
--                     in every environment; same convention as
--                     20260726260000_harden_public_function_security.sql)
--     service_role  : no explicit grant. No repository evidence of a direct
--                     service_role caller for these two helpers; service_role
--                     bypasses RLS for its own operations (a separate
--                     concept from schema/object privileges) and does not
--                     evaluate these storage.objects policies.
--
-- search_path
--   Both bodies were audited and confirmed fully schema-qualified (every
--   reference uses an explicit public. prefix: drevora_storage_try_parse_
--   uuid, drevora_auth_user_driver_id, drevora_auth_user_belongs_to_
--   company_id, support_requests). Repinning to '' after the move is safe
--   and introduces no behavior change. Uses ALTER FUNCTION (not CREATE OR
--   REPLACE), so the function bodies remain byte-for-byte untouched.
--
-- SCOPE
--   Touches ONLY these two functions' schema/search_path/privileges and
--   creates the (previously nonexistent) drevora_private schema. Does NOT
--   touch any other SECURITY DEFINER function, table, trigger, or Storage
--   policy. Does NOT touch the other 54 remaining Advisor warnings.
--
-- Idempotent within a single apply; wrapped in one explicit transaction.
-- Fails closed: any assertion failure raises an exception and rolls back
-- the entire transaction, leaving both functions in `public` untouched.
-- Does NOT apply itself — run manually after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions + capture pre-move OIDs (proves SET SCHEMA is object-
--    preserving, not a drop+recreate, once compared again after the move).
-- -----------------------------------------------------------------------------
create temporary table drevora_batch3a_captured_oids (
  fn_name text primary key,
  oid_before oid not null
) on commit drop;

do $$
declare
  v_access_oid oid;
  v_write_oid oid;
  v_policy_count integer;
begin
  v_access_oid := to_regprocedure(
    'public.drevora_storage_can_access_support_attachment(text)'
  );
  v_write_oid := to_regprocedure(
    'public.drevora_storage_can_write_support_attachment(text)'
  );

  if v_access_oid is null then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_access_support_attachment(text) missing — apply 20260801130000_create_support_requests.sql first';
  end if;

  if v_write_oid is null then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_PRECONDITION: public.drevora_storage_can_write_support_attachment(text) missing — apply 20260801130000_create_support_requests.sql first';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'support_attachments_select_own',
      'support_attachments_insert_own',
      'support_attachments_delete_own'
    );

  if v_policy_count <> 3 then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_PRECONDITION: expected 3 support-attachments storage.objects policies, found %',
      v_policy_count;
  end if;

  insert into drevora_batch3a_captured_oids (fn_name, oid_before)
  values
    ('drevora_storage_can_access_support_attachment', v_access_oid),
    ('drevora_storage_can_write_support_attachment', v_write_oid);
end $$;

-- -----------------------------------------------------------------------------
-- 1) Create + harden the private schema (never added to Exposed schemas).
-- -----------------------------------------------------------------------------
create schema if not exists drevora_private;

comment on schema drevora_private is
  'DREVORA-internal helper functions. NOT a PostgREST-exposed schema (do not add to Supabase Data API Exposed schemas). Storage/RLS policies may call functions here by schema-qualified name; no application role may CREATE objects in this schema.';

revoke all on schema drevora_private from public;
revoke all on schema drevora_private from anon;
revoke all on schema drevora_private from authenticated;

grant usage on schema drevora_private to authenticated;
-- CREATE is intentionally never granted to PUBLIC, anon, or authenticated.

do $$
begin
  if to_regrole('authenticator') is not null then
    revoke all on schema drevora_private from authenticator;
  end if;
end $$;

-- No explicit service_role schema grant: no repository evidence of a direct
-- service_role caller for these two helpers.

-- -----------------------------------------------------------------------------
-- 2) Move the functions — SET SCHEMA only. No body recreation, no DROP.
-- -----------------------------------------------------------------------------
alter function public.drevora_storage_can_access_support_attachment(text)
  set schema drevora_private;

alter function public.drevora_storage_can_write_support_attachment(text)
  set schema drevora_private;

-- -----------------------------------------------------------------------------
-- 3) search_path hardening — ALTER FUNCTION only; bodies already fully
--    schema-qualified (confirmed by audit), so this is behavior-neutral.
-- -----------------------------------------------------------------------------
alter function drevora_private.drevora_storage_can_access_support_attachment(text)
  set search_path = '';

alter function drevora_private.drevora_storage_can_write_support_attachment(text)
  set search_path = '';

-- -----------------------------------------------------------------------------
-- 4) Reaffirm function privileges post-move (defense-in-depth; SET SCHEMA
--    already preserves the pre-move ACL unchanged).
-- -----------------------------------------------------------------------------
revoke all on function drevora_private.drevora_storage_can_access_support_attachment(text)
  from public;
revoke all on function drevora_private.drevora_storage_can_access_support_attachment(text)
  from anon;
grant execute on function drevora_private.drevora_storage_can_access_support_attachment(text)
  to authenticated;

revoke all on function drevora_private.drevora_storage_can_write_support_attachment(text)
  from public;
revoke all on function drevora_private.drevora_storage_can_write_support_attachment(text)
  from anon;
grant execute on function drevora_private.drevora_storage_can_write_support_attachment(text)
  to authenticated;

comment on function drevora_private.drevora_storage_can_access_support_attachment(text) is
  'SECURITY DEFINER storage helper for support-attachments SELECT. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3A) — same object/OID, body untouched. EXECUTE: authenticated only. Used by storage.objects policy support_attachments_select_own (bound by function OID; unaffected by this move).';

comment on function drevora_private.drevora_storage_can_write_support_attachment(text) is
  'SECURITY DEFINER storage helper for support-attachments INSERT/DELETE. Moved from public via ALTER FUNCTION SET SCHEMA (2026-08-08 Batch 3A) — same object/OID, body untouched. EXECUTE: authenticated only. Used by storage.objects policies support_attachments_insert_own / support_attachments_delete_own (bound by function OID; unaffected by this move).';

-- -----------------------------------------------------------------------------
-- 5) In-transaction assertions. Any failure rolls back the entire migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_access_oid_before oid;
  v_write_oid_before oid;
  v_access_oid_after oid;
  v_write_oid_after oid;
  v_plpgsql_lang oid := (select oid from pg_language where lanname = 'plpgsql');
  v_boolean_type oid := 'boolean'::regtype;
  v_schema_owner text;
  v_search_path_access text;
  v_search_path_write text;
  v_policy_count integer;
begin
  select oid_before into v_access_oid_before
  from drevora_batch3a_captured_oids
  where fn_name = 'drevora_storage_can_access_support_attachment';

  select oid_before into v_write_oid_before
  from drevora_batch3a_captured_oids
  where fn_name = 'drevora_storage_can_write_support_attachment';

  -- ---------------------------------------------------------------------
  -- Function location / identity
  -- ---------------------------------------------------------------------
  if to_regprocedure('public.drevora_storage_can_access_support_attachment(text)')
     is not null then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_access_support_attachment(text) still resolves';
  end if;

  if to_regprocedure('public.drevora_storage_can_write_support_attachment(text)')
     is not null then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: public.drevora_storage_can_write_support_attachment(text) still resolves';
  end if;

  v_access_oid_after := to_regprocedure(
    'drevora_private.drevora_storage_can_access_support_attachment(text)'
  );
  v_write_oid_after := to_regprocedure(
    'drevora_private.drevora_storage_can_write_support_attachment(text)'
  );

  if v_access_oid_after is null then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: drevora_private.drevora_storage_can_access_support_attachment(text) does not resolve';
  end if;

  if v_write_oid_after is null then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: drevora_private.drevora_storage_can_write_support_attachment(text) does not resolve';
  end if;

  if v_access_oid_after is distinct from v_access_oid_before then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: access-helper OID changed (before=%, after=%) — object was not preserved by SET SCHEMA',
      v_access_oid_before, v_access_oid_after;
  end if;

  if v_write_oid_after is distinct from v_write_oid_before then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: write-helper OID changed (before=%, after=%) — object was not preserved by SET SCHEMA',
      v_write_oid_before, v_write_oid_after;
  end if;

  -- ---------------------------------------------------------------------
  -- Function security posture
  -- ---------------------------------------------------------------------
  if not exists (
    select 1 from pg_proc
    where oid = v_access_oid_after and prosecdef
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: access helper is not SECURITY DEFINER after move';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = v_write_oid_after and prosecdef
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: write helper is not SECURITY DEFINER after move';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = v_access_oid_after
      and prolang = v_plpgsql_lang
      and provolatile = 's'
      and prorettype = v_boolean_type
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: access helper language/volatility/return type changed unexpectedly';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = v_write_oid_after
      and prolang = v_plpgsql_lang
      and provolatile = 's'
      and prorettype = v_boolean_type
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: write helper language/volatility/return type changed unexpectedly';
  end if;

  select cfg into v_search_path_access
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_access_oid_after
    and cfg like 'search_path=%';

  if v_search_path_access is distinct from 'search_path=""' then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: access helper search_path not pinned to empty string (got %)',
      v_search_path_access;
  end if;

  select cfg into v_search_path_write
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_write_oid_after
    and cfg like 'search_path=%';

  if v_search_path_write is distinct from 'search_path=""' then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: write helper search_path not pinned to empty string (got %)',
      v_search_path_write;
  end if;

  if has_function_privilege('public', v_access_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: PUBLIC still has EXECUTE on access helper';
  end if;
  if has_function_privilege('anon', v_access_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: anon still has EXECUTE on access helper';
  end if;
  if not has_function_privilege('authenticated', v_access_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: authenticated is missing EXECUTE on access helper';
  end if;

  if has_function_privilege('public', v_write_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: PUBLIC still has EXECUTE on write helper';
  end if;
  if has_function_privilege('anon', v_write_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: anon still has EXECUTE on write helper';
  end if;
  if not has_function_privilege('authenticated', v_write_oid_after, 'EXECUTE') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: authenticated is missing EXECUTE on write helper';
  end if;

  -- ---------------------------------------------------------------------
  -- Schema security — fail closed on unexpected ownership, do not repair
  -- ---------------------------------------------------------------------
  select r.rolname into v_schema_owner
  from pg_namespace n
  join pg_roles r on r.oid = n.nspowner
  where n.nspname = 'drevora_private';

  if v_schema_owner is null then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: drevora_private schema does not exist';
  end if;

  if v_schema_owner in ('anon', 'authenticated', 'authenticator') then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: drevora_private is owned by untrusted role % — refusing to proceed (fail closed, ownership not auto-repaired)',
      v_schema_owner;
  end if;

  if has_schema_privilege('public', 'drevora_private', 'CREATE') then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: PUBLIC has CREATE on drevora_private';
  end if;
  if has_schema_privilege('anon', 'drevora_private', 'CREATE') then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: anon has CREATE on drevora_private';
  end if;
  if has_schema_privilege('authenticated', 'drevora_private', 'CREATE') then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: authenticated has CREATE on drevora_private';
  end if;
  if to_regrole('authenticator') is not null
     and has_schema_privilege('authenticator', 'drevora_private', 'CREATE') then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: authenticator has CREATE on drevora_private';
  end if;

  if not has_schema_privilege('authenticated', 'drevora_private', 'USAGE') then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: authenticated is missing USAGE on drevora_private';
  end if;
  if has_schema_privilege('anon', 'drevora_private', 'USAGE') then
    raise exception 'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: anon has USAGE on drevora_private';
  end if;

  -- ---------------------------------------------------------------------
  -- Policies — untouched objects; prove via pg_depend (OID-based), not
  -- fragile string matching. pg_policies text is checked only as a
  -- secondary confirmation.
  -- ---------------------------------------------------------------------
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'support_attachments_select_own',
      'support_attachments_insert_own',
      'support_attachments_delete_own'
    );

  if v_policy_count <> 3 then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: expected 3 support-attachments storage.objects policies, found %',
      v_policy_count;
  end if;

  if not exists (
    select 1
    from pg_policy pol
    where pol.polname = 'support_attachments_select_own'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'r'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_select_own command/role changed unexpectedly';
  end if;

  if not exists (
    select 1
    from pg_policy pol
    where pol.polname = 'support_attachments_insert_own'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'a'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_insert_own command/role changed unexpectedly';
  end if;

  if not exists (
    select 1
    from pg_policy pol
    where pol.polname = 'support_attachments_delete_own'
      and pol.polrelid = 'storage.objects'::regclass
      and pol.polcmd = 'd'
      and pol.polroles = array[to_regrole('authenticated')::oid]
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_delete_own command/role changed unexpectedly';
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
      and d.refobjid = v_access_oid_after
      and pol.polname = 'support_attachments_select_own'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_select_own no longer depends on the moved access-helper OID';
  end if;

  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_write_oid_after
      and pol.polname = 'support_attachments_insert_own'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_insert_own no longer depends on the moved write-helper OID';
  end if;

  if not exists (
    select 1
    from pg_depend d
    join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid = v_write_oid_after
      and pol.polname = 'support_attachments_delete_own'
      and pol.polrelid = 'storage.objects'::regclass
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_delete_own no longer depends on the moved write-helper OID';
  end if;

  -- Secondary confirmation only (not the source of truth): expressions
  -- should now deparse under the new schema name.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'support_attachments_select_own'
      and coalesce(qual, '') like '%drevora_private.drevora_storage_can_access_support_attachment%'
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_select_own does not deparse to drevora_private.* (secondary check)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'support_attachments_insert_own'
      and coalesce(with_check, '') like '%drevora_private.drevora_storage_can_write_support_attachment%'
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_insert_own does not deparse to drevora_private.* (secondary check)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'support_attachments_delete_own'
      and coalesce(qual, '') like '%drevora_private.drevora_storage_can_write_support_attachment%'
  ) then
    raise exception
      'MOVE_SUPPORT_STORAGE_HELPERS_ASSERT: support_attachments_delete_own does not deparse to drevora_private.* (secondary check)';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
