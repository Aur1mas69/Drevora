-- =============================================================================
-- Restrict internal auth/company SECURITY DEFINER helpers (EXECUTE + search_path)
-- File: supabase/migrations/20260802160000_restrict_internal_auth_company_helper_execute.sql
-- =============================================================================
-- SCOPE
--   Only the 14 listed auth/company helpers. Does NOT change business-action RPCs,
--   storage helpers, legal/document/tyre RPCs, or RLS policy definitions.
--
-- POSTGRESQL / RLS NOTE
--   Functions referenced directly from RLS policies, or from SECURITY INVOKER
--   triggers, require EXECUTE for the invoking role (authenticated). Revoking
--   those grants would break table access / writes. Nested calls from SECURITY
--   DEFINER owners use the owner's privileges and do not need client EXECUTE.
--
-- CLASSIFICATION (repository audit 2026-08-02)
--   SAFE_INTERNAL_REVOKED (no frontend RPC; not required by live RLS / INVOKER
--   trigger evaluation):
--     - public.drevora_auth_user_company_ids()
--     - public.drevora_auth_user_driver_company_text()
--     - public.drevora_auth_user_has_office_role()
--     - public.drevora_resolve_unique_company_id(text)
--     - public.drevora_vehicle_check_company_matches_auth_user(text)
--
--   FRONTEND_REQUIRED_PRESERVED is unused for this set (no supabase.rpc calls).
--
--   RLS_OR_INVOKER_PRESERVED (keep authenticated EXECUTE):
--     - public.drevora_auth_user_belongs_to_company_id(uuid)
--     - public.drevora_auth_user_driver_id()
--     - public.drevora_auth_user_has_office_role_for_company(uuid)
--     - public.drevora_current_company_id()
--     - public.drevora_current_company_name()
--     - public.drevora_company_text_matches_current(text)
--     - public.drevora_driver_in_company(uuid, uuid)
--     - public.drevora_vehicle_in_company(uuid, uuid)
--     - public.drevora_is_trusted_tenant_writer()
--
-- Also: harden search_path to '' for all 14 (bodies use fully-qualified names).
-- Idempotent. Do not auto-apply.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions — all 14 signatures must exist
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing text[] := array[]::text[];
  v_sig text;
  v_sigs text[] := array[
    'public.drevora_auth_user_belongs_to_company_id(uuid)',
    'public.drevora_auth_user_company_ids()',
    'public.drevora_auth_user_driver_company_text()',
    'public.drevora_auth_user_driver_id()',
    'public.drevora_auth_user_has_office_role()',
    'public.drevora_auth_user_has_office_role_for_company(uuid)',
    'public.drevora_current_company_id()',
    'public.drevora_current_company_name()',
    'public.drevora_driver_in_company(uuid,uuid)',
    'public.drevora_is_trusted_tenant_writer()',
    'public.drevora_resolve_unique_company_id(text)',
    'public.drevora_vehicle_in_company(uuid,uuid)',
    'public.drevora_vehicle_check_company_matches_auth_user(text)',
    'public.drevora_company_text_matches_current(text)'
  ];
begin
  foreach v_sig in array v_sigs loop
    if to_regprocedure(v_sig) is null then
      v_missing := array_append(v_missing, v_sig);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception
      'AUTH_HELPER_RESTRICT_PRECONDITION: missing function(s): %',
      array_to_string(v_missing, ', ');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Harden search_path for all 14 (fully-qualified bodies)
-- -----------------------------------------------------------------------------
alter function public.drevora_auth_user_belongs_to_company_id(uuid) set search_path = '';
alter function public.drevora_auth_user_company_ids() set search_path = '';
alter function public.drevora_auth_user_driver_company_text() set search_path = '';
alter function public.drevora_auth_user_driver_id() set search_path = '';
alter function public.drevora_auth_user_has_office_role() set search_path = '';
alter function public.drevora_auth_user_has_office_role_for_company(uuid) set search_path = '';
alter function public.drevora_current_company_id() set search_path = '';
alter function public.drevora_current_company_name() set search_path = '';
alter function public.drevora_driver_in_company(uuid, uuid) set search_path = '';
alter function public.drevora_is_trusted_tenant_writer() set search_path = '';
alter function public.drevora_resolve_unique_company_id(text) set search_path = '';
alter function public.drevora_vehicle_in_company(uuid, uuid) set search_path = '';
alter function public.drevora_vehicle_check_company_matches_auth_user(text) set search_path = '';
alter function public.drevora_company_text_matches_current(text) set search_path = '';

