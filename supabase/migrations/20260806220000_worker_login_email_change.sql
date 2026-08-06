-- Worker login email change backend foundation.
-- Idempotent forward-only. Does NOT change Admin UI.
-- Apply manually before deploying Edge Function change-worker-login-email.
--
-- Adds:
--   1) worker_identity_events.event_type += login_email_changed
--   2) BEFORE UPDATE OF email guard: linked Workers require privileged change
--   3) drevora_finalize_worker_login_email_change — atomic profile email + audit

-- -----------------------------------------------------------------------------
-- 1) Audit event type
-- -----------------------------------------------------------------------------
alter table public.worker_identity_events
  drop constraint if exists worker_identity_events_event_type_check;

alter table public.worker_identity_events
  add constraint worker_identity_events_event_type_check check (
    event_type in (
      'auth_user_backfilled',
      'auth_user_linked',
      'identity_replacement_blocked',
      'login_email_changed'
    )
  );

-- -----------------------------------------------------------------------------
-- 2) Block direct client email changes once Auth-linked
-- -----------------------------------------------------------------------------
-- Unchanged email on ordinary Worker edits must not fail.
-- Only fires on UPDATE OF email; allow when values are equal, auth_user_id is
-- null, or session flag drevora.allow_worker_login_email_change = 'on'.

create or replace function public.drevora_drivers_login_email_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allow text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if lower(btrim(coalesce(new.email, ''))) = lower(btrim(coalesce(old.email, ''))) then
    return new;
  end if;

  if old.auth_user_id is null then
    return new;
  end if;

  v_allow := nullif(
    current_setting('drevora.allow_worker_login_email_change', true),
    ''
  );

  if v_allow is not distinct from 'on' then
    return new;
  end if;

  raise exception 'WORKER_LOGIN_EMAIL_CHANGE_REQUIRED'
    using errcode = 'P0001',
          hint = 'Login email for a linked Worker must be changed via the secure change-worker-login-email backend.';
end;
$$;

comment on function public.drevora_drivers_login_email_guard() is
  'BEFORE UPDATE OF email: linked Workers (auth_user_id set) cannot change email unless drevora.allow_worker_login_email_change=on for this transaction.';

drop trigger if exists drivers_login_email_guard on public.drivers;
create trigger drivers_login_email_guard
  before update of email
  on public.drivers
  for each row
  execute function public.drevora_drivers_login_email_guard();

-- -----------------------------------------------------------------------------
-- 3) Atomic finalize RPC (service_role / Edge only)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_finalize_worker_login_email_change(
  p_actor_user_id uuid,
  p_driver_id uuid,
  p_expected_auth_user_id uuid,
  p_old_email text,
  p_new_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_email text := lower(btrim(coalesce(p_old_email, '')));
  v_new_email text := lower(btrim(coalesce(p_new_email, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor_role text;
  v_driver public.drivers%rowtype;
  v_other_count integer := 0;
  v_event_id uuid;
begin
  if p_actor_user_id is null or p_driver_id is null or p_expected_auth_user_id is null then
    raise exception 'LOGIN_EMAIL_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'actor_user_id, driver_id and expected_auth_user_id are required.';
  end if;

  if v_old_email = '' or position('@' in v_old_email) = 0
     or v_new_email = '' or position('@' in v_new_email) = 0 then
    raise exception 'INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid old and new login email are required.';
  end if;

  if v_reason is null then
    raise exception 'LOGIN_EMAIL_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'A non-empty reason is required.';
  end if;

  select d.*
  into v_driver
  from public.drivers d
  where d.id = p_driver_id
  for update;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker was not found.';
  end if;

  if v_driver.company_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker has no company.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = v_driver.company_id
    and cm.is_active = true;

  if v_actor_role is null or v_actor_role not in (
    'Admin',
    'Transport Manager',
    'Supervisor',
    'Planner',
    'Office Staff'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may change Worker login email.';
  end if;

  if v_driver.archived_at is not null then
    raise exception 'WORKER_ARCHIVED'
      using errcode = 'P0001',
            hint = 'Archived Workers cannot change login email.';
  end if;

  if v_driver.auth_user_id is null then
    raise exception 'WORKER_AUTH_NOT_LINKED'
      using errcode = 'P0001',
            hint = 'Worker has no immutable Auth link.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id does not match the linked Worker profile.';
  end if;

  -- Idempotent: profile already on the requested email.
  if lower(btrim(coalesce(v_driver.email, ''))) = v_new_email then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_same_email',
      'driver_id', v_driver.id,
      'auth_user_id', v_driver.auth_user_id,
      'email', v_new_email,
      'changed', false
    );
  end if;

  if lower(btrim(coalesce(v_driver.email, ''))) is distinct from v_old_email then
    raise exception 'LOGIN_EMAIL_STATE_MISMATCH'
      using errcode = 'P0001',
            hint = 'Worker profile email no longer matches the Auth email snapshot.';
  end if;

  select count(*)::integer
  into v_other_count
  from public.drivers d
  where d.company_id = v_driver.company_id
    and d.archived_at is null
    and d.id is distinct from v_driver.id
    and lower(btrim(d.email)) = v_new_email;

  if v_other_count > 0 then
    raise exception 'EMAIL_ALREADY_IN_USE'
      using errcode = 'P0001',
            hint = 'An active Worker already uses this email in the company.';
  end if;

  -- Privileged path for linked email change (transaction-local).
  perform set_config('drevora.allow_worker_login_email_change', 'on', true);

  update public.drivers d
  set email = v_new_email
  where d.id = v_driver.id
    and d.auth_user_id = p_expected_auth_user_id
    and d.archived_at is null
  returning * into v_driver;

  if not found then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker could not be updated.';
  end if;

  if v_driver.auth_user_id is distinct from p_expected_auth_user_id then
    raise exception 'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = 'Auth user id must remain unchanged.';
  end if;

  v_event_id := public.drevora_insert_worker_identity_event(
    v_driver.company_id,
    v_driver.id,
    v_driver.auth_user_id,
    p_actor_user_id,
    'login_email_changed',
    jsonb_build_object(
      'email', v_old_email,
      'auth_user_id', p_expected_auth_user_id
    ),
    jsonb_build_object(
      'email', v_new_email,
      'auth_user_id', p_expected_auth_user_id
    ),
    v_reason
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'login_email_changed',
    'driver_id', v_driver.id,
    'auth_user_id', v_driver.auth_user_id,
    'email', v_new_email,
    'old_email', v_old_email,
    'event_id', v_event_id,
    'changed', true
  );
exception
  when unique_violation then
    raise exception 'EMAIL_ALREADY_IN_USE'
      using errcode = 'P0001',
            hint = 'An active Worker already uses this email in the company.';
end;
$$;

comment on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) is
  'Service-role: atomically update drivers.email for a linked Worker and write login_email_changed audit. Does not touch Auth. Never rebinds auth_user_id.';

revoke all on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.drevora_finalize_worker_login_email_change(uuid, uuid, uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
