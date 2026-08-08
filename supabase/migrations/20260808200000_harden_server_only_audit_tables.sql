-- Harden server-only audit / dispatch tables for Supabase Security Advisor 0008
-- (rls_enabled_no_policy).
--
-- Tables:
--   public.office_user_invitation_events
--   public.worker_access_email_dispatches
--
-- Intent:
--   - Keep RLS ENABLED
--   - Explicit deny policies for anon + authenticated (no browser table access)
--   - Preserve REVOKE from client roles + GRANT to service_role
--   - Do NOT create service_role policies (service_role bypasses RLS)
--   - Do NOT grant client SELECT/INSERT/UPDATE/DELETE
--
-- Legitimate access remains:
--   - Edge Functions with service_role → SECURITY DEFINER RPCs
--   - drevora_list_office_users() (SECURITY DEFINER, authenticated EXECUTE)
--     which may read invitation full_name for Office Users UI (not direct table access)
--
-- Idempotent. Does not delete or modify existing rows.
-- Does NOT apply itself — run manually after review.

begin;

-- -----------------------------------------------------------------------------
-- 1) office_user_invitation_events
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.office_user_invitation_events') is null then
    raise exception
      'HARDEN_SERVER_ONLY_PRECONDITION: public.office_user_invitation_events missing — apply 20260808150000_office_user_invitation_foundation.sql first';
  end if;
end $$;

alter table public.office_user_invitation_events enable row level security;

revoke all on table public.office_user_invitation_events from public;
revoke all on table public.office_user_invitation_events from anon;
revoke all on table public.office_user_invitation_events from authenticated;
grant all on table public.office_user_invitation_events to service_role;

drop policy if exists office_user_invitation_events_deny_client_access
  on public.office_user_invitation_events;

create policy office_user_invitation_events_deny_client_access
  on public.office_user_invitation_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.office_user_invitation_events is
  'Append-only Office-user invitation audit. No browser SELECT/INSERT/UPDATE/DELETE. Writers are service-role / security-definer only. Explicit deny policy for anon/authenticated.';

-- -----------------------------------------------------------------------------
-- 2) worker_access_email_dispatches
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.worker_access_email_dispatches') is null then
    raise exception
      'HARDEN_SERVER_ONLY_PRECONDITION: public.worker_access_email_dispatches missing — apply 20260806240000_worker_access_email.sql first';
  end if;
end $$;

alter table public.worker_access_email_dispatches enable row level security;

revoke all on table public.worker_access_email_dispatches from public;
revoke all on table public.worker_access_email_dispatches from anon;
revoke all on table public.worker_access_email_dispatches from authenticated;
grant all on table public.worker_access_email_dispatches to service_role;

drop policy if exists worker_access_email_dispatches_deny_client_access
  on public.worker_access_email_dispatches;

create policy worker_access_email_dispatches_deny_client_access
  on public.worker_access_email_dispatches
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.worker_access_email_dispatches is
  'Private access-email send reservations. No browser SELECT/INSERT/UPDATE/DELETE. Writers are service-role SECURITY DEFINER RPCs only. Explicit deny policy for anon/authenticated.';

-- Reaffirm RPC EXECUTE least-privilege (no authenticated EXECUTE on writers).
revoke all on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) to service_role;

revoke all on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) from anon;
revoke all on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) from authenticated;
grant execute on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) to service_role;

revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from public;
revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from anon;
revoke all on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) from authenticated;
grant execute on function public.drevora_begin_worker_access_email_send(uuid, uuid, uuid, integer, integer) to service_role;

revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from public;
revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.drevora_finalize_worker_access_email_send(uuid, uuid, uuid, text, text) to service_role;

revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from public;
revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from anon;
revoke all on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) from authenticated;
grant execute on function public.drevora_fail_worker_access_email_send(uuid, uuid, text) to service_role;

-- list_office_users remains authenticated EXECUTE (SECURITY DEFINER; not direct table access).
revoke all on function public.drevora_list_office_users() from public;
revoke all on function public.drevora_list_office_users() from anon;
grant execute on function public.drevora_list_office_users() to authenticated;
grant execute on function public.drevora_list_office_users() to service_role;

notify pgrst, 'reload schema';

commit;
