-- =============================================================================
-- DREVORA — Verify auth/company helper EXECUTE classification
-- File: supabase/diagnostics/20260802_verify_auth_company_helper_execute.sql
-- =============================================================================
-- PURPOSE
--   Verify 20260802160000_restrict_internal_auth_company_helper_execute.sql
--
-- RULES
--   Read-only only. Operator runs manually after applying the migration.
-- =============================================================================

with targets(sig, classification) as (
  values
    ('public.drevora_auth_user_belongs_to_company_id(uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_auth_user_company_ids()', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_auth_user_driver_company_text()', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_auth_user_driver_id()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_auth_user_has_office_role()', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_auth_user_has_office_role_for_company(uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_current_company_id()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_current_company_name()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_driver_in_company(uuid,uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_is_trusted_tenant_writer()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_resolve_unique_company_id(text)', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_vehicle_in_company(uuid,uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_vehicle_check_company_matches_auth_user(text)', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_company_text_matches_current(text)', 'RLS_OR_INVOKER_PRESERVED')
)
select
  t.sig,
  t.classification,
  case when p.oid is null then false else true end as exists,
  coalesce(p.prosecdef, false) as security_definer,
  coalesce(
    (
      select string_agg(cfg, ', ' order by cfg)
      from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
      where cfg like 'search_path=%'
    ),
    '(unset)'
  ) as search_path,
  case when p.oid is null then null
       else has_function_privilege('anon', p.oid, 'EXECUTE') end as anon_execute,
  case when p.oid is null then null
       else has_function_privilege('public', p.oid, 'EXECUTE') end as public_execute,
  case when p.oid is null then null
       else has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_execute,
  case when p.oid is null then null
       else has_function_privilege('service_role', p.oid, 'EXECUTE') end as service_role_execute,
  case
    when p.oid is null then 'MISSING'
    when t.classification = 'SAFE_INTERNAL_REVOKED'
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('public', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
      then 'SAFE_INTERNAL_REVOKED'
    when t.classification = 'RLS_OR_INVOKER_PRESERVED'
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('public', p.oid, 'EXECUTE')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
      then 'RLS_OR_INVOKER_PRESERVED'
    else 'FAIL_UNEXPECTED_STATE'
  end as result
from targets t
left join lateral (
  select p.*
  from pg_proc p
  where p.oid = to_regprocedure(t.sig)::oid
) p on true
order by t.classification, t.sig;

-- Summary counts
with targets(sig, classification) as (
  values
    ('public.drevora_auth_user_belongs_to_company_id(uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_auth_user_company_ids()', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_auth_user_driver_company_text()', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_auth_user_driver_id()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_auth_user_has_office_role()', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_auth_user_has_office_role_for_company(uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_current_company_id()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_current_company_name()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_driver_in_company(uuid,uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_is_trusted_tenant_writer()', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_resolve_unique_company_id(text)', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_vehicle_in_company(uuid,uuid)', 'RLS_OR_INVOKER_PRESERVED'),
    ('public.drevora_vehicle_check_company_matches_auth_user(text)', 'SAFE_INTERNAL_REVOKED'),
    ('public.drevora_company_text_matches_current(text)', 'RLS_OR_INVOKER_PRESERVED')
),
eval as (
  select
    t.classification,
    case
      when to_regprocedure(t.sig) is null then 'MISSING'
      when t.classification = 'SAFE_INTERNAL_REVOKED'
        and not has_function_privilege('authenticated', to_regprocedure(t.sig), 'EXECUTE')
        and not has_function_privilege('anon', to_regprocedure(t.sig), 'EXECUTE')
        then 'OK'
      when t.classification = 'RLS_OR_INVOKER_PRESERVED'
        and has_function_privilege('authenticated', to_regprocedure(t.sig), 'EXECUTE')
        and not has_function_privilege('anon', to_regprocedure(t.sig), 'EXECUTE')
        then 'OK'
      else 'FAIL'
    end as status
  from targets t
)
select
  classification,
  count(*) filter (where status = 'OK') as ok_count,
  count(*) filter (where status <> 'OK') as fail_count,
  case
    when count(*) filter (where status <> 'OK') = 0 then 'PASS'
    else 'FAIL'
  end as verdict
from eval
group by classification
order by classification;

-- Live policy dependency check: revoked helpers must not appear in policy expressions
select
  pol.schemaname,
  pol.tablename,
  pol.policyname,
  pol.cmd,
  case
    when strpos(coalesce(pol.qual, ''), 'drevora_auth_user_company_ids(') > 0
      or strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_company_ids(') > 0
      then 'FAIL_POLICY_USES_REVOKED_company_ids'
    when strpos(coalesce(pol.qual, ''), 'drevora_auth_user_driver_company_text(') > 0
      or strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_driver_company_text(') > 0
      then 'FAIL_POLICY_USES_REVOKED_driver_company_text'
    when (
        strpos(coalesce(pol.qual, ''), 'drevora_auth_user_has_office_role(') > 0
        and strpos(coalesce(pol.qual, ''), 'drevora_auth_user_has_office_role_for_company(') = 0
      )
      or (
        strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_has_office_role(') > 0
        and strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_has_office_role_for_company(') = 0
      )
      then 'FAIL_POLICY_USES_REVOKED_has_office_role'
    when strpos(coalesce(pol.qual, ''), 'drevora_resolve_unique_company_id(') > 0
      or strpos(coalesce(pol.with_check, ''), 'drevora_resolve_unique_company_id(') > 0
      then 'FAIL_POLICY_USES_REVOKED_resolve_unique'
    when strpos(coalesce(pol.qual, ''), 'drevora_vehicle_check_company_matches_auth_user(') > 0
      or strpos(coalesce(pol.with_check, ''), 'drevora_vehicle_check_company_matches_auth_user(') > 0
      then 'FAIL_POLICY_USES_REVOKED_vehicle_check_company_matches'
    else 'OK'
  end as classification
from pg_policies pol
where pol.schemaname in ('public', 'storage')
  and (
    strpos(coalesce(pol.qual, ''), 'drevora_auth_user_company_ids(') > 0
    or strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_company_ids(') > 0
    or strpos(coalesce(pol.qual, ''), 'drevora_auth_user_driver_company_text(') > 0
    or strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_driver_company_text(') > 0
    or (
      strpos(coalesce(pol.qual, ''), 'drevora_auth_user_has_office_role(') > 0
      and strpos(coalesce(pol.qual, ''), 'drevora_auth_user_has_office_role_for_company(') = 0
    )
    or (
      strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_has_office_role(') > 0
      and strpos(coalesce(pol.with_check, ''), 'drevora_auth_user_has_office_role_for_company(') = 0
    )
    or strpos(coalesce(pol.qual, ''), 'drevora_resolve_unique_company_id(') > 0
    or strpos(coalesce(pol.with_check, ''), 'drevora_resolve_unique_company_id(') > 0
    or strpos(coalesce(pol.qual, ''), 'drevora_vehicle_check_company_matches_auth_user(') > 0
    or strpos(coalesce(pol.with_check, ''), 'drevora_vehicle_check_company_matches_auth_user(') > 0
  )
order by classification, pol.tablename, pol.policyname;
