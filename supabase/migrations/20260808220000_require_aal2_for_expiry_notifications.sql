-- Security Advisor hardening — Batch 2 (single function only).
-- Target: public.drevora_generate_expiry_notifications()
--
-- Audit conclusion (NEEDS AAL2 HARDENING):
--   - SECURITY DEFINER client-facing write RPC (authenticated EXECUTE intentional)
--   - Office role + company membership checks already present
--   - Zero arguments; tenant scope derived from auth.uid() membership
--   - Writes only idempotent rows into public.notifications for caller's company
--   - Frontend is behind RequireOfficeMfa, but the DATABASE RPC did not enforce AAL2
--   - search_path was public; body already schema-qualifies user objects
--
-- Changes in this migration ONLY:
--   1) perform public.drevora_auth_require_aal2() before any Office check / scan / write
--   2) SET search_path = ''
--   3) Reaffirm EXECUTE least-privilege (authenticated retains; PUBLIC/anon revoked)
--
-- Preserves: scan logic, insert-via-helper path, return type, zero-arg signature,
-- company filtering, Office-role validation. No data migration.
--
-- Requires: 20260808190000_office_write_require_aal2.sql (drevora_auth_require_aal2)
-- Idempotent; safe to re-run. Does NOT apply itself — run manually after review.

begin;

do $$
begin
  if to_regprocedure('public.drevora_auth_require_aal2()') is null then
    raise exception
      'EXPIRY_NOTIFICATIONS_AAL2_PRECONDITION: public.drevora_auth_require_aal2() missing — apply 20260808190000_office_write_require_aal2.sql first';
  end if;

  if to_regprocedure('public.drevora_generate_expiry_notifications()') is null then
    raise exception
      'EXPIRY_NOTIFICATIONS_AAL2_PRECONDITION: public.drevora_generate_expiry_notifications() missing — apply 20260718020000_create_admin_notifications.sql first';
  end if;
end $$;

create or replace function public.drevora_generate_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_inserted integer := 0;
  v_row record;
  v_threshold text;
  v_severity text;
  v_days integer;
  v_title text;
  v_path text;
  v_dedupe text;
  v_entity_type text;
  v_label text;