-- -----------------------------------------------------------------------------
-- 2) Deny public + anon EXECUTE on all 14
-- -----------------------------------------------------------------------------
revoke all privileges on function public.drevora_auth_user_belongs_to_company_id(uuid) from public;
revoke all privileges on function public.drevora_auth_user_belongs_to_company_id(uuid) from anon;
revoke all privileges on function public.drevora_auth_user_company_ids() from public;
revoke all privileges on function public.drevora_auth_user_company_ids() from anon;
revoke all privileges on function public.drevora_auth_user_driver_company_text() from public;
revoke all privileges on function public.drevora_auth_user_driver_company_text() from anon;
revoke all privileges on function public.drevora_auth_user_driver_id() from public;
revoke all privileges on function public.drevora_auth_user_driver_id() from anon;
revoke all privileges on function public.drevora_auth_user_has_office_role() from public;
revoke all privileges on function public.drevora_auth_user_has_office_role() from anon;
revoke all privileges on function public.drevora_auth_user_has_office_role_for_company(uuid) from public;
revoke all privileges on function public.drevora_auth_user_has_office_role_for_company(uuid) from anon;
revoke all privileges on function public.drevora_current_company_id() from public;
revoke all privileges on function public.drevora_current_company_id() from anon;
revoke all privileges on function public.drevora_current_company_name() from public;
revoke all privileges on function public.drevora_current_company_name() from anon;
revoke all privileges on function public.drevora_driver_in_company(uuid, uuid) from public;
revoke all privileges on function public.drevora_driver_in_company(uuid, uuid) from anon;
revoke all privileges on function public.drevora_is_trusted_tenant_writer() from public;
revoke all privileges on function public.drevora_is_trusted_tenant_writer() from anon;
revoke all privileges on function public.drevora_resolve_unique_company_id(text) from public;
revoke all privileges on function public.drevora_resolve_unique_company_id(text) from anon;
revoke all privileges on function public.drevora_vehicle_in_company(uuid, uuid) from public;
revoke all privileges on function public.drevora_vehicle_in_company(uuid, uuid) from anon;
revoke all privileges on function public.drevora_vehicle_check_company_matches_auth_user(text) from public;
revoke all privileges on function public.drevora_vehicle_check_company_matches_auth_user(text) from anon;
revoke all privileges on function public.drevora_company_text_matches_current(text) from public;
revoke all privileges on function public.drevora_company_text_matches_current(text) from anon;

-- -----------------------------------------------------------------------------
-- 3) SAFE_INTERNAL_REVOKED — no authenticated PostgREST EXECUTE
-- -----------------------------------------------------------------------------
revoke all privileges on function public.drevora_auth_user_company_ids() from authenticated;
revoke all privileges on function public.drevora_auth_user_driver_company_text() from authenticated;
revoke all privileges on function public.drevora_auth_user_has_office_role() from authenticated;
revoke all privileges on function public.drevora_resolve_unique_company_id(text) from authenticated;
revoke all privileges on function public.drevora_vehicle_check_company_matches_auth_user(text) from authenticated;

-- Preserve service_role for trusted SQL / maintenance (idempotent).
grant execute on function public.drevora_auth_user_company_ids() to service_role;
grant execute on function public.drevora_auth_user_driver_company_text() to service_role;
grant execute on function public.drevora_auth_user_has_office_role() to service_role;
grant execute on function public.drevora_resolve_unique_company_id(text) to service_role;
grant execute on function public.drevora_vehicle_check_company_matches_auth_user(text) to service_role;

comment on function public.drevora_auth_user_company_ids() is
  'Internal SECURITY DEFINER helper. Not a client RPC. EXECUTE: service_role/owner only; anon/authenticated denied.';
