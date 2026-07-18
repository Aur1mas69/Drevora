-- =============================================================================
-- DREVORA — Admin in-app notifications (persistent, per-user read state)
-- File: supabase/migrations/20260718020000_create_admin_notifications.sql
-- =============================================================================
-- PURPOSE
--   Office/Admin notification inbox backed by Supabase:
--     - public.notifications (company-scoped event feed)
--     - public.notification_reads (per auth.users read state)
--     - SECURITY DEFINER trigger helpers for event sources
--     - secured expiry scan RPC (no pg_cron dependency)
--     - Realtime publication for notifications inserts
--
-- SECURITY
--   Uses verified company_members membership (exact-one active row).
--   Office roles only: Admin, Transport Manager, Supervisor, Planner, Office Staff.
--   Workers / anon cannot SELECT notifications.
--   Frontend cannot INSERT/UPDATE/DELETE notifications.
--   No oldest-company fallback. Missing company scope => skip insert.
--
-- PREREQUISITES
--   public.company_members must exist.
--   Source tables should carry company_id (or parent drivers/vehicles.company_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Prerequisites + office-role helpers (idempotent)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.company_members') is null then
    raise exception
      'DREVORA STOP: public.company_members is missing. Apply tenant membership foundation before admin notifications.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'company_id'
  ) then
    raise exception
      'DREVORA STOP: drivers.company_id is missing. Apply tenant foundation (company_id) before admin notifications.';
  end if;
end;
$$;

-- Fail-closed helpers (same contract as Phase 3 tenant RLS). Safe to re-create.
create or replace function public.drevora_auth_user_belongs_to_company_id(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.company_id = p_company_id
    );
$$;

create or replace function public.drevora_auth_user_has_office_role_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.company_id = p_company_id
        and cm.role in (
          'Admin',
          'Transport Manager',
          'Supervisor',
          'Planner',
          'Office Staff'
        )
    );
$$;

create or replace function public.drevora_auth_user_has_office_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select count(*)::integer
      from public.company_members x
      where x.user_id = auth.uid()
        and x.is_active = true
    ) = 1
    and exists (
      select 1
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.role in (
          'Admin',
          'Transport Manager',
          'Supervisor',
          'Planner',
          'Office Staff'
        )
    );
$$;

revoke all on function public.drevora_auth_user_belongs_to_company_id(uuid) from public;
revoke all on function public.drevora_auth_user_has_office_role_for_company(uuid) from public;
revoke all on function public.drevora_auth_user_has_office_role() from public;
grant execute on function public.drevora_auth_user_belongs_to_company_id(uuid) to authenticated;
grant execute on function public.drevora_auth_user_has_office_role_for_company(uuid) to authenticated;
grant execute on function public.drevora_auth_user_has_office_role() to authenticated;

-- -----------------------------------------------------------------------------
-- 1) Tables
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  notification_type text not null,
  severity text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  target_path text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint notifications_severity_check check (
    severity in ('info', 'warning', 'critical')
  ),
  constraint notifications_type_check check (
    notification_type in (
      'timesheet_submitted',
      'holiday_request_created',
      'vehicle_check_attention',
      'tyre_check_critical',
      'driver_report_created',
      'document_expiry'
    )
  ),
  constraint notifications_company_dedupe_unique unique (company_id, dedupe_key)
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notifications_company_id_idx
  on public.notifications (company_id);
create index if not exists notifications_created_at_desc_idx
  on public.notifications (created_at desc);
create index if not exists notifications_severity_idx
  on public.notifications (severity);
create index if not exists notifications_type_idx
  on public.notifications (notification_type);
create index if not exists notifications_company_created_idx
  on public.notifications (company_id, created_at desc);

create index if not exists notification_reads_user_id_idx
  on public.notification_reads (user_id);
create index if not exists notification_reads_notification_id_idx
  on public.notification_reads (notification_id);

comment on table public.notifications is
  'Company-scoped Admin/Office in-app notifications. Created by secured triggers/RPC only.';
comment on column public.notifications.company_id is
  'Immutable tenant key from the source record / verified parent. Never from browser session.';
comment on column public.notifications.dedupe_key is
  'Idempotency key unique per company. Prevents duplicate event notifications.';
comment on column public.notifications.severity is
  'info | warning | critical';
comment on column public.notifications.target_path is
  'Admin SPA path for navigation after click.';
comment on table public.notification_reads is
  'Per-user read state for notifications. One Admin reading does not mark read for others.';

-- -----------------------------------------------------------------------------
-- 2) RLS
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;
revoke all on public.notification_reads from anon;
revoke all on public.notification_reads from authenticated;

