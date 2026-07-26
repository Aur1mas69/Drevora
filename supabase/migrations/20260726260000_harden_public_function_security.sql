-- =============================================================================
-- DREVORA — Harden public function security (search_path + SECURITY DEFINER EXECUTE)
-- File: supabase/migrations/20260726260000_harden_public_function_security.sql
-- =============================================================================
-- PURPOSE
--   Resolve Supabase Security Advisor warnings:
--     1) Function Search Path Mutable
--     2) Public Can Execute SECURITY DEFINER Function
--   without changing business logic, security mode, signatures, volatility,
--   trigger attachment, RLS, table grants, rows, Auth users, or Storage objects.
--
-- AUDITED TARGETS (supported registry)
--   65 repository-audited public SECURITY DEFINER signatures:
--     - 47 authenticated allowlist (frontend RPC + RLS + Storage-policy helpers)
--     - 18 internal / trigger-only (no client EXECUTE)
--   Of those, 3 are version-optional when absent from a given deploy:
--     - public.drevora_create_company_with_trial_plan(text,text)
--     - public.drevora_enforce_vehicle_plan_allowance()
--     - public.drevora_enforce_worker_plan_allowance()
--   Required on this live version when those three are absent: 62.
--   Present optional signatures must still be SECURITY DEFINER and match
--   their audited classification, or the migration aborts.
--   No proname LIKE 'drevora_%' mutation. Unknown live DREVORA DEFINER = abort.
--
-- TRANSACTION ORDER
--   1) Role / schema CREATE preflight (anon + authenticated must not CREATE)
--   2) Exact signature / security-mode preflight
--   3) Target classification reconciliation
--   4) service_role effective-EXECUTE snapshot
--   5) Live-only updated_at safe-shape preflight (unsafe = abort)
--   6) Search_path target preflight
--   7) search_path ALTER
--   8) EXECUTE revoke/grant (+ explicit service_role restore)
--   9) In-transaction assertions
--  10) COMMIT
--  11) Commented diagnostics only
--
-- REVIEW ONLY — do not auto-apply.
-- Does NOT edit applied migrations 20260726180000–20260726250000.
-- =============================================================================

begin;

-- =============================================================================
-- 1) Role / schema CREATE preflight (before any mutation)
-- =============================================================================
do $$
declare
  v_anon_create boolean;
  v_auth_create boolean;
  v_authenticator_create boolean;
  v_service_create boolean;
  v_postgres_create boolean;
begin
  if to_regrole('service_role') is null then
    raise exception
      'DREVORA STOP 20260726260000: database role service_role does not exist';
  end if;

  if to_regrole('anon') is null or to_regrole('authenticated') is null then
    raise exception
      'DREVORA STOP 20260726260000: required roles anon/authenticated missing';
  end if;

  v_anon_create := has_schema_privilege('anon', 'public', 'CREATE');
  v_auth_create := has_schema_privilege('authenticated', 'public', 'CREATE');
  v_authenticator_create :=
    case
      when to_regrole('authenticator') is null then null
      else has_schema_privilege('authenticator', 'public', 'CREATE')
    end;
  v_service_create := has_schema_privilege('service_role', 'public', 'CREATE');
  v_postgres_create :=
    case
      when to_regrole('postgres') is null then null
      else has_schema_privilege('postgres', 'public', 'CREATE')
    end;

  raise notice
    'DREVORA 20260726260000 CREATE privilege on schema public: anon=%, authenticated=%, authenticator=%, service_role=%, postgres=%',
    v_anon_create, v_auth_create, v_authenticator_create, v_service_create, v_postgres_create;

  if v_anon_create or v_auth_create then
    raise exception
      'DREVORA STOP 20260726260000: untrusted role has CREATE on schema public (anon=%, authenticated=%). Aborting before hardening because ~45 SECURITY DEFINER helpers remain on search_path=public and would be exposed to object shadowing.',
      v_anon_create, v_auth_create;
  end if;
end;
$$;

-- =============================================================================
-- 2–9) Exact-signature hardening (single DO block for shared state)
-- =============================================================================
do $$
declare
  -- -------------------------------------------------------------------------
  -- Exact authenticated allowlist (47) — frontend RPC + RLS + Storage DEFINER
  -- -------------------------------------------------------------------------
  v_auth_allowlist text[] := array[
    -- Frontend RPCs (15)
    'public.drevora_archive_driver(uuid)',
    'public.drevora_restore_driver(uuid)',
    'public.drevora_auth_worker_access_status()',
    'public.drevora_archive_vehicle(uuid,text,date)',
    'public.drevora_restore_vehicle(uuid)',
    'public.drevora_approve_timesheets(uuid,uuid[])',
    'public.drevora_reject_timesheets(uuid,uuid[])',
    'public.drevora_clean_timesheets_current_view(uuid,date,date)',
    'public.drevora_create_worker_document_submission(uuid,uuid,text,text,text,text,jsonb)',
    'public.drevora_review_worker_document_submission(uuid,uuid,text,text)',
    'public.drevora_update_worker_document_submission_metadata(uuid,uuid,text,text,text,text)',
    'public.drevora_soft_delete_worker_document_submission(uuid,uuid,text)',
    'public.drevora_restore_worker_document_submission(uuid,uuid)',
    'public.drevora_create_company_with_trial_plan(text,text)',
    'public.drevora_generate_expiry_notifications()',
    -- RLS helpers (17)
    'public.drevora_auth_user_belongs_to_company_id(uuid)',
    'public.drevora_auth_user_can_manage_vehicle_check_templates()',
    'public.drevora_auth_user_company_ids()',
    'public.drevora_auth_user_driver_company_text()',
    'public.drevora_auth_user_driver_id()',
    'public.drevora_auth_user_has_office_role()',
    'public.drevora_auth_user_has_office_role_for_company(uuid)',
    'public.drevora_calculate_holiday_day_breakdown(uuid,date,date)',
    'public.drevora_company_text_matches_current(text)',
    'public.drevora_current_company_id()',
    'public.drevora_current_company_name()',
    'public.drevora_driver_in_company(uuid,uuid)',
    'public.drevora_vehicle_in_company(uuid,uuid)',
    'public.drevora_is_trusted_tenant_writer()',
    'public.drevora_worker_holiday_leave_type(uuid)',
    'public.drevora_vehicle_check_company_matches_auth_user(text)',
    'public.drevora_resolve_unique_company_id(text)',
    -- Storage-policy DEFINER helpers (15)
    'public.drevora_storage_object_company_id(text,text)',
    'public.drevora_storage_can_select_worker_avatar(text)',
    'public.drevora_storage_can_write_worker_avatar(text)',
    'public.drevora_storage_can_select_vehicle_check_file(text)',
    'public.drevora_storage_can_write_vehicle_check_file(text)',
    'public.drevora_storage_can_delete_vehicle_check_file(text)',
    'public.drevora_storage_can_select_consumable_receipt(text)',
    'public.drevora_storage_can_write_consumable_receipt(text)',
    'public.drevora_storage_can_select_document_file(text)',
    'public.drevora_storage_can_write_document_file(text)',
    'public.drevora_storage_can_select_driver_report_file(text)',
    'public.drevora_storage_can_write_driver_report_file(text)',
    'public.drevora_storage_can_select_worker_submission_file(text)',
    'public.drevora_storage_can_write_worker_submission_file(text)',
    'public.drevora_storage_can_delete_worker_submission_staging_file(text)'
  ];

  -- -------------------------------------------------------------------------
  -- Exact internal / trigger SECURITY DEFINER (18) — no authenticated EXECUTE
  -- -------------------------------------------------------------------------
  v_internal_definer text[] := array[
    'public.drevora_enforce_vehicle_plan_allowance()',
    'public.drevora_enforce_worker_plan_allowance()',
    'public.drevora_insert_admin_notification(uuid,text,text,text,text,text,uuid,text,text,jsonb)',
    'public.drevora_notification_resolve_company_id(uuid,uuid,uuid)',
    'public.drevora_notification_vehicle_label(uuid)',
    'public.drevora_notification_worker_label(uuid)',
    'public.drevora_notify_driver_report_created()',
    'public.drevora_notify_holiday_request_created()',
    'public.drevora_notify_timesheet_submitted()',
    'public.drevora_notify_tyre_check_critical()',
    'public.drevora_notify_vehicle_check_attention()',
    'public.drevora_tyre_check_has_complete_layout(uuid)',
    'public.drevora_tyre_check_items_after_change()',
    'public.drevora_tyre_check_items_before_write()',
    'public.drevora_tyre_check_refresh_summary(uuid)',
    'public.drevora_tyre_check_resolve_trailer_snapshot(uuid,uuid,uuid,smallint)',
    'public.drevora_tyre_checks_before_insert()',
    'public.drevora_tyre_checks_before_write()'
  ];

  -- Version-optional DEFINER signatures (absent on some deploys is OK).
  -- If present: must be SECURITY DEFINER with this exact signature/classification.
  v_optional_definer text[] := array[
    'public.drevora_create_company_with_trial_plan(text,text)',
    'public.drevora_enforce_vehicle_plan_allowance()',
    'public.drevora_enforce_worker_plan_allowance()'
  ];

  -- Required search_path = '' INVOKER targets (repository-verified bodies).
  v_search_path_required text[] := array[
    'public.drevora_set_updated_at()',
    'public.set_vehicle_check_template_updated_at()',
    'public.generate_worker_code()',
    'public.generate_unique_worker_code(text)',
    'public.drivers_set_worker_code()',
    'public.drevora_protect_company_plan_columns()',
    'public.drevora_active_worker_limit_for_plan(text)',
    'public.drevora_active_vehicle_limit_for_plan(text)'
  ];

  -- Optional INVOKER helpers from 20260726140000 (expected present on current project).
  v_search_path_optional text[] := array[
    'public.drevora_normalize_worker_core_document_type(text)',
    'public.drevora_worker_core_document_status(date)'
  ];

  -- Live-only Advisor updated_at helpers (exact signatures only).
  v_live_updated_at text[] := array[
    'public.set_contacts_updated_at()',
    'public.set_documents_updated_at()',
    'public.set_driver_reports_updated_at()'
  ];

  v_union text[];
  v_sig text;
  v_reg regprocedure;
  v_oid oid;
  v_missing text[] := array[]::text[];
  v_wrong_mode text[] := array[]::text[];
  v_overlap text[] := array[]::text[];
  v_unclassified text[] := array[]::text[];
  v_outside text[] := array[]::text[];
  v_optional_absent text[] := array[]::text[];
  v_auth_oids oid[] := array[]::oid[];
  v_internal_oids oid[] := array[]::oid[];
  v_union_oids oid[] := array[]::oid[];
  v_service_before jsonb := '{}'::jsonb;
  v_service_need_grant oid[] := array[]::oid[];
  v_acl_targets oid[] := array[]::oid[];
  v_live_harden text[] := array[]::text[];
  v_registry_count int;
  v_optional_count int;
  v_optional_absent_count int;
  v_expected_resolved int;
  r record;
  v_args text;
  v_is_trigger boolean;
  v_prosecdef boolean;
  v_prolang name;
  v_provolatile char;
  v_prosrc text;
  v_prosrc_scrub text;
  -- Executable-token view of prosrc: string literals and comments removed,
  -- and the SQL keyword operators that legitimately contain FROM neutralised.
  -- Used for negative token checks only; positive invariants read v_prosrc.
  v_prosrc_exec text;
  v_ret text;
  v_had boolean;
  v_fn_txt text;
  v_invoker_no_client text[] := array[
    'public.drevora_set_updated_at()',
    'public.set_vehicle_check_template_updated_at()',
    'public.drivers_set_worker_code()',
    'public.drevora_protect_company_plan_columns()',
    'public.drevora_active_worker_limit_for_plan(text)',
    'public.drevora_active_vehicle_limit_for_plan(text)'
  ];
  v_invoker_worker_code text[] := array[
    'public.generate_worker_code()',
    'public.generate_unique_worker_code(text)'
  ];