begin
  -- End-user JWT only (browser → RPC direct; not service_role).
  -- Must run before Office checks and before any notification generation/write.
  perform public.drevora_auth_require_aal2();

  if not public.drevora_auth_user_has_office_role() then
    raise exception 'Office access required';
  end if;

  select cm.company_id
    into v_company_id
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.is_active = true
  limit 1;

  if v_company_id is null
     or not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'Verified company membership required';
  end if;

  -- Documents (requires documents.company_id)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'company_id'
  ) then
  for v_row in
    select
      d.id,
      d.expiry_date,
      d.document_name,
      d.document_type,
      d.applies_to,
      d.worker_id,
      d.vehicle_id,
      (d.expiry_date - current_date) as days_remaining
    from public.documents d
    where d.company_id = v_company_id
      and d.expiry_date is not null
      and d.expiry_date <= (current_date + 30)
  loop
    v_days := v_row.days_remaining;
    if v_days < 0 then
      v_threshold := 'expired';
      v_severity := 'critical';
      v_title := 'Document expired';
    elsif v_days <= 7 then
      v_threshold := '7d';
      v_severity := 'warning';
      v_title := 'Document expiring in 7 days';
    elsif v_days <= 30 then
      v_threshold := '30d';
      v_severity := 'warning';
      v_title := 'Document expiring in 30 days';
    else
      continue;
    end if;

    v_path := case
      when v_row.applies_to = 'worker' and v_row.worker_id is not null then
        '/compliance/workers/' || v_row.worker_id::text
      when v_row.applies_to = 'vehicle' and v_row.vehicle_id is not null then
        '/compliance/vehicles/' || v_row.vehicle_id::text
      else
        '/documents'
    end;

    v_dedupe :=
      'expiry:document:' || v_row.id::text || ':'
      || to_char(v_row.expiry_date, 'YYYY-MM-DD') || ':' || v_threshold;

    if public.drevora_insert_admin_notification(
      v_company_id,
      'document_expiry',
      v_severity,
      v_title,
      coalesce(nullif(trim(v_row.document_name), ''), coalesce(v_row.document_type, 'Document'))
        || ' — ' || to_char(v_row.expiry_date, 'DD Mon YYYY') || '.',
      'document',
      v_row.id,
      v_path,
      v_dedupe,
      jsonb_build_object('threshold', v_threshold, 'expiry_date', v_row.expiry_date)
    ) is not null then
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  end if;

  -- Worker compliance records (via driver.company_id)
  for v_row in
    select
      r.id,
      r.expiry_date,
      r.document_name,
      r.document_type,
      r.worker_id,
      (r.expiry_date - current_date) as days_remaining
    from public.worker_compliance_records r
    join public.drivers d on d.id = r.worker_id
    where d.company_id = v_company_id
      and r.expiry_date is not null
      and r.expiry_date <= (current_date + 30)
  loop
    v_days := v_row.days_remaining;
    if v_days < 0 then
      v_threshold := 'expired';
      v_severity := 'critical';
      v_title := 'Worker document expired';
    elsif v_days <= 7 then
      v_threshold := '7d';
      v_severity := 'warning';
      v_title := 'Worker document expiring in 7 days';
    elsif v_days <= 30 then
      v_threshold := '30d';
      v_severity := 'warning';
      v_title := 'Worker document expiring in 30 days';
    else
      continue;
    end if;

    v_dedupe :=
      'expiry:worker_compliance:' || v_row.id::text || ':'
      || to_char(v_row.expiry_date, 'YYYY-MM-DD') || ':' || v_threshold;

    if public.drevora_insert_admin_notification(
      v_company_id,
      'document_expiry',
      v_severity,
      v_title,
      coalesce(nullif(trim(v_row.document_name), ''), coalesce(v_row.document_type, 'Document'))
        || ' — ' || to_char(v_row.expiry_date, 'DD Mon YYYY') || '.',
      'worker_compliance',
      v_row.id,
      '/compliance/workers/' || v_row.worker_id::text,
      v_dedupe,
      jsonb_build_object('threshold', v_threshold, 'expiry_date', v_row.expiry_date)
    ) is not null then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  -- Vehicle compliance records
  for v_row in
    select
      r.id,
      r.expiry_date,
      r.document_name,
      r.document_type,
      r.vehicle_id,
      (r.expiry_date - current_date) as days_remaining
    from public.vehicle_compliance_records r
    join public.vehicles v on v.id = r.vehicle_id
    where v.company_id = v_company_id
      and r.expiry_date is not null
      and r.expiry_date <= (current_date + 30)
  loop
    v_days := v_row.days_remaining;
    if v_days < 0 then
      v_threshold := 'expired';
      v_severity := 'critical';
      v_title := 'Vehicle document expired';
    elsif v_days <= 7 then
      v_threshold := '7d';
      v_severity := 'warning';
      v_title := 'Vehicle document expiring in 7 days';
    elsif v_days <= 30 then
      v_threshold := '30d';
      v_severity := 'warning';
      v_title := 'Vehicle document expiring in 30 days';
    else
      continue;
    end if;

    v_label := coalesce(public.drevora_notification_vehicle_label(v_row.vehicle_id), 'Vehicle');
    v_dedupe :=
      'expiry:vehicle_compliance:' || v_row.id::text || ':'
      || to_char(v_row.expiry_date, 'YYYY-MM-DD') || ':' || v_threshold;

    if public.drevora_insert_admin_notification(
      v_company_id,
      'document_expiry',
      v_severity,
      v_title,
      v_label || ' — '
        || coalesce(nullif(trim(v_row.document_name), ''), coalesce(v_row.document_type, 'Document'))
        || ' — ' || to_char(v_row.expiry_date, 'DD Mon YYYY') || '.',
      'vehicle_compliance',
      v_row.id,
      '/compliance/vehicles/' || v_row.vehicle_id::text,
      v_dedupe,
      jsonb_build_object('threshold', v_threshold, 'expiry_date', v_row.expiry_date)
    ) is not null then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

comment on function public.drevora_generate_expiry_notifications() is
  'Office-only idempotent expiry notification scan for the caller''s verified company. Requires end-user JWT aal2. Safe to call repeatedly.';

revoke all on function public.drevora_generate_expiry_notifications() from public;
revoke all on function public.drevora_generate_expiry_notifications() from anon;
grant execute on function public.drevora_generate_expiry_notifications() to authenticated;

-- -----------------------------------------------------------------------------
-- Apply-time assertions
-- -----------------------------------------------------------------------------
do $$
declare
  v_oid regprocedure := 'public.drevora_generate_expiry_notifications()'::regprocedure;
  v_prosecdef boolean;
  v_search_path text;
  v_prosrc text;
begin
  select p.prosecdef, p.prosrc
    into v_prosecdef, v_prosrc
  from pg_proc p
  where p.oid = v_oid;

  if not coalesce(v_prosecdef, false) then
    raise exception 'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: function is not SECURITY DEFINER';
  end if;

  if position('drevora_auth_require_aal2' in coalesce(v_prosrc, '')) = 0 then
    raise exception 'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: AAL2 helper not present in function body';
  end if;

  if position('drevora_insert_admin_notification' in coalesce(v_prosrc, '')) = 0 then
    raise exception 'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: notification insert helper missing from body';
  end if;

  -- Canonical empty search_path in pg_proc.proconfig is search_path=""
  select cfg into v_search_path
  from pg_proc p
  cross join lateral unnest(coalesce(p.proconfig, '{}'::text[])) cfg
  where p.oid = v_oid
    and cfg like 'search_path=%';

  if v_search_path is distinct from 'search_path=""' then
    raise exception
      'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: search_path not pinned to empty string (got %)',
      v_search_path;
  end if;

  if has_function_privilege('public', v_oid, 'EXECUTE') then
    raise exception 'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: PUBLIC still has EXECUTE';
  end if;

  if to_regrole('anon') is not null
     and has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception 'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: anon still has EXECUTE';
  end if;

  if to_regrole('authenticated') is null
     or not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'EXPIRY_NOTIFICATIONS_AAL2_ASSERT: authenticated lost EXECUTE';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