drop policy if exists notifications_select_office_company on public.notifications;
create policy notifications_select_office_company
  on public.notifications
  for select
  to authenticated
  using (
    public.drevora_auth_user_has_office_role_for_company(company_id)
  );

drop policy if exists notification_reads_select_own on public.notification_reads;
create policy notification_reads_select_own
  on public.notification_reads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.notifications n
      where n.id = notification_id
        and public.drevora_auth_user_has_office_role_for_company(n.company_id)
    )
  );

drop policy if exists notification_reads_insert_own on public.notification_reads;
create policy notification_reads_insert_own
  on public.notification_reads
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.notifications n
      where n.id = notification_id
        and public.drevora_auth_user_has_office_role_for_company(n.company_id)
    )
  );

drop policy if exists notification_reads_delete_own on public.notification_reads;
create policy notification_reads_delete_own
  on public.notification_reads
  for delete
  to authenticated
  using (
    user_id = auth.uid()
  );

grant select on public.notifications to authenticated;
grant select, insert, delete on public.notification_reads to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Insert helper + company resolution
-- -----------------------------------------------------------------------------
create or replace function public.drevora_notification_resolve_company_id(
  p_explicit_company_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if p_explicit_company_id is not null then
    return p_explicit_company_id;
  end if;

  if p_driver_id is not null then
    select d.company_id
      into v_company_id
    from public.drivers d
    where d.id = p_driver_id;

    if v_company_id is not null then
      return v_company_id;
    end if;
  end if;

  if p_vehicle_id is not null then
    select v.company_id
      into v_company_id
    from public.vehicles v
    where v.id = p_vehicle_id;

    if v_company_id is not null then
      return v_company_id;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.drevora_notification_resolve_company_id(uuid, uuid, uuid) from public;

create or replace function public.drevora_insert_admin_notification(
  p_company_id uuid,
  p_notification_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid,
  p_target_path text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_company_id is null or nullif(trim(p_dedupe_key), '') is null then
    return null;
  end if;

  insert into public.notifications (
    company_id,
    notification_type,
    severity,
    title,
    message,
    entity_type,
    entity_id,
    target_path,
    metadata,
    dedupe_key
  )
  values (
    p_company_id,
    p_notification_type,
    p_severity,
    p_title,
    p_message,
    p_entity_type,
    p_entity_id,
    p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    p_dedupe_key
  )
  on conflict (company_id, dedupe_key) do nothing
  returning id into v_id;

  return v_id;
exception
  when others then
    -- Never block the source business transaction.
    raise warning 'DREVORA notification insert skipped: %', sqlerrm;
    return null;
end;
$$;

revoke all on function public.drevora_insert_admin_notification(uuid, text, text, text, text, text, uuid, text, text, jsonb) from public;

create or replace function public.drevora_notification_worker_label(p_driver_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(concat_ws(' ', d.first_name, d.last_name)), ''),
    'a worker'
  )
  from public.drivers d
  where d.id = p_driver_id;
$$;

revoke all on function public.drevora_notification_worker_label(uuid) from public;

create or replace function public.drevora_notification_vehicle_label(p_vehicle_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(v.registration), ''),
    nullif(trim(v.fleet_number), ''),
    'a vehicle'
  )
  from public.vehicles v
  where v.id = p_vehicle_id;
$$;

revoke all on function public.drevora_notification_vehicle_label(uuid) from public;

-- -----------------------------------------------------------------------------
-- 4) Event triggers
-- -----------------------------------------------------------------------------

-- A) Timesheet submitted
create or replace function public.drevora_notify_timesheet_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_worker text;
  v_week text;
  v_submitted_marker text;
