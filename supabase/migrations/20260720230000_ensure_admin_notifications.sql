-- =============================================================================
-- DREVORA — Ensure Admin notifications backend (idempotent repair)
-- File: supabase/migrations/20260720230000_ensure_admin_notifications.sql
-- =============================================================================
-- PURPOSE
--   Live projects were returning PostgREST 404 for public.notifications because
--   the canonical migration 20260718020000_create_admin_notifications.sql had
--   not been applied (or tables were missing from the schema cache).
--
--   This repair:
--     1) Creates public.notifications + public.notification_reads if missing
--     2) Ensures indexes, RLS, office-scoped policies, and grants
--     3) Adds notification_reads UPDATE (required for mark-as-read upsert)
--     4) Ensures supabase_realtime publication membership (idempotent)
--     5) Reloads the PostgREST schema cache
--
-- SECURITY / TENANT ISOLATION
--   Notifications are company-owned (company_id).
--   Only office roles for that company may SELECT notifications.
--   Read state is per auth.users row; users may only manage their own reads.
--   Anon has no access. Workers have no SELECT on notifications.
--   Clients cannot INSERT/UPDATE/DELETE notifications rows (triggers/RPC only).
--
-- NOTE
--   Event triggers + drevora_generate_expiry_notifications remain defined by
--   20260718020000_create_admin_notifications.sql. This migration notices if
--   those RPCs are still missing so operators can apply the canonical file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Office-role helpers (same contract as tenant RLS / 20260718020000)
-- -----------------------------------------------------------------------------
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
-- 1) Tables (exact columns required by adminNotificationsService.ts)
-- -----------------------------------------------------------------------------
-- company_id: tenant ownership / isolation key
-- notification_type / severity / title / message: inbox display
-- entity_type / entity_id / target_path / metadata: deep-link + context
-- dedupe_key: per-company idempotency
-- created_at: ordering
-- notification_reads: per-user read_at (no dismissed column — mark-read only)

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
  'Company-scoped Admin/Office in-app notifications. Tenant isolated by company_id. Created by secured triggers/RPC only.';
comment on column public.notifications.company_id is
  'Tenant ownership key. Office members may only read rows for their verified company.';
comment on table public.notification_reads is
  'Per-user read state. One office user reading does not mark read for others.';

-- -----------------------------------------------------------------------------
-- 2) RLS + policies (no USING (true))
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

-- Upsert mark-as-read requires UPDATE (PostgREST ON CONFLICT DO UPDATE).
drop policy if exists notification_reads_update_own on public.notification_reads;
create policy notification_reads_update_own
  on public.notification_reads
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.notifications n
      where n.id = notification_id
        and public.drevora_auth_user_has_office_role_for_company(n.company_id)
    )
  )
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
grant select, insert, update, delete on public.notification_reads to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Realtime (idempotent — required by subscribeToAdminNotifications)
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
-- 4) Operator notice if canonical RPCs from 20260718020000 are still missing
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.drevora_generate_expiry_notifications()') is null then
    raise notice
      'DREVORA: notifications tables/RLS ensured, but drevora_generate_expiry_notifications() is missing. Apply migration 20260718020000_create_admin_notifications.sql for triggers and expiry scan.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