begin
  -- -------------------------------------------------------------------------
  -- 2) Build exact supported union (65) and reject auth/internal overlap
  -- -------------------------------------------------------------------------
  if cardinality(v_auth_allowlist) <> 47 then
    raise exception
      'DREVORA STOP 20260726260000: authenticated allowlist cardinality % <> 47',
      cardinality(v_auth_allowlist);
  end if;
  if cardinality(v_internal_definer) <> 18 then
    raise exception
      'DREVORA STOP 20260726260000: internal DEFINER cardinality % <> 18',
      cardinality(v_internal_definer);
  end if;
  if cardinality(v_optional_definer) <> 3 then
    raise exception
      'DREVORA STOP 20260726260000: optional DEFINER cardinality % <> 3',
      cardinality(v_optional_definer);
  end if;

  foreach v_sig in array v_auth_allowlist loop
    if v_sig = any (v_internal_definer) then
      v_overlap := array_append(v_overlap, v_sig);
    end if;
  end loop;
  if cardinality(v_overlap) > 0 then
    raise exception
      'DREVORA STOP 20260726260000: signature(s) in both auth and internal lists: %',
      array_to_string(v_overlap, ', ');
  end if;

  -- Every optional signature must appear in exactly one classification array.
  foreach v_sig in array v_optional_definer loop
    if not (
      (v_sig = any (v_auth_allowlist) and not (v_sig = any (v_internal_definer)))
      or (v_sig = any (v_internal_definer) and not (v_sig = any (v_auth_allowlist)))
    ) then
      raise exception
        'DREVORA STOP 20260726260000: optional DEFINER % is not classified in exactly one of auth/internal registries',
        v_sig;
    end if;
  end loop;

  v_union := v_auth_allowlist || v_internal_definer;
  v_registry_count := cardinality(v_union);
  v_optional_count := cardinality(v_optional_definer);
  if v_registry_count <> 65 then
    raise exception
      'DREVORA STOP 20260726260000: supported DEFINER registry cardinality % <> 65',
      v_registry_count;
  end if;

  -- -------------------------------------------------------------------------
  -- 3) Resolve DEFINER targets; optional absences tracked; wrong mode aborts
  -- -------------------------------------------------------------------------
  foreach v_sig in array v_union loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      if v_sig = any (v_optional_definer) then
        -- Exact audited signature absent is OK only when no same-name overload exists.
        -- Wrong signature / ambiguous overload of an optional name is fail-closed.
        if exists (
          select 1
          from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = split_part(split_part(v_sig, '(', 1), '.', 2)
        ) then
          raise exception
            'DREVORA STOP 20260726260000: optional DEFINER % missing at audited signature but same-name public function(s) exist (wrong signature/overload)',
            v_sig;
        end if;
        v_optional_absent := array_append(v_optional_absent, v_sig);
        raise notice
          'DREVORA 20260726260000: version-optional DEFINER absent (not hardened): %',
          v_sig;
        continue;
      end if;
      v_missing := array_append(v_missing, v_sig);
      continue;
    end if;

    select p.oid, p.prosecdef
      into v_oid, v_prosecdef
    from pg_catalog.pg_proc p
    where p.oid = v_reg::oid;

    -- Present optional/required signature with wrong security mode is fail-closed.
    if not v_prosecdef then
      v_wrong_mode := array_append(v_wrong_mode, v_sig);
      continue;
    end if;

    v_union_oids := array_append(v_union_oids, v_oid);
    if v_sig = any (v_auth_allowlist) then
      v_auth_oids := array_append(v_auth_oids, v_oid);
    else
      v_internal_oids := array_append(v_internal_oids, v_oid);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception
      'DREVORA STOP 20260726260000: required SECURITY DEFINER signature(s) missing: %',
      array_to_string(v_missing, ', ');
  end if;
  if cardinality(v_wrong_mode) > 0 then
    raise exception
      'DREVORA STOP 20260726260000: expected SECURITY DEFINER but found otherwise: %',
      array_to_string(v_wrong_mode, ', ');
  end if;

  -- Only signatures listed in v_optional_definer may be absent (enforced above).
  foreach v_sig in array v_optional_absent loop
    if not (v_sig = any (v_optional_definer)) then
      raise exception
        'DREVORA STOP 20260726260000: non-optional signature recorded as optional-absent: %',
        v_sig;
    end if;
  end loop;

  v_optional_absent_count := coalesce(cardinality(v_optional_absent), 0);
  v_expected_resolved := v_registry_count - v_optional_absent_count;

  if coalesce(cardinality(v_union_oids), 0) <> v_expected_resolved then
    raise exception
      'DREVORA STOP 20260726260000: resolved DEFINER OID count % <> expected % (registry=% optional_absent=% [%])',
      coalesce(cardinality(v_union_oids), 0),
      v_expected_resolved,
      v_registry_count,
      v_optional_absent_count,
      coalesce(array_to_string(v_optional_absent, ', '), '');
  end if;

  raise notice
    'DREVORA 20260726260000: DEFINER registry=% optional=% optional_absent=% expected_resolved=% resolved_auth=% resolved_internal=%',
    v_registry_count,
    v_optional_count,
    v_optional_absent_count,
    v_expected_resolved,
    coalesce(cardinality(v_auth_oids), 0),
    coalesce(cardinality(v_internal_oids), 0);

  -- Live public SECURITY DEFINER outside exact union.
  for r in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and not (p.oid = any (v_union_oids))
  loop
    v_fn_txt := format('public.%I(%s)', r.proname, r.identity_args);
    v_outside := array_append(v_outside, v_fn_txt);
    -- Literal prefix (LIKE '_' is a wildcard; do not use drevora_%).
    if left(r.proname, 8) = 'drevora_' then
      v_unclassified := array_append(v_unclassified, v_fn_txt);
    else
      raise notice
        'DREVORA 20260726260000: non-target public SECURITY DEFINER left untouched: %',
        v_fn_txt;
    end if;
  end loop;

  if cardinality(v_unclassified) > 0 then
    raise exception
      'DREVORA STOP 20260726260000: live DREVORA-owned SECURITY DEFINER function(s) outside audited exact union (Advisor risk): %',
      array_to_string(v_unclassified, ', ');
  end if;

  if cardinality(v_outside) > 0 then
    raise notice
      'DREVORA 20260726260000: % public SECURITY DEFINER function(s) outside audited union (untouched)',
      cardinality(v_outside);
  end if;

  -- -------------------------------------------------------------------------
  -- 4) Required search_path INVOKER preflight (body checks use p.prosrc only)
  -- -------------------------------------------------------------------------
  foreach v_sig in array v_search_path_required loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      raise exception
        'DREVORA STOP 20260726260000: required search_path target missing: %',
        v_sig;
    end if;

    select
      p.prosecdef,
      l.lanname,
      p.provolatile,
      pg_get_function_result(p.oid),
      p.prosrc
    into v_prosecdef, v_prolang, v_provolatile, v_ret, v_prosrc
    from pg_catalog.pg_proc p
    join pg_catalog.pg_language l on l.oid = p.prolang
    where p.oid = v_reg::oid;

    if v_prosecdef then
      raise exception
        'DREVORA STOP 20260726260000: search_path target % is SECURITY DEFINER (expected INVOKER)',
        v_sig;
    end if;

    if v_sig in (
      'public.drevora_set_updated_at()',
      'public.set_vehicle_check_template_updated_at()',
      'public.drivers_set_worker_code()',
      'public.drevora_protect_company_plan_columns()'
    ) then
      if v_ret is distinct from 'trigger' then
        raise exception
          'DREVORA STOP 20260726260000: % return type % <> trigger',
          v_sig, v_ret;
      end if;
      if v_prolang is distinct from 'plpgsql' then
        raise exception
          'DREVORA STOP 20260726260000: % language % <> plpgsql',
          v_sig, v_prolang;
      end if;
    end if;

    -- Relation-free updated_at triggers (NEW/OLD + timestamp builtins only).
    if v_sig in (
      'public.drevora_set_updated_at()',
      'public.set_vehicle_check_template_updated_at()'
    ) then
      if v_prosrc is null
         or v_prosrc !~* 'new\.updated_at\s*(:=|=)\s*(now\s*\(\s*\)|clock_timestamp\s*\(\s*\)|current_timestamp(\s*\(\s*\))?)'
         or v_prosrc !~* 'return\s+new\s*;'
         or v_prosrc ~* '\y(insert|delete|execute|perform)\y'
         or v_prosrc ~* '\y(from|join)\s+[a-z_][a-z0-9_]*'
         or v_prosrc ~* '\yupdate\s+[a-z_][a-z0-9_]*'
         or v_prosrc ~* '\y(public|auth|storage)\.'
      then
        raise exception
          'DREVORA STOP 20260726260000: % prosrc is not a verified relation-free updated_at trigger',
          v_sig;
      end if;
    end if;

    if v_sig = 'public.generate_worker_code()' then
      if v_ret is distinct from 'text' or v_prolang is distinct from 'plpgsql' then
        raise exception
          'DREVORA STOP 20260726260000: generate_worker_code unexpected ret/lang (% / %)',
          v_ret, v_prolang;
      end if;
      -- Allow FROM unnest(...); reject other FROM/JOIN and project schema refs.
      v_prosrc_scrub := regexp_replace(lower(v_prosrc), 'from\s+unnest\s*\(', '', 'g');
      if v_prosrc ~* '\y(public|auth|storage)\.'
         or v_prosrc ~* '\ydrevora_'
         or v_prosrc ~* '\y(insert|delete|execute|perform)\y'
         or v_prosrc ~* '\yupdate\s+[a-z_][a-z0-9_]*'
         or v_prosrc_scrub ~ '\yfrom\s+[a-z_][a-z0-9_]*'
         or v_prosrc_scrub ~ '\yjoin\s+[a-z_][a-z0-9_]*'
      then
        raise exception
          'DREVORA STOP 20260726260000: generate_worker_code prosrc is not relation-free as audited';
      end if;
    end if;

    if v_sig = 'public.generate_unique_worker_code(text)' then
      if v_ret is distinct from 'text' or v_prolang is distinct from 'plpgsql' then
        raise exception
          'DREVORA STOP 20260726260000: generate_unique_worker_code unexpected ret/lang (% / %)',
          v_ret, v_prolang;
      end if;
      if v_prosrc !~* 'public\.generate_worker_code\s*\('
         or v_prosrc !~* 'public\.drivers\y' then
        raise exception
          'DREVORA STOP 20260726260000: generate_unique_worker_code prosrc missing required public.* qualifications';
      end if;
      -- Remove verified public-qualified forms, then reject any remaining bare tokens / FROM.
      v_prosrc_scrub := lower(v_prosrc);
      v_prosrc_scrub := regexp_replace(v_prosrc_scrub, 'public\.generate_worker_code\s*\(', '', 'g');
      v_prosrc_scrub := regexp_replace(v_prosrc_scrub, 'from\s+public\.drivers\y', '', 'g');
      v_prosrc_scrub := regexp_replace(v_prosrc_scrub, 'public\.drivers\y', '', 'g');
      if v_prosrc_scrub ~ '\ygenerate_worker_code\y'
         or v_prosrc_scrub ~ '\ydrivers\y'
         or v_prosrc_scrub ~ '\yfrom\s+[a-z_][a-z0-9_]*'
         or v_prosrc_scrub ~ '\yjoin\s+[a-z_][a-z0-9_]*'
         or v_prosrc ~* '\y(insert|delete|execute|perform)\y'
         or v_prosrc ~* '\yupdate\s+[a-z_][a-z0-9_]*'
         or v_prosrc ~* '\y(auth|storage)\.'
      then
        raise exception
          'DREVORA STOP 20260726260000: generate_unique_worker_code prosrc has unqualified or unexpected project references';
      end if;
    end if;

    if v_sig = 'public.drivers_set_worker_code()' then
      if v_prosrc !~* 'public\.generate_unique_worker_code\s*\(' then
        raise exception
          'DREVORA STOP 20260726260000: drivers_set_worker_code prosrc missing public.generate_unique_worker_code call';
      end if;
      -- Remove verified public-qualified helper calls; reject any remaining bare helper / table work.
      v_prosrc_scrub := regexp_replace(
        lower(v_prosrc),
        'public\.generate_unique_worker_code\s*\(',
        '',
        'g'
      );
      if v_prosrc_scrub ~ '\ygenerate_unique_worker_code\y'
         or v_prosrc_scrub ~ '\ypublic\.'
         or v_prosrc ~* '\y(from|join|insert|delete|execute|perform)\y'
         or v_prosrc ~* '\yupdate\s+[a-z_][a-z0-9_]*'
         or v_prosrc ~* '\y(auth|storage)\.'
      then
        raise exception
          'DREVORA STOP 20260726260000: drivers_set_worker_code prosrc has unexpected table/project references';
      end if;
    end if;

    if v_sig = 'public.drevora_protect_company_plan_columns()' then
      -- Negative checks run against the executable-token view so that text
      -- inside PL/pgSQL string literals cannot be mistaken for SQL:
      --   TG_OP = 'UPDATE'                       -> not a table UPDATE
      --   current_setting('drevora.allow_plan_write', true) -> not a project call
      -- IS [NOT] DISTINCT FROM is a comparison operator, not a FROM clause,
      -- and TRIM([BOTH|LEADING|TRAILING] FROM x) is not a FROM clause either.
      v_prosrc_exec := coalesce(v_prosrc, '');
      -- 1) single-quoted literals, including doubled '' escapes
      v_prosrc_exec := regexp_replace(v_prosrc_exec, '''([^'']|'''')*''', ' ', 'g');
      -- 2) line comments, then block comments
      v_prosrc_exec := regexp_replace(v_prosrc_exec, '--[^\n]*', ' ', 'g');
      v_prosrc_exec := regexp_replace(v_prosrc_exec, '/\*.*?\*/', ' ', 'g');
      -- 3) FROM-bearing keyword operators (never relation references)
      v_prosrc_exec := regexp_replace(
        v_prosrc_exec, '\yis\s+(not\s+)?distinct\s+from\y', ' <> ', 'gi');
      v_prosrc_exec := regexp_replace(
        v_prosrc_exec, '\ytrim\s*\(\s*(both\s+|leading\s+|trailing\s+)?from\y', 'trim(', 'gi');

      if v_prosrc_exec ~* '\y(select|from|join|insert|delete|execute|perform|merge|truncate|copy|returning)\y'
         or v_prosrc_exec ~* '\yupdate\s+[a-z_"]'
         or v_prosrc_exec ~* '\y(public|auth|storage|extensions|pg_catalog|information_schema)\.'
         or v_prosrc_exec ~* '\ydrevora_[a-z0-9_]*\s*\('
      then
        raise exception
          'DREVORA STOP 20260726260000: drevora_protect_company_plan_columns prosrc has unexpected relation/project calls';
      end if;

      -- Positive invariants read the ORIGINAL body (quoted text is meaningful).
      if coalesce(v_prosrc, '') !~* 'tg_op\s*=\s*''update'''
         or v_prosrc !~* 'current_setting\s*\(\s*''drevora\.allow_plan_write''\s*,\s*true\s*\)'
         or v_prosrc !~* 'distinct\s+from\s+''on'''
         or v_prosrc !~* 'new\.plan_code\y\s*(:=|=)\s*old\.plan_code\y'
         or v_prosrc !~* 'new\.plan_selected_at\y\s*(:=|=)\s*old\.plan_selected_at\y'
         or v_prosrc !~* 'new\.trial_started_at\y\s*(:=|=)\s*old\.trial_started_at\y'
         or v_prosrc !~* 'new\.subscription_status\y\s*(:=|=)\s*old\.subscription_status\y'
         or v_prosrc !~* 'new\.subscription_valid_until\y\s*(:=|=)\s*old\.subscription_valid_until\y'
         or v_prosrc !~* 'return\s+new\s*;'
      then
        raise exception
          'DREVORA STOP 20260726260000: drevora_protect_company_plan_columns prosrc is missing the audited TG_OP/current_setting guard or a protected NEW-from-OLD assignment';
      end if;
    end if;

    if v_sig in (
      'public.drevora_active_worker_limit_for_plan(text)',
      'public.drevora_active_vehicle_limit_for_plan(text)'
    ) then
      if v_ret is distinct from 'integer' or v_prolang is distinct from 'sql' then
        raise exception
          'DREVORA STOP 20260726260000: % unexpected ret/lang (% / %)',
          v_sig, v_ret, v_prolang;
      end if;
      if v_provolatile is distinct from 'i' then
        raise exception
          'DREVORA STOP 20260726260000: % expected IMMUTABLE',
          v_sig;
      end if;
      if v_prosrc ~* '\y(from|join|insert|update|delete|execute|perform)\y'
         or v_prosrc ~* '\y(public|auth|storage)\.'
      then
        raise exception
          'DREVORA STOP 20260726260000: % prosrc is not a relation-free expression',
          v_sig;
      end if;
    end if;
  end loop;

  -- Optional core-document INVOKER helpers (140000 expected on current project).
  foreach v_sig in array v_search_path_optional loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      raise notice
        'DREVORA 20260726260000: OPTIONAL search_path helper ABSENT (unexpected if 20260726140000 applied): %',
        v_sig;
      continue;
    end if;

    select p.prosecdef, pg_get_function_result(p.oid), p.prosrc
      into v_prosecdef, v_ret, v_prosrc
    from pg_catalog.pg_proc p
    where p.oid = v_reg::oid;

    if v_prosecdef then
      raise exception
        'DREVORA STOP 20260726260000: optional helper % is SECURITY DEFINER (expected INVOKER)',
        v_sig;
    end if;
    if v_ret is distinct from 'text' then
      raise exception
        'DREVORA STOP 20260726260000: optional helper % return type % <> text',
        v_sig, v_ret;
    end if;
    -- Same executable-token view as the plan-protection check: the canonical
    -- normalize helper uses TRIM(BOTH FROM coalesce(...)) and quoted document
    -- type labels, neither of which is a relation reference.
    v_prosrc_exec := coalesce(v_prosrc, '');
    v_prosrc_exec := regexp_replace(v_prosrc_exec, '''([^'']|'''')*''', ' ', 'g');
    v_prosrc_exec := regexp_replace(v_prosrc_exec, '--[^\n]*', ' ', 'g');
    v_prosrc_exec := regexp_replace(v_prosrc_exec, '/\*.*?\*/', ' ', 'g');
    v_prosrc_exec := regexp_replace(
      v_prosrc_exec, '\yis\s+(not\s+)?distinct\s+from\y', ' <> ', 'gi');
    v_prosrc_exec := regexp_replace(
      v_prosrc_exec, '\ytrim\s*\(\s*(both\s+|leading\s+|trailing\s+)?from\y', 'trim(', 'gi');

    if v_prosrc_exec ~* '\y(from|join|insert|update|delete|execute|perform)\y'
       or v_prosrc_exec ~* '\y(public|auth|storage)\.'
    then
      raise exception
        'DREVORA STOP 20260726260000: optional helper % prosrc is not relation-free as audited',
        v_sig;
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- 5) Live-only updated_at preflight (p.prosrc only; present+unsafe => abort)
  -- -------------------------------------------------------------------------
  foreach v_sig in array v_live_updated_at loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      raise notice
        'DREVORA 20260726260000: live-only % absent (repo uses public.drevora_set_updated_at()); OK',
        v_sig;
      continue;
    end if;

    select
      pg_get_function_identity_arguments(p.oid),
      p.prorettype = 'pg_catalog.trigger'::regtype,
      p.prosecdef,
      p.prosrc
    into v_args, v_is_trigger, v_prosecdef, v_prosrc
    from pg_catalog.pg_proc p
    where p.oid = v_reg::oid;

    if v_args is distinct from '' then
      raise exception
        'DREVORA STOP 20260726260000: live-only % has non-empty identity args (%); refusing partial hardening',
        v_sig, v_args;
    end if;
    if not v_is_trigger then
      raise exception
        'DREVORA STOP 20260726260000: live-only % does not return trigger; refusing partial hardening',
        v_sig;
    end if;
    if v_prosecdef then
      raise exception
        'DREVORA STOP 20260726260000: live-only % is SECURITY DEFINER; refusing without verified body rewrite',
        v_sig;
    end if;

    -- Accept now() / clock_timestamp() / CURRENT_TIMESTAMP / CURRENT_TIMESTAMP()
    if v_prosrc is null
       or v_prosrc !~* 'new\.updated_at\s*(:=|=)\s*(now\s*\(\s*\)|clock_timestamp\s*\(\s*\)|current_timestamp(\s*\(\s*\))?)'
       or v_prosrc !~* 'return\s+new\s*;'
       or v_prosrc ~* '\y(insert|delete|execute|perform)\y'
       or v_prosrc ~* '\y(from|join)\s+[a-z_][a-z0-9_]*'
       or v_prosrc ~* '\yupdate\s+[a-z_][a-z0-9_]*'
       or v_prosrc ~* '\y(public|auth|storage)\.'
    then
      raise exception
        'DREVORA STOP 20260726260000: live-only % prosrc is not a verified relation-free updated_at trigger; refusing partial hardening',
        v_sig;
    end if;

    v_live_harden := array_append(v_live_harden, v_sig);
  end loop;

  -- -------------------------------------------------------------------------
  -- 6) service_role effective-EXECUTE snapshot (before PUBLIC revoke)
  --    Targets: all DEFINER union + search_path INVOKER privilege targets +
  --    live-only helpers that will be hardened.
  -- -------------------------------------------------------------------------
  v_acl_targets := v_union_oids;

  foreach v_sig in array (v_search_path_required || v_search_path_optional || v_live_harden) loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      continue;
    end if;
    if not (v_reg::oid = any (v_acl_targets)) then
      v_acl_targets := array_append(v_acl_targets, v_reg::oid);
    end if;
  end loop;

  foreach v_oid in array v_acl_targets loop
    v_had := has_function_privilege('service_role', v_oid, 'execute');
    v_service_before := v_service_before || jsonb_build_object(v_oid::text, v_had);
    if v_had then
      v_service_need_grant := array_append(v_service_need_grant, v_oid);
    end if;
  end loop;

  raise notice
    'DREVORA 20260726260000: service_role previously had effective EXECUTE on % / % ACL targets',
    cardinality(v_service_need_grant), cardinality(v_acl_targets);

  -- =========================================================================
  -- MUTATIONS BEGIN (all blockers above already evaluated)
  -- =========================================================================

  -- -------------------------------------------------------------------------
  -- 7) search_path ALTER for required INVOKER targets
  -- -------------------------------------------------------------------------
  foreach v_sig in array v_search_path_required loop
    v_reg := to_regprocedure(v_sig);
    execute format('alter function %s set search_path = %L', v_reg, '');
  end loop;

  foreach v_sig in array v_search_path_optional loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      continue;
    end if;
    execute format('alter function %s set search_path = %L', v_reg, '');
  end loop;

  foreach v_sig in array v_live_harden loop
    v_reg := to_regprocedure(v_sig);
    execute format('alter function %s set search_path = %L', v_reg, '');
  end loop;

  -- -------------------------------------------------------------------------
  -- 8) EXECUTE privilege hardening (exact OIDs; restore service_role)
  -- -------------------------------------------------------------------------

  -- 8a) SECURITY DEFINER union
  foreach v_oid in array v_union_oids loop
    v_reg := v_oid::regprocedure;
    execute format('revoke all on function %s from public', v_reg);
    execute format('revoke all on function %s from anon', v_reg);

    if v_oid = any (v_auth_oids) then
      execute format('grant execute on function %s to authenticated', v_reg);
    else
      execute format('revoke all on function %s from authenticated', v_reg);
    end if;

    if coalesce((v_service_before ->> v_oid::text)::boolean, false) then
      execute format('grant execute on function %s to service_role', v_reg);
    end if;
  end loop;

  -- 8b) INVOKER trigger / non-RPC helpers — revoke client EXECUTE
  foreach v_sig in array array[
    'public.drevora_set_updated_at()',
    'public.set_vehicle_check_template_updated_at()',
    'public.drivers_set_worker_code()',
    'public.drevora_protect_company_plan_columns()',
    'public.drevora_active_worker_limit_for_plan(text)',
    'public.drevora_active_vehicle_limit_for_plan(text)'
  ] loop
    v_reg := to_regprocedure(v_sig);
    v_oid := v_reg::oid;
    execute format('revoke all on function %s from public', v_reg);
    execute format('revoke all on function %s from anon', v_reg);
    execute format('revoke all on function %s from authenticated', v_reg);
    if coalesce((v_service_before ->> v_oid::text)::boolean, false) then
      execute format('grant execute on function %s to service_role', v_reg);
    end if;
  end loop;

  -- 8c) Worker-code INVOKER helpers — authenticated needed for trigger chain
  foreach v_sig in array array[
    'public.generate_worker_code()',
    'public.generate_unique_worker_code(text)'
  ] loop
    v_reg := to_regprocedure(v_sig);
    v_oid := v_reg::oid;
    execute format('revoke all on function %s from public', v_reg);
    execute format('revoke all on function %s from anon', v_reg);
    execute format('grant execute on function %s to authenticated', v_reg);
    if coalesce((v_service_before ->> v_oid::text)::boolean, false) then
      execute format('grant execute on function %s to service_role', v_reg);
    end if;
  end loop;

  -- 8d) Live-only updated_at helpers hardened this run
  foreach v_sig in array v_live_harden loop
    v_reg := to_regprocedure(v_sig);
    v_oid := v_reg::oid;
    execute format('revoke all on function %s from public', v_reg);
    execute format('revoke all on function %s from anon', v_reg);
    execute format('revoke all on function %s from authenticated', v_reg);
    if coalesce((v_service_before ->> v_oid::text)::boolean, false) then
      execute format('grant execute on function %s to service_role', v_reg);
    end if;
  end loop;

  -- =========================================================================
  -- 9) In-transaction assertions
  -- =========================================================================

  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception
      'DREVORA STOP 20260726260000: anon/authenticated gained CREATE on public during migration';
  end if;

  -- PUBLIC / anon EXECUTE gone on every hardened DEFINER
  foreach v_oid in array v_union_oids loop
    v_reg := v_oid::regprocedure;
    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral aclexplode(
        coalesce(p.proacl, acldefault('f', p.proowner))
      ) acl
      where p.oid = v_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    ) then
      raise exception
        'DREVORA STOP 20260726260000: PUBLIC EXECUTE remains on %',
        v_reg;
    end if;
    if has_function_privilege('anon', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: anon EXECUTE remains on %',
        v_reg;
    end if;
  end loop;

  -- Authenticated allowlist retains EXECUTE; internal does not
  foreach v_oid in array v_auth_oids loop
    if not has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: authenticated lost EXECUTE on %',
        v_oid::regprocedure;
    end if;
  end loop;

  foreach v_oid in array v_internal_oids loop
    if has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: authenticated still has EXECUTE on internal %',
        v_oid::regprocedure;
    end if;
  end loop;

  -- service_role preservation
  foreach v_oid in array v_service_need_grant loop
    if not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: service_role lost effective EXECUTE on %',
        v_oid::regprocedure;
    end if;
  end loop;

  -- INVOKER ACL assertions (trigger/internal helpers: no client EXECUTE)
  foreach v_sig in array v_invoker_no_client loop
    v_reg := to_regprocedure(v_sig);
    v_oid := v_reg::oid;
    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral aclexplode(
        coalesce(p.proacl, acldefault('f', p.proowner))
      ) acl
      where p.oid = v_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    ) then
      raise exception
        'DREVORA STOP 20260726260000: PUBLIC EXECUTE remains on INVOKER helper %',
        v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: anon EXECUTE remains on INVOKER helper %',
        v_sig;
    end if;
    if has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: authenticated EXECUTE remains on INVOKER helper %',
        v_sig;
    end if;
    if coalesce((v_service_before ->> v_oid::text)::boolean, false)
       and not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: service_role lost EXECUTE on INVOKER helper %',
        v_sig;
    end if;
  end loop;

  -- Worker-code INVOKER helpers: authenticated required; PUBLIC/anon revoked
  foreach v_sig in array v_invoker_worker_code loop
    v_reg := to_regprocedure(v_sig);
    v_oid := v_reg::oid;
    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral aclexplode(
        coalesce(p.proacl, acldefault('f', p.proowner))
      ) acl
      where p.oid = v_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    ) then
      raise exception
        'DREVORA STOP 20260726260000: PUBLIC EXECUTE remains on worker-code helper %',
        v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: anon EXECUTE remains on worker-code helper %',
        v_sig;
    end if;
    if not has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: authenticated lost EXECUTE on worker-code helper %',
        v_sig;
    end if;
    if coalesce((v_service_before ->> v_oid::text)::boolean, false)
       and not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: service_role lost EXECUTE on worker-code helper %',
        v_sig;
    end if;
  end loop;

  -- Live-only updated_at helpers hardened this run: no client EXECUTE
  foreach v_sig in array v_live_harden loop
    v_reg := to_regprocedure(v_sig);
    v_oid := v_reg::oid;
    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral aclexplode(
        coalesce(p.proacl, acldefault('f', p.proowner))
      ) acl
      where p.oid = v_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee = 0
    ) then
      raise exception
        'DREVORA STOP 20260726260000: PUBLIC EXECUTE remains on live-only helper %',
        v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'execute')
       or has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: client EXECUTE remains on live-only helper %',
        v_sig;
    end if;
    if coalesce((v_service_before ->> v_oid::text)::boolean, false)
       and not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception
        'DREVORA STOP 20260726260000: service_role lost EXECUTE on live-only helper %',
        v_sig;
    end if;
  end loop;

  -- Required search_path pins
  foreach v_sig in array v_search_path_required loop
    v_reg := to_regprocedure(v_sig);
    if not exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = v_reg::oid
        and cfg like 'search_path=%'
    ) then
      raise exception
        'DREVORA STOP 20260726260000: search_path not set on %',
        v_sig;
    end if;
  end loop;

  foreach v_sig in array v_live_harden loop
    v_reg := to_regprocedure(v_sig);
    if not exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where p.oid = v_reg::oid
        and cfg like 'search_path=%'
    ) then
      raise exception
        'DREVORA STOP 20260726260000: search_path not set on hardened live-only %',
        v_sig;
    end if;
  end loop;

  -- Present live-only helpers must have been hardened (unsafe already aborted).
  foreach v_sig in array v_live_updated_at loop
    v_reg := to_regprocedure(v_sig);
    if v_reg is null then
      continue;
    end if;
    if not (v_sig = any (v_live_harden)) then
      raise exception
        'DREVORA STOP 20260726260000: live-only % present but not in hardened set',
        v_sig;
    end if;
  end loop;

  -- Trigger attachment for repository updated_at helper
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and t.tgfoid = 'public.drevora_set_updated_at()'::regprocedure
  ) then
    raise exception
      'DREVORA STOP 20260726260000: no triggers call public.drevora_set_updated_at()';
  end if;

  raise notice
    'DREVORA 20260726260000 OK: supported_registry=% resolved_total=% resolved_auth=% resolved_internal=% optional_absent=% [%]; live_updated_at=%; service_role_restored=%',
    v_registry_count,
    coalesce(cardinality(v_union_oids), 0),
    coalesce(cardinality(v_auth_oids), 0),
    coalesce(cardinality(v_internal_oids), 0),
    v_optional_absent_count,
    coalesce(array_to_string(v_optional_absent, ', '), ''),
    coalesce(cardinality(v_live_harden), 0),
    coalesce(cardinality(v_service_need_grant), 0);