begin
  if tg_op = 'UPDATE'
     and coalesce(old.status, '') = 'Submitted'
     and new.status = 'Submitted' then
    return new;
  end if;

  if new.status is distinct from 'Submitted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'Submitted' then
    return new;
  end if;

  v_company_id := public.drevora_notification_resolve_company_id(
    null,
    new.driver_id,
    new.vehicle_id
  );
  if v_company_id is null then
    return new;
  end if;

  v_worker := coalesce(public.drevora_notification_worker_label(new.driver_id), 'a worker');
  v_week := coalesce(to_char(new.week_start, 'DD Mon YYYY'), 'this week');
  v_submitted_marker := coalesce(
    to_char(new.submitted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  perform public.drevora_insert_admin_notification(
    v_company_id,
    'timesheet_submitted',
    'info',
    'Timesheet submitted',
    v_worker || ' submitted timesheet for week of ' || v_week || '.',
    'timesheet',
    new.id,
    '/admin/timesheets',
    'timesheet_submitted:' || new.id::text || ':' || v_submitted_marker,
    jsonb_build_object('week_start', new.week_start)
  );

  return new;
end;
$$;

drop trigger if exists drevora_notify_timesheet_submitted on public.timesheets;
create trigger drevora_notify_timesheet_submitted
  after insert or update of status, submitted_at
  on public.timesheets
  for each row
  execute function public.drevora_notify_timesheet_submitted();

-- B) Holiday request created (pending)
create or replace function public.drevora_notify_holiday_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_worker text;
begin
  if new.status is distinct from 'Pending' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Do not re-notify ordinary office status churn.
    return new;
  end if;

  v_company_id := public.drevora_notification_resolve_company_id(
    null,
    new.worker_id,
    null
  );
  if v_company_id is null then
    return new;
  end if;

  v_worker := coalesce(public.drevora_notification_worker_label(new.worker_id), 'a worker');

  perform public.drevora_insert_admin_notification(
    v_company_id,
    'holiday_request_created',
    'info',
    'New holiday request',
    v_worker || ' requested leave '
      || coalesce(to_char(new.start_date, 'DD Mon YYYY'), '?')
      || ' – '
      || coalesce(to_char(new.end_date, 'DD Mon YYYY'), '.')
      || '.',
    'holiday_request',
    new.id,
    '/admin/holidays',
    'holiday_request_created:' || new.id::text,
    '{}'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists drevora_notify_holiday_request_created on public.holiday_requests;
create trigger drevora_notify_holiday_request_created
  after insert
  on public.holiday_requests
  for each row
  execute function public.drevora_notify_holiday_request_created();

-- C) Vehicle check failed / defects
create or replace function public.drevora_notify_vehicle_check_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_worker text;
  v_vehicle text;
  v_fail_items integer := 0;
  v_advisory_items integer := 0;
  v_severity text;
  v_title text;
  v_message text;
  v_is_final boolean;
begin
  v_is_final :=
    new.status = 'Completed'
    or new.inspection_completed_at is not null
    or new.signed_at is not null;

  if not v_is_final then
    return new;
  end if;

  -- Fire once when becoming final (or insert already final).
  if tg_op = 'UPDATE' then
    if (
      old.status = 'Completed'
      or old.inspection_completed_at is not null
      or old.signed_at is not null
    ) then
      return new;
    end if;
  end if;

  select
    count(*) filter (where i.result = 'Fail'),
    count(*) filter (where i.result = 'Advisory')
  into v_fail_items, v_advisory_items
  from public.vehicle_check_items i
  where i.vehicle_check_id = new.id;

  if new.overall_result = 'Pass'
     and coalesce(v_fail_items, 0) = 0
     and coalesce(v_advisory_items, 0) = 0 then
    return new;
  end if;

  if new.overall_result = 'Fail' or coalesce(v_fail_items, 0) > 0 then
    v_severity := 'critical';
    v_title := 'Vehicle check needs attention';
  elsif new.overall_result = 'Advisory' or coalesce(v_advisory_items, 0) > 0 then
    v_severity := 'warning';
    v_title := 'Vehicle check advisory';
  else
    return new;
  end if;

  v_company_id := public.drevora_notification_resolve_company_id(
    null,
    new.worker_id,
    new.vehicle_id
  );
  if v_company_id is null then
    return new;
  end if;

  v_worker := coalesce(public.drevora_notification_worker_label(new.worker_id), 'a worker');
  v_vehicle := coalesce(public.drevora_notification_vehicle_label(new.vehicle_id), 'a vehicle');
  v_message :=
    v_vehicle || ' — ' || v_worker
    || case
         when coalesce(v_fail_items, 0) > 0 then
           ': ' || v_fail_items::text || ' failed item(s)'
         when coalesce(v_advisory_items, 0) > 0 then
           ': ' || v_advisory_items::text || ' advisory item(s)'
         else
           ' requires review'
       end
    || '.';

  perform public.drevora_insert_admin_notification(
    v_company_id,
    'vehicle_check_attention',
    v_severity,
    v_title,
    v_message,
    'vehicle_check',
    new.id,
    '/admin/vehicle-checks',
    'vehicle_check_attention:' || new.id::text,
    jsonb_build_object(
      'overall_result', new.overall_result,
      'fail_items', coalesce(v_fail_items, 0),
      'advisory_items', coalesce(v_advisory_items, 0)
    )
  );

  return new;
end;
$$;

drop trigger if exists drevora_notify_vehicle_check_attention on public.vehicle_checks;
create trigger drevora_notify_vehicle_check_attention
  after insert or update of status, overall_result, inspection_completed_at, signed_at
  on public.vehicle_checks
  for each row
  execute function public.drevora_notify_vehicle_check_attention();

-- D) Critical tyre check (only if table exists)
do $$
begin
  if to_regclass('public.tyre_checks') is null then
    raise notice 'DREVORA: tyre_checks missing — tyre notification trigger skipped.';
    return;
  end if;

  execute $fn$
    create or replace function public.drevora_notify_tyre_check_critical()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_company_id uuid;
      v_truck text;
      v_trailer text;
      v_label text;
      v_issues integer;
    begin
      if new.status is distinct from 'submitted' then
        return new;
      end if;

      if tg_op = 'UPDATE' and coalesce(old.status, '') = 'submitted' then
        return new;
      end if;

      if coalesce(new.critical_count, 0) <= 0
         and coalesce(new.defect_count, 0) <= 0
         and coalesce(new.overall_result, '') is distinct from 'fail' then
        return new;
      end if;

      v_company_id := new.company_id;
      if v_company_id is null then
        return new;
      end if;

      v_truck := coalesce(public.drevora_notification_vehicle_label(new.vehicle_id), 'Truck');
      v_trailer := case
        when new.trailer_vehicle_id is not null then
          coalesce(public.drevora_notification_vehicle_label(new.trailer_vehicle_id), 'Trailer')
        else null
      end;
      v_label := case
        when v_trailer is not null then v_truck || ' / ' || v_trailer
        else v_truck
      end;
      v_issues := greatest(
        coalesce(new.critical_count, 0) + coalesce(new.defect_count, 0),
        1
      );

      perform public.drevora_insert_admin_notification(
        v_company_id,
        'tyre_check_critical',
        'critical',
        'Critical tyre issue',
        v_label || ' — ' || v_issues::text || ' critical/defective tyre(s).',
        'tyre_check',
        new.id,
        '/admin/vehicle-checks',
        'tyre_check_critical:' || new.id::text,
        jsonb_build_object(
          'critical_count', coalesce(new.critical_count, 0),
          'defect_count', coalesce(new.defect_count, 0),
          'overall_result', new.overall_result
        )
      );

      return new;
    end;
    $body$;
  $fn$;

  execute 'drop trigger if exists drevora_notify_tyre_check_critical on public.tyre_checks';
  execute $trg$
    create trigger drevora_notify_tyre_check_critical
      after insert or update of status, overall_result, critical_count, defect_count
      on public.tyre_checks
      for each row
      execute function public.drevora_notify_tyre_check_critical()
  $trg$;
