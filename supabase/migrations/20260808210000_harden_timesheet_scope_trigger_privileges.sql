-- Security Advisor hardening — Batch 1 (single function only).
-- Target: public.drevora_clear_driver_timesheet_settings_on_office_scope()
--
-- Advisor finding:
--   anon_security_definer_function_executable
--
-- ROOT CAUSE
--   This SECURITY DEFINER trigger function was created in
--   20260805183000_timesheet_management_scope_personal_overrides.sql without
--   an explicit `revoke all ... from public` block (unlike the sibling RPC
--   drevora_clear_company_driver_timesheet_settings(uuid) defined two
--   statements above it, which does have one). Its ACL therefore stayed at
--   the PostgreSQL default of EXECUTE TO PUBLIC, which anon and
--   authenticated both inherit.
--
-- WHY THIS IS SAFE TO REVOKE FROM EVERY ROLE INCLUDING service_role
--   - It returns `trigger` and is attached to exactly one trigger:
--     drevora_clear_driver_timesheet_settings_on_office_scope
--       after insert or update of timesheet_management_scope
--       on public.companies
--   - PostgreSQL invokes trigger functions internally; the firing role does
--     not need EXECUTE on the trigger function itself.
--   - No repository caller (frontend RPC, Edge Function, RLS policy,
--     Storage policy, or other database function) invokes this function
--     directly. It has no legitimate direct caller.
--
-- SCOPE
--   This migration touches ONLY this one function's privileges (+ its
--   search_path, see note below). No other SECURITY DEFINER function grant
--   is changed. No table, policy, or trigger definition is created,
--   dropped, or recreated. No data is modified.
--
-- search_path
--   Repinned to '' in this same batch: every object reference in the
--   function body (`public.driver_timesheet_settings`) is already fully
--   schema-qualified, and `new`/`old`/`tg_op` are trigger pseudo-variables
--   resolved independently of search_path, so this is safe without any
--   behavior change. Uses ALTER FUNCTION (not CREATE OR REPLACE) so the
--   function body, trigger attachment, and comment are all left untouched.
--
-- Idempotent; safe to re-run. Does NOT apply itself — run manually after
-- review.

begin;

do $$
begin
  if to_regprocedure(
    'public.drevora_clear_driver_timesheet_settings_on_office_scope()'
  ) is null then
    raise exception
      'HARDEN_TIMESHEET_SCOPE_TRIGGER_PRECONDITION: public.drevora_clear_driver_timesheet_settings_on_office_scope() missing — apply 20260805183000_timesheet_management_scope_personal_overrides.sql first';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgname = 'drevora_clear_driver_timesheet_settings_on_office_scope'
      and t.tgrelid = 'public.companies'::regclass
      and not t.tgisinternal
  ) then
    raise exception
      'HARDEN_TIMESHEET_SCOPE_TRIGGER_PRECONDITION: expected trigger drevora_clear_driver_timesheet_settings_on_office_scope on public.companies is missing';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Repin search_path (body already fully schema-qualified; trigger
--    attachment and comment are untouched by ALTER FUNCTION).
-- -----------------------------------------------------------------------------
alter function public.drevora_clear_driver_timesheet_settings_on_office_scope()
  set search_path = '';

-- -----------------------------------------------------------------------------
-- 2) Revoke direct EXECUTE from every role. Trigger firing does not require
--    EXECUTE on the trigger function for the firing role, so this cannot
--    break the trigger.
-- -----------------------------------------------------------------------------
revoke all on function public.drevora_clear_driver_timesheet_settings_on_office_scope()
  from public;
revoke all on function public.drevora_clear_driver_timesheet_settings_on_office_scope()
  from anon;
revoke all on function public.drevora_clear_driver_timesheet_settings_on_office_scope()
  from authenticated;
revoke all on function public.drevora_clear_driver_timesheet_settings_on_office_scope()
  from service_role;

comment on function public.drevora_clear_driver_timesheet_settings_on_office_scope() is
  'When companies.timesheet_management_scope becomes office, delete that company''s Worker Timesheet overrides. Trigger-only: no EXECUTE granted to any role (PUBLIC/anon/authenticated/service_role); PostgreSQL invokes trigger functions without requiring EXECUTE on the firing role.';

-- -----------------------------------------------------------------------------
-- 3) In-transaction assertions.
-- -----------------------------------------------------------------------------
do $$
declare
  v_oid regprocedure :=
    'public.drevora_clear_driver_timesheet_settings_on_office_scope()'::regprocedure;
  v_search_path text;
begin
  if has_function_privilege('public', v_oid, 'EXECUTE') then
    raise exception 'HARDEN_TIMESHEET_SCOPE_TRIGGER_ASSERT: PUBLIC still has EXECUTE';
  end if;

  if to_regrole('anon') is not null
     and has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception 'HARDEN_TIMESHEET_SCOPE_TRIGGER_ASSERT: anon still has EXECUTE';
  end if;

  if to_regrole('authenticated') is not null
     and has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'HARDEN_TIMESHEET_SCOPE_TRIGGER_ASSERT: authenticated still has EXECUTE';
  end if;

  if to_regrole('service_role') is not null
     and has_function_privilege('service_role', v_oid, 'EXECUTE') then
    raise exception 'HARDEN_TIMESHEET_SCOPE_TRIGGER_ASSERT: service_role still has EXECUTE';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgname = 'drevora_clear_driver_timesheet_settings_on_office_scope'
      and t.tgrelid = 'public.companies'::regclass
      and t.tgfoid = v_oid
      and not t.tgisinternal
  ) then
    raise exception 'HARDEN_TIMESHEET_SCOPE_TRIGGER_ASSERT: trigger attachment changed unexpectedly';
  end if;

  select cfg into v_search_path
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_oid
    and cfg like 'search_path=%';

  -- PostgreSQL's canonical pg_proc.proconfig entry for an empty-string
  -- search_path (SET search_path = '') is the literal text
  -- search_path="" (the value quoted as an empty string), not a bare
  -- trailing '='. Require that exact canonical form so this assertion
  -- cannot be satisfied by a missing/unset entry or by any non-empty
  -- value such as search_path=public.
  if v_search_path is distinct from 'search_path=""' then
    raise exception
      'HARDEN_TIMESHEET_SCOPE_TRIGGER_ASSERT: search_path not pinned to empty string (got %)',
      v_search_path;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