end;
$$;

commit;

-- =============================================================================
-- POST-APPLY DIAGNOSTICS (read-only — copy/run manually after apply)
-- All statements below are complete and runnable. Uncomment a block and run it.
-- Body dumps may use pg_get_functiondef for human review only (not used by
-- the migration's executable safety decisions).
-- Supported registry = 65 (47 authenticated + 18 internal).
-- Version-optional absences (exactly 3 signatures) are allowed when fully
-- absent; expected_resolved = 65 - optional_absent_count (e.g. 62 when all
-- three optional plan functions are missing on this deploy).
-- =============================================================================
--
-- -----------------------------------------------------------------------------
-- 1) All 65 supported signatures: classification, PRESENT/MISSING, optional,
--    security mode; EXECUTE matrix only for PRESENT rows; summary counts
-- -----------------------------------------------------------------------------
-- with
-- optional_definer(sig) as (
--   values
--     ('public.drevora_create_company_with_trial_plan(text,text)'),
--     ('public.drevora_enforce_vehicle_plan_allowance()'),
--     ('public.drevora_enforce_worker_plan_allowance()')
-- ),
-- audited(sig, class) as (
--   values
--     ('public.drevora_archive_driver(uuid)', 'authenticated'),
--     ('public.drevora_restore_driver(uuid)', 'authenticated'),
--     ('public.drevora_auth_worker_access_status()', 'authenticated'),
--     ('public.drevora_archive_vehicle(uuid,text,date)', 'authenticated'),
--     ('public.drevora_restore_vehicle(uuid)', 'authenticated'),
--     ('public.drevora_approve_timesheets(uuid,uuid[])', 'authenticated'),
--     ('public.drevora_reject_timesheets(uuid,uuid[])', 'authenticated'),
--     ('public.drevora_clean_timesheets_current_view(uuid,date,date)', 'authenticated'),
--     ('public.drevora_create_worker_document_submission(uuid,uuid,text,text,text,text,jsonb)', 'authenticated'),
--     ('public.drevora_review_worker_document_submission(uuid,uuid,text,text)', 'authenticated'),
--     ('public.drevora_update_worker_document_submission_metadata(uuid,uuid,text,text,text,text)', 'authenticated'),
--     ('public.drevora_soft_delete_worker_document_submission(uuid,uuid,text)', 'authenticated'),
--     ('public.drevora_restore_worker_document_submission(uuid,uuid)', 'authenticated'),
--     ('public.drevora_create_company_with_trial_plan(text,text)', 'authenticated'),
--     ('public.drevora_generate_expiry_notifications()', 'authenticated'),
--     ('public.drevora_auth_user_belongs_to_company_id(uuid)', 'authenticated'),
--     ('public.drevora_auth_user_can_manage_vehicle_check_templates()', 'authenticated'),
--     ('public.drevora_auth_user_company_ids()', 'authenticated'),
--     ('public.drevora_auth_user_driver_company_text()', 'authenticated'),
--     ('public.drevora_auth_user_driver_id()', 'authenticated'),
--     ('public.drevora_auth_user_has_office_role()', 'authenticated'),
--     ('public.drevora_auth_user_has_office_role_for_company(uuid)', 'authenticated'),
--     ('public.drevora_calculate_holiday_day_breakdown(uuid,date,date)', 'authenticated'),
--     ('public.drevora_company_text_matches_current(text)', 'authenticated'),
--     ('public.drevora_current_company_id()', 'authenticated'),
--     ('public.drevora_current_company_name()', 'authenticated'),
--     ('public.drevora_driver_in_company(uuid,uuid)', 'authenticated'),
--     ('public.drevora_vehicle_in_company(uuid,uuid)', 'authenticated'),
--     ('public.drevora_is_trusted_tenant_writer()', 'authenticated'),
--     ('public.drevora_worker_holiday_leave_type(uuid)', 'authenticated'),
--     ('public.drevora_vehicle_check_company_matches_auth_user(text)', 'authenticated'),
--     ('public.drevora_resolve_unique_company_id(text)', 'authenticated'),
--     ('public.drevora_storage_object_company_id(text,text)', 'authenticated'),
--     ('public.drevora_storage_can_select_worker_avatar(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_worker_avatar(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_vehicle_check_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_vehicle_check_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_delete_vehicle_check_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_consumable_receipt(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_consumable_receipt(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_document_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_document_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_driver_report_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_driver_report_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_worker_submission_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_worker_submission_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_delete_worker_submission_staging_file(text)', 'authenticated'),
--     ('public.drevora_enforce_vehicle_plan_allowance()', 'internal'),
--     ('public.drevora_enforce_worker_plan_allowance()', 'internal'),
--     ('public.drevora_insert_admin_notification(uuid,text,text,text,text,text,uuid,text,text,jsonb)', 'internal'),
--     ('public.drevora_notification_resolve_company_id(uuid,uuid,uuid)', 'internal'),
--     ('public.drevora_notification_vehicle_label(uuid)', 'internal'),
--     ('public.drevora_notification_worker_label(uuid)', 'internal'),
--     ('public.drevora_notify_driver_report_created()', 'internal'),
--     ('public.drevora_notify_holiday_request_created()', 'internal'),
--     ('public.drevora_notify_timesheet_submitted()', 'internal'),
--     ('public.drevora_notify_tyre_check_critical()', 'internal'),
--     ('public.drevora_notify_vehicle_check_attention()', 'internal'),
--     ('public.drevora_tyre_check_has_complete_layout(uuid)', 'internal'),
--     ('public.drevora_tyre_check_items_after_change()', 'internal'),
--     ('public.drevora_tyre_check_items_before_write()', 'internal'),
--     ('public.drevora_tyre_check_refresh_summary(uuid)', 'internal'),
--     ('public.drevora_tyre_check_resolve_trailer_snapshot(uuid,uuid,uuid,smallint)', 'internal'),
--     ('public.drevora_tyre_checks_before_insert()', 'internal'),
--     ('public.drevora_tyre_checks_before_write()', 'internal')
-- ),
-- inventory as (
--   select
--     a.sig,
--     a.class,
--     exists (select 1 from optional_definer o where o.sig = a.sig) as is_optional,
--     case when to_regprocedure(a.sig) is null then 'MISSING' else 'PRESENT' end as presence,
--     case
--       when to_regprocedure(a.sig) is null then null
--       when p.prosecdef then 'DEFINER'
--       else 'INVOKER'
--     end as security_mode,
--     p.proconfig,
--     case when p.oid is null then null
--          else has_function_privilege('authenticated', p.oid, 'execute')
--     end as authenticated_exec,
--     case when p.oid is null then null
--          else has_function_privilege('anon', p.oid, 'execute')
--     end as anon_exec,
--     case when p.oid is null then null
--          else has_function_privilege('service_role', p.oid, 'execute')
--     end as service_role_exec,
--     case when p.oid is null then null
--          else exists (
--            select 1
--            from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
--            where acl.privilege_type = 'EXECUTE' and acl.grantee = 0
--          )
--     end as public_exec
--   from audited a
--   left join lateral (
--     select p.*
--     from pg_catalog.pg_proc p
--     where to_regprocedure(a.sig) is not null
--       and p.oid = to_regprocedure(a.sig)::oid
--   ) p on true
-- )
-- select *
-- from inventory
-- order by class, sig;
--
-- -- Summary counts (run after inventory CTE above, or as standalone):
-- with
-- optional_definer(sig) as (
--   values
--     ('public.drevora_create_company_with_trial_plan(text,text)'),
--     ('public.drevora_enforce_vehicle_plan_allowance()'),
--     ('public.drevora_enforce_worker_plan_allowance()')
-- ),
-- audited(sig, class) as (
--   values
--     ('public.drevora_archive_driver(uuid)', 'authenticated'),
--     ('public.drevora_restore_driver(uuid)', 'authenticated'),
--     ('public.drevora_auth_worker_access_status()', 'authenticated'),
--     ('public.drevora_archive_vehicle(uuid,text,date)', 'authenticated'),
--     ('public.drevora_restore_vehicle(uuid)', 'authenticated'),
--     ('public.drevora_approve_timesheets(uuid,uuid[])', 'authenticated'),
--     ('public.drevora_reject_timesheets(uuid,uuid[])', 'authenticated'),
--     ('public.drevora_clean_timesheets_current_view(uuid,date,date)', 'authenticated'),
--     ('public.drevora_create_worker_document_submission(uuid,uuid,text,text,text,text,jsonb)', 'authenticated'),
--     ('public.drevora_review_worker_document_submission(uuid,uuid,text,text)', 'authenticated'),
--     ('public.drevora_update_worker_document_submission_metadata(uuid,uuid,text,text,text,text)', 'authenticated'),
--     ('public.drevora_soft_delete_worker_document_submission(uuid,uuid,text)', 'authenticated'),
--     ('public.drevora_restore_worker_document_submission(uuid,uuid)', 'authenticated'),
--     ('public.drevora_create_company_with_trial_plan(text,text)', 'authenticated'),
--     ('public.drevora_generate_expiry_notifications()', 'authenticated'),
--     ('public.drevora_auth_user_belongs_to_company_id(uuid)', 'authenticated'),
--     ('public.drevora_auth_user_can_manage_vehicle_check_templates()', 'authenticated'),
--     ('public.drevora_auth_user_company_ids()', 'authenticated'),
--     ('public.drevora_auth_user_driver_company_text()', 'authenticated'),
--     ('public.drevora_auth_user_driver_id()', 'authenticated'),
--     ('public.drevora_auth_user_has_office_role()', 'authenticated'),
--     ('public.drevora_auth_user_has_office_role_for_company(uuid)', 'authenticated'),
--     ('public.drevora_calculate_holiday_day_breakdown(uuid,date,date)', 'authenticated'),
--     ('public.drevora_company_text_matches_current(text)', 'authenticated'),
--     ('public.drevora_current_company_id()', 'authenticated'),
--     ('public.drevora_current_company_name()', 'authenticated'),
--     ('public.drevora_driver_in_company(uuid,uuid)', 'authenticated'),
--     ('public.drevora_vehicle_in_company(uuid,uuid)', 'authenticated'),
--     ('public.drevora_is_trusted_tenant_writer()', 'authenticated'),
--     ('public.drevora_worker_holiday_leave_type(uuid)', 'authenticated'),
--     ('public.drevora_vehicle_check_company_matches_auth_user(text)', 'authenticated'),
--     ('public.drevora_resolve_unique_company_id(text)', 'authenticated'),
--     ('public.drevora_storage_object_company_id(text,text)', 'authenticated'),
--     ('public.drevora_storage_can_select_worker_avatar(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_worker_avatar(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_vehicle_check_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_vehicle_check_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_delete_vehicle_check_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_consumable_receipt(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_consumable_receipt(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_document_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_document_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_driver_report_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_driver_report_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_select_worker_submission_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_write_worker_submission_file(text)', 'authenticated'),
--     ('public.drevora_storage_can_delete_worker_submission_staging_file(text)', 'authenticated'),
--     ('public.drevora_enforce_vehicle_plan_allowance()', 'internal'),
--     ('public.drevora_enforce_worker_plan_allowance()', 'internal'),
--     ('public.drevora_insert_admin_notification(uuid,text,text,text,text,text,uuid,text,text,jsonb)', 'internal'),
--     ('public.drevora_notification_resolve_company_id(uuid,uuid,uuid)', 'internal'),
--     ('public.drevora_notification_vehicle_label(uuid)', 'internal'),
--     ('public.drevora_notification_worker_label(uuid)', 'internal'),
--     ('public.drevora_notify_driver_report_created()', 'internal'),
--     ('public.drevora_notify_holiday_request_created()', 'internal'),
--     ('public.drevora_notify_timesheet_submitted()', 'internal'),
--     ('public.drevora_notify_tyre_check_critical()', 'internal'),
--     ('public.drevora_notify_vehicle_check_attention()', 'internal'),
--     ('public.drevora_tyre_check_has_complete_layout(uuid)', 'internal'),
--     ('public.drevora_tyre_check_items_after_change()', 'internal'),
--     ('public.drevora_tyre_check_items_before_write()', 'internal'),
--     ('public.drevora_tyre_check_refresh_summary(uuid)', 'internal'),
--     ('public.drevora_tyre_check_resolve_trailer_snapshot(uuid,uuid,uuid,smallint)', 'internal'),
--     ('public.drevora_tyre_checks_before_insert()', 'internal'),
--     ('public.drevora_tyre_checks_before_write()', 'internal')
-- ),
-- resolved as (
--   select a.sig, a.class
--   from audited a
--   where to_regprocedure(a.sig) is not null
-- ),
-- optional_absent as (
--   select o.sig
--   from optional_definer o
--   where to_regprocedure(o.sig) is null
-- )
-- select
--   (select count(*) from audited) as supported_registry_count,
--   (select count(*) from audited where class = 'authenticated') as supported_authenticated_count,
--   (select count(*) from audited where class = 'internal') as supported_internal_count,
--   (select count(*) from resolved) as resolved_total,
--   (select count(*) from resolved where class = 'authenticated') as resolved_authenticated_count,
--   (select count(*) from resolved where class = 'internal') as resolved_internal_count,
--   (select count(*) from optional_definer) as version_optional_count,
--   (select count(*) from optional_absent) as optional_absent_count,
--   (select coalesce(string_agg(sig, ', ' order by sig), '') from optional_absent) as optional_absent_names,
--   (select count(*) from audited) - (select count(*) from optional_absent) as expected_resolved;
-- -- On this live version with all three optional plan functions absent:
-- -- supported_registry_count=65, resolved_total=62, optional_absent_count=3.
--
-- -----------------------------------------------------------------------------
-- 2) PRESENT authenticated class only (authenticated_exec must be true; public/anon false)
-- -----------------------------------------------------------------------------
-- with audited(sig) as (
--   values
--     ('public.drevora_archive_driver(uuid)'),
--     ('public.drevora_restore_driver(uuid)'),
--     ('public.drevora_auth_worker_access_status()'),
--     ('public.drevora_archive_vehicle(uuid,text,date)'),
--     ('public.drevora_restore_vehicle(uuid)'),
--     ('public.drevora_approve_timesheets(uuid,uuid[])'),
--     ('public.drevora_reject_timesheets(uuid,uuid[])'),
--     ('public.drevora_clean_timesheets_current_view(uuid,date,date)'),
--     ('public.drevora_create_worker_document_submission(uuid,uuid,text,text,text,text,jsonb)'),
--     ('public.drevora_review_worker_document_submission(uuid,uuid,text,text)'),
--     ('public.drevora_update_worker_document_submission_metadata(uuid,uuid,text,text,text,text)'),
--     ('public.drevora_soft_delete_worker_document_submission(uuid,uuid,text)'),
--     ('public.drevora_restore_worker_document_submission(uuid,uuid)'),
--     ('public.drevora_create_company_with_trial_plan(text,text)'),
--     ('public.drevora_generate_expiry_notifications()'),
--     ('public.drevora_auth_user_belongs_to_company_id(uuid)'),
--     ('public.drevora_auth_user_can_manage_vehicle_check_templates()'),
--     ('public.drevora_auth_user_company_ids()'),
--     ('public.drevora_auth_user_driver_company_text()'),
--     ('public.drevora_auth_user_driver_id()'),
--     ('public.drevora_auth_user_has_office_role()'),
--     ('public.drevora_auth_user_has_office_role_for_company(uuid)'),
--     ('public.drevora_calculate_holiday_day_breakdown(uuid,date,date)'),
--     ('public.drevora_company_text_matches_current(text)'),
--     ('public.drevora_current_company_id()'),
--     ('public.drevora_current_company_name()'),
--     ('public.drevora_driver_in_company(uuid,uuid)'),
--     ('public.drevora_vehicle_in_company(uuid,uuid)'),
--     ('public.drevora_is_trusted_tenant_writer()'),
--     ('public.drevora_worker_holiday_leave_type(uuid)'),
--     ('public.drevora_vehicle_check_company_matches_auth_user(text)'),
--     ('public.drevora_resolve_unique_company_id(text)'),
--     ('public.drevora_storage_object_company_id(text,text)'),
--     ('public.drevora_storage_can_select_worker_avatar(text)'),
--     ('public.drevora_storage_can_write_worker_avatar(text)'),
--     ('public.drevora_storage_can_select_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_write_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_delete_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_select_consumable_receipt(text)'),
--     ('public.drevora_storage_can_write_consumable_receipt(text)'),
--     ('public.drevora_storage_can_select_document_file(text)'),
--     ('public.drevora_storage_can_write_document_file(text)'),
--     ('public.drevora_storage_can_select_driver_report_file(text)'),
--     ('public.drevora_storage_can_write_driver_report_file(text)'),
--     ('public.drevora_storage_can_select_worker_submission_file(text)'),
--     ('public.drevora_storage_can_write_worker_submission_file(text)'),
--     ('public.drevora_storage_can_delete_worker_submission_staging_file(text)')
-- )
-- select a.sig,
--        has_function_privilege('authenticated', to_regprocedure(a.sig), 'execute') as authenticated_exec,
--        has_function_privilege('anon', to_regprocedure(a.sig), 'execute') as anon_exec,
--        has_function_privilege('service_role', to_regprocedure(a.sig), 'execute') as service_role_exec
-- from audited a
-- where to_regprocedure(a.sig) is not null
-- order by a.sig;
--
-- -----------------------------------------------------------------------------
-- 3) PRESENT internal class only (authenticated_exec must be false)
-- -----------------------------------------------------------------------------
-- with audited(sig) as (
--   values
--     ('public.drevora_enforce_vehicle_plan_allowance()'),
--     ('public.drevora_enforce_worker_plan_allowance()'),
--     ('public.drevora_insert_admin_notification(uuid,text,text,text,text,text,uuid,text,text,jsonb)'),
--     ('public.drevora_notification_resolve_company_id(uuid,uuid,uuid)'),
--     ('public.drevora_notification_vehicle_label(uuid)'),
--     ('public.drevora_notification_worker_label(uuid)'),
--     ('public.drevora_notify_driver_report_created()'),
--     ('public.drevora_notify_holiday_request_created()'),
--     ('public.drevora_notify_timesheet_submitted()'),
--     ('public.drevora_notify_tyre_check_critical()'),
--     ('public.drevora_notify_vehicle_check_attention()'),
--     ('public.drevora_tyre_check_has_complete_layout(uuid)'),
--     ('public.drevora_tyre_check_items_after_change()'),
--     ('public.drevora_tyre_check_items_before_write()'),
--     ('public.drevora_tyre_check_refresh_summary(uuid)'),
--     ('public.drevora_tyre_check_resolve_trailer_snapshot(uuid,uuid,uuid,smallint)'),
--     ('public.drevora_tyre_checks_before_insert()'),
--     ('public.drevora_tyre_checks_before_write()')
-- )
-- select a.sig,
--        has_function_privilege('authenticated', to_regprocedure(a.sig), 'execute') as authenticated_exec,
--        has_function_privilege('service_role', to_regprocedure(a.sig), 'execute') as service_role_exec
-- from audited a
-- where to_regprocedure(a.sig) is not null
-- order by a.sig;
--
-- -----------------------------------------------------------------------------
-- 4) service_role effective EXECUTE on PRESENT resolved DEFINER targets
-- -----------------------------------------------------------------------------
-- with audited(sig) as (
--   values
--     ('public.drevora_archive_driver(uuid)'),
--     ('public.drevora_restore_driver(uuid)'),
--     ('public.drevora_auth_worker_access_status()'),
--     ('public.drevora_archive_vehicle(uuid,text,date)'),
--     ('public.drevora_restore_vehicle(uuid)'),
--     ('public.drevora_approve_timesheets(uuid,uuid[])'),
--     ('public.drevora_reject_timesheets(uuid,uuid[])'),
--     ('public.drevora_clean_timesheets_current_view(uuid,date,date)'),
--     ('public.drevora_create_worker_document_submission(uuid,uuid,text,text,text,text,jsonb)'),
--     ('public.drevora_review_worker_document_submission(uuid,uuid,text,text)'),
--     ('public.drevora_update_worker_document_submission_metadata(uuid,uuid,text,text,text,text)'),
--     ('public.drevora_soft_delete_worker_document_submission(uuid,uuid,text)'),
--     ('public.drevora_restore_worker_document_submission(uuid,uuid)'),
--     ('public.drevora_create_company_with_trial_plan(text,text)'),
--     ('public.drevora_generate_expiry_notifications()'),
--     ('public.drevora_auth_user_belongs_to_company_id(uuid)'),
--     ('public.drevora_auth_user_can_manage_vehicle_check_templates()'),
--     ('public.drevora_auth_user_company_ids()'),
--     ('public.drevora_auth_user_driver_company_text()'),
--     ('public.drevora_auth_user_driver_id()'),
--     ('public.drevora_auth_user_has_office_role()'),
--     ('public.drevora_auth_user_has_office_role_for_company(uuid)'),
--     ('public.drevora_calculate_holiday_day_breakdown(uuid,date,date)'),
--     ('public.drevora_company_text_matches_current(text)'),
--     ('public.drevora_current_company_id()'),
--     ('public.drevora_current_company_name()'),
--     ('public.drevora_driver_in_company(uuid,uuid)'),
--     ('public.drevora_vehicle_in_company(uuid,uuid)'),
--     ('public.drevora_is_trusted_tenant_writer()'),
--     ('public.drevora_worker_holiday_leave_type(uuid)'),
--     ('public.drevora_vehicle_check_company_matches_auth_user(text)'),
--     ('public.drevora_resolve_unique_company_id(text)'),
--     ('public.drevora_storage_object_company_id(text,text)'),
--     ('public.drevora_storage_can_select_worker_avatar(text)'),
--     ('public.drevora_storage_can_write_worker_avatar(text)'),
--     ('public.drevora_storage_can_select_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_write_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_delete_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_select_consumable_receipt(text)'),
--     ('public.drevora_storage_can_write_consumable_receipt(text)'),
--     ('public.drevora_storage_can_select_document_file(text)'),
--     ('public.drevora_storage_can_write_document_file(text)'),
--     ('public.drevora_storage_can_select_driver_report_file(text)'),
--     ('public.drevora_storage_can_write_driver_report_file(text)'),
--     ('public.drevora_storage_can_select_worker_submission_file(text)'),
--     ('public.drevora_storage_can_write_worker_submission_file(text)'),
--     ('public.drevora_storage_can_delete_worker_submission_staging_file(text)'),
--     ('public.drevora_enforce_vehicle_plan_allowance()'),
--     ('public.drevora_enforce_worker_plan_allowance()'),
--     ('public.drevora_insert_admin_notification(uuid,text,text,text,text,text,uuid,text,text,jsonb)'),
--     ('public.drevora_notification_resolve_company_id(uuid,uuid,uuid)'),
--     ('public.drevora_notification_vehicle_label(uuid)'),
--     ('public.drevora_notification_worker_label(uuid)'),
--     ('public.drevora_notify_driver_report_created()'),
--     ('public.drevora_notify_holiday_request_created()'),
--     ('public.drevora_notify_timesheet_submitted()'),
--     ('public.drevora_notify_tyre_check_critical()'),
--     ('public.drevora_notify_vehicle_check_attention()'),
--     ('public.drevora_tyre_check_has_complete_layout(uuid)'),
--     ('public.drevora_tyre_check_items_after_change()'),
--     ('public.drevora_tyre_check_items_before_write()'),
--     ('public.drevora_tyre_check_refresh_summary(uuid)'),
--     ('public.drevora_tyre_check_resolve_trailer_snapshot(uuid,uuid,uuid,smallint)'),
--     ('public.drevora_tyre_checks_before_insert()'),
--     ('public.drevora_tyre_checks_before_write()')
-- )
-- select a.sig,
--        has_function_privilege('service_role', to_regprocedure(a.sig), 'execute') as service_role_exec
-- from audited a
-- where to_regprocedure(a.sig) is not null
-- order by a.sig;
--
-- -----------------------------------------------------------------------------
-- 5) public-schema CREATE privileges
-- -----------------------------------------------------------------------------
-- select r.rolname,
--        has_schema_privilege(r.oid, 'public', 'CREATE') as can_create
-- from pg_roles r
-- where r.rolname in ('anon', 'authenticated', 'authenticator', 'service_role', 'postgres')
-- order by 1;
-- -- anon/authenticated must be false
--
-- -----------------------------------------------------------------------------
-- 6) Remaining unexpected public SECURITY DEFINER outside supported registry
--    (resolved OIDs only; optional absences do not create false positives)
-- -----------------------------------------------------------------------------
-- with audited(sig) as (
--   values
--     ('public.drevora_archive_driver(uuid)'),
--     ('public.drevora_restore_driver(uuid)'),
--     ('public.drevora_auth_worker_access_status()'),
--     ('public.drevora_archive_vehicle(uuid,text,date)'),
--     ('public.drevora_restore_vehicle(uuid)'),
--     ('public.drevora_approve_timesheets(uuid,uuid[])'),
--     ('public.drevora_reject_timesheets(uuid,uuid[])'),
--     ('public.drevora_clean_timesheets_current_view(uuid,date,date)'),
--     ('public.drevora_create_worker_document_submission(uuid,uuid,text,text,text,text,jsonb)'),
--     ('public.drevora_review_worker_document_submission(uuid,uuid,text,text)'),
--     ('public.drevora_update_worker_document_submission_metadata(uuid,uuid,text,text,text,text)'),
--     ('public.drevora_soft_delete_worker_document_submission(uuid,uuid,text)'),
--     ('public.drevora_restore_worker_document_submission(uuid,uuid)'),
--     ('public.drevora_create_company_with_trial_plan(text,text)'),
--     ('public.drevora_generate_expiry_notifications()'),
--     ('public.drevora_auth_user_belongs_to_company_id(uuid)'),
--     ('public.drevora_auth_user_can_manage_vehicle_check_templates()'),
--     ('public.drevora_auth_user_company_ids()'),
--     ('public.drevora_auth_user_driver_company_text()'),
--     ('public.drevora_auth_user_driver_id()'),
--     ('public.drevora_auth_user_has_office_role()'),
--     ('public.drevora_auth_user_has_office_role_for_company(uuid)'),
--     ('public.drevora_calculate_holiday_day_breakdown(uuid,date,date)'),
--     ('public.drevora_company_text_matches_current(text)'),
--     ('public.drevora_current_company_id()'),
--     ('public.drevora_current_company_name()'),
--     ('public.drevora_driver_in_company(uuid,uuid)'),
--     ('public.drevora_vehicle_in_company(uuid,uuid)'),
--     ('public.drevora_is_trusted_tenant_writer()'),
--     ('public.drevora_worker_holiday_leave_type(uuid)'),
--     ('public.drevora_vehicle_check_company_matches_auth_user(text)'),
--     ('public.drevora_resolve_unique_company_id(text)'),
--     ('public.drevora_storage_object_company_id(text,text)'),
--     ('public.drevora_storage_can_select_worker_avatar(text)'),
--     ('public.drevora_storage_can_write_worker_avatar(text)'),
--     ('public.drevora_storage_can_select_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_write_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_delete_vehicle_check_file(text)'),
--     ('public.drevora_storage_can_select_consumable_receipt(text)'),
--     ('public.drevora_storage_can_write_consumable_receipt(text)'),
--     ('public.drevora_storage_can_select_document_file(text)'),
--     ('public.drevora_storage_can_write_document_file(text)'),
--     ('public.drevora_storage_can_select_driver_report_file(text)'),
--     ('public.drevora_storage_can_write_driver_report_file(text)'),
--     ('public.drevora_storage_can_select_worker_submission_file(text)'),
--     ('public.drevora_storage_can_write_worker_submission_file(text)'),
--     ('public.drevora_storage_can_delete_worker_submission_staging_file(text)'),
--     ('public.drevora_enforce_vehicle_plan_allowance()'),
--     ('public.drevora_enforce_worker_plan_allowance()'),
--     ('public.drevora_insert_admin_notification(uuid,text,text,text,text,text,uuid,text,text,jsonb)'),
--     ('public.drevora_notification_resolve_company_id(uuid,uuid,uuid)'),
--     ('public.drevora_notification_vehicle_label(uuid)'),
--     ('public.drevora_notification_worker_label(uuid)'),
--     ('public.drevora_notify_driver_report_created()'),
--     ('public.drevora_notify_holiday_request_created()'),
--     ('public.drevora_notify_timesheet_submitted()'),
--     ('public.drevora_notify_tyre_check_critical()'),
--     ('public.drevora_notify_vehicle_check_attention()'),
--     ('public.drevora_tyre_check_has_complete_layout(uuid)'),
--     ('public.drevora_tyre_check_items_after_change()'),
--     ('public.drevora_tyre_check_items_before_write()'),
--     ('public.drevora_tyre_check_refresh_summary(uuid)'),
--     ('public.drevora_tyre_check_resolve_trailer_snapshot(uuid,uuid,uuid,smallint)'),
--     ('public.drevora_tyre_checks_before_insert()'),
--     ('public.drevora_tyre_checks_before_write()')
-- ),
-- audited_oids as (
--   select to_regprocedure(sig)::oid as oid
--   from audited
--   where to_regprocedure(sig) is not null
-- )
-- select
--   format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as fn,
--   left(p.proname, 8) = 'drevora_' as is_drevora_prefix
-- from pg_catalog.pg_proc p
-- join pg_catalog.pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.prosecdef = true
--   and not exists (select 1 from audited_oids a where a.oid = p.oid)
-- order by 1;
-- -- Unexpected drevora_ SECURITY DEFINER rows must be empty after a clean apply.
--
-- -----------------------------------------------------------------------------
-- 7) Remaining SECURITY DEFINER using search_path = public
-- -----------------------------------------------------------------------------
-- select
--   format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as fn,
--   p.proconfig
-- from pg_catalog.pg_proc p
-- join pg_catalog.pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.prosecdef = true
--   and exists (
--     select 1
--     from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
--     where cfg = 'search_path=public'
--        or cfg like 'search_path=public,%'
--   )
-- order by 1;
--
-- -----------------------------------------------------------------------------
-- 8) Remaining unset search_path targets (literal drevora_ prefix + helpers)
-- -----------------------------------------------------------------------------
-- select
--   format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as fn,
--   case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_mode
-- from pg_catalog.pg_proc p
-- join pg_catalog.pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and (
--     left(p.proname, 8) = 'drevora_'
--     or p.proname in (
--       'generate_worker_code',
--       'generate_unique_worker_code',
--       'drivers_set_worker_code',
--       'set_vehicle_check_template_updated_at',
--       'set_contacts_updated_at',
--       'set_documents_updated_at',
--       'set_driver_reports_updated_at'
--     )
--   )
--   and not exists (
--     select 1
--     from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
--     where cfg like 'search_path=%'
--   )
-- order by 1;
-- -- Expect 0 rows for all targets hardened by 260000 (absent optional DEFINER
-- -- signatures never appear here because they are not present on the database).
--
-- -----------------------------------------------------------------------------
-- 9) Live-only updated_at helpers (full definition for human review)
-- -----------------------------------------------------------------------------
-- select
--   format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as fn,
--   case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_mode,
--   p.proconfig,
--   p.prosrc,
--   pg_get_functiondef(p.oid) as full_definition
-- from pg_catalog.pg_proc p
-- join pg_catalog.pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'set_contacts_updated_at',
--     'set_documents_updated_at',
--     'set_driver_reports_updated_at'
--   )
-- order by 1;
--
-- -----------------------------------------------------------------------------
-- 10) Trigger attachments
-- -----------------------------------------------------------------------------
-- select c.relname, t.tgname, p.proname, t.tgenabled
-- from pg_catalog.pg_trigger t
-- join pg_catalog.pg_class c on c.oid = t.tgrelid
-- join pg_catalog.pg_proc p on p.oid = t.tgfoid
-- join pg_catalog.pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and not t.tgisinternal
--   and p.proname in (
--     'drevora_set_updated_at',
--     'set_vehicle_check_template_updated_at',
--     'drivers_set_worker_code',
--     'drevora_protect_company_plan_columns',
--     'set_contacts_updated_at',
--     'set_documents_updated_at',
--     'set_driver_reports_updated_at'
--   )
-- order by 1, 2;
--
-- -----------------------------------------------------------------------------
-- 11) RLS flags and unchanged row / Storage counts
-- -----------------------------------------------------------------------------
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_catalog.pg_class c
-- join pg_catalog.pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relkind = 'r'
--   and c.relname in ('timesheets', 'drivers', 'vehicles', 'contacts', 'documents')
-- order by 1;
--
-- select 'timesheets'::text as t, count(*)::bigint as n from public.timesheets
-- union all select 'drivers', count(*) from public.drivers
-- union all select 'vehicles', count(*) from public.vehicles
-- union all select 'contacts', count(*) from public.contacts
-- union all select 'documents', count(*) from public.documents
-- union all select 'storage.objects', count(*) from storage.objects;
--
-- -----------------------------------------------------------------------------
-- 12) Refresh Supabase Security Advisor only after live regression tests pass.
-- =============================================================================