comment on function public.drevora_auth_user_driver_company_text() is
  'Legacy internal SECURITY DEFINER helper (company text). Not a client RPC. EXECUTE: service_role/owner only.';
comment on function public.drevora_auth_user_has_office_role() is
  'Internal SECURITY DEFINER helper used by trusted DEFINER RPCs. Not a client RPC. EXECUTE: service_role/owner only.';
comment on function public.drevora_resolve_unique_company_id(text) is
  'Internal SECURITY DEFINER backfill/resolution helper. Not a client RPC. EXECUTE: service_role/owner only.';
comment on function public.drevora_vehicle_check_company_matches_auth_user(text) is
  'Legacy internal SECURITY DEFINER helper. Not a client RPC. EXECUTE: service_role/owner only.';

-- -----------------------------------------------------------------------------
-- 4) RLS_OR_INVOKER_PRESERVED — authenticated EXECUTE required
-- -----------------------------------------------------------------------------
grant execute on function public.drevora_auth_user_belongs_to_company_id(uuid) to authenticated;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;
grant execute on function public.drevora_auth_user_has_office_role_for_company(uuid) to authenticated;
grant execute on function public.drevora_current_company_id() to authenticated;
grant execute on function public.drevora_current_company_name() to authenticated;
grant execute on function public.drevora_company_text_matches_current(text) to authenticated;
grant execute on function public.drevora_driver_in_company(uuid, uuid) to authenticated;
grant execute on function public.drevora_vehicle_in_company(uuid, uuid) to authenticated;
grant execute on function public.drevora_is_trusted_tenant_writer() to authenticated;

grant execute on function public.drevora_auth_user_belongs_to_company_id(uuid) to service_role;
grant execute on function public.drevora_auth_user_driver_id() to service_role;
grant execute on function public.drevora_auth_user_has_office_role_for_company(uuid) to service_role;
grant execute on function public.drevora_current_company_id() to service_role;
grant execute on function public.drevora_current_company_name() to service_role;
grant execute on function public.drevora_company_text_matches_current(text) to service_role;
grant execute on function public.drevora_driver_in_company(uuid, uuid) to service_role;
grant execute on function public.drevora_vehicle_in_company(uuid, uuid) to service_role;
grant execute on function public.drevora_is_trusted_tenant_writer() to service_role;

comment on function public.drevora_auth_user_belongs_to_company_id(uuid) is
  'SECURITY DEFINER RLS helper. Authenticated EXECUTE required for policy evaluation. search_path hardened.';
comment on function public.drevora_auth_user_driver_id() is
  'SECURITY DEFINER RLS/INVOKER-trigger helper. Authenticated EXECUTE required. search_path hardened.';
comment on function public.drevora_auth_user_has_office_role_for_company(uuid) is
  'SECURITY DEFINER RLS/INVOKER-trigger helper. Authenticated EXECUTE required. search_path hardened.';
comment on function public.drevora_current_company_id() is
  'Deprecated deny-stub / leftover-policy helper. Authenticated EXECUTE preserved so leftover policies do not error. search_path hardened.';
comment on function public.drevora_current_company_name() is
  'Deprecated deny-stub / leftover-policy helper. Authenticated EXECUTE preserved. search_path hardened.';
comment on function public.drevora_company_text_matches_current(text) is
  'Deprecated deny-stub / leftover-policy helper. Authenticated EXECUTE preserved. search_path hardened.';
comment on function public.drevora_driver_in_company(uuid, uuid) is
  'SECURITY DEFINER RLS helper. Authenticated EXECUTE required. search_path hardened.';
comment on function public.drevora_vehicle_in_company(uuid, uuid) is
  'SECURITY DEFINER RLS helper. Authenticated EXECUTE required. search_path hardened.';
comment on function public.drevora_is_trusted_tenant_writer() is
  'SECURITY DEFINER helper called from SECURITY INVOKER triggers. Authenticated EXECUTE required. search_path hardened.';

notify pgrst, 'reload schema';

commit;