end;
$$;

-- E) Driver report created
create or replace function public.drevora_notify_driver_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_severity text;
  v_worker text;
  v_vehicle text;
  v_bits text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  v_severity := case new.priority
    when 'Critical' then 'critical'
    when 'High' then 'warning'
    else 'info'
  end;

  v_company_id := public.drevora_notification_resolve_company_id(
    null,
    new.worker_id,
    new.vehicle_id
  );
  if v_company_id is null then
    return new;
  end if;

  v_worker := public.drevora_notification_worker_label(new.worker_id);
  v_vehicle := public.drevora_notification_vehicle_label(new.vehicle_id);
  v_bits := concat_ws(
    ' · ',
    nullif(trim(new.report_type), ''),
    nullif(v_worker, 'a worker'),
    nullif(v_vehicle, 'a vehicle'),
    nullif(trim(new.location), '')
  );

  perform public.drevora_insert_admin_notification(
    v_company_id,
    'driver_report_created',
    v_severity,
    'New driver report',
    coalesce(nullif(v_bits, ''), coalesce(nullif(trim(new.title), ''), 'A new driver report was submitted.')),
    'driver_report',
    new.id,
    '/admin/driver-reports',
    'driver_report_created:' || new.id::text,
    jsonb_build_object('priority', new.priority, 'status', new.status)
  );

  return new;
end;
$$;

drop trigger if exists drevora_notify_driver_report_created on public.driver_reports;
create trigger drevora_notify_driver_report_created
  after insert
  on public.driver_reports
  for each row
  execute function public.drevora_notify_driver_report_created();

-- -----------------------------------------------------------------------------
-- 5) Expiry scan RPC (idempotent; no pg_cron required)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_generate_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = public
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

revoke all on function public.drevora_generate_expiry_notifications() from public;
grant execute on function public.drevora_generate_expiry_notifications() to authenticated;

comment on function public.drevora_generate_expiry_notifications() is
  'Office-only idempotent expiry notification scan for the caller''s verified company. Safe to call repeatedly.';

-- -----------------------------------------------------------------------------
-- 6) Realtime (idempotent)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  else
    raise notice 'DREVORA: supabase_realtime publication missing — skip Realtime add.';
  end if;
end;
$$;

alter table public.notifications replica identity full;

-- -----------------------------------------------------------------------------
-- 7) Reload PostgREST schema cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
