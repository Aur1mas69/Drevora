-- Office-user invitation foundation
-- Creates audit trail + service-role RPC to link company_members only.
-- Does NOT create drivers rows. Does NOT change Worker invite flow.
-- Target membership roles (stored distinctly): Admin | Manager | Office | Supervisor
-- Actor must have Office access (MVP + legacy Office membership roles).

-- -----------------------------------------------------------------------------
-- 1) Append-only Office invitation audit
-- -----------------------------------------------------------------------------
create table if not exists public.office_user_invitation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  invited_email text not null,
  invited_role text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  auth_user_id uuid null references auth.users (id) on delete set null,
  membership_id uuid null references public.company_members (id) on delete set null,
  full_name text null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint office_user_invitation_events_invited_role_check check (
    invited_role in ('Admin', 'Manager', 'Office', 'Supervisor')
  ),
  constraint office_user_invitation_events_status_check check (
    status in (
      'linked',
      'already_linked',
      'link_failed',
      'invite_send_failed',
      'email_failed'
    )
  )
);

comment on table public.office_user_invitation_events is
  'Append-only Office-user invitation audit. No drivers rows. Writers are service-role / security-definer only.';

create index if not exists office_user_invitation_events_company_created_at_idx
  on public.office_user_invitation_events (company_id, created_at desc);

create index if not exists office_user_invitation_events_email_created_at_idx
  on public.office_user_invitation_events (lower(invited_email), created_at desc);

create index if not exists office_user_invitation_events_auth_user_id_idx
  on public.office_user_invitation_events (auth_user_id)
  where auth_user_id is not null;

alter table public.office_user_invitation_events enable row level security;

revoke all on table public.office_user_invitation_events from public;
revoke all on table public.office_user_invitation_events from anon;
revoke all on table public.office_user_invitation_events from authenticated;
grant all on table public.office_user_invitation_events to service_role;

-- -----------------------------------------------------------------------------
-- 2) Link invited Office Auth user → company_members only
-- -----------------------------------------------------------------------------
create or replace function public.drevora_link_invited_office_user(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_role text,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := nullif(btrim(coalesce(p_role, '')), '');
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_actor_role text;
  v_company_exists boolean := false;
  v_membership public.company_members%rowtype;
  v_other_active integer := 0;
  v_created_membership boolean := false;
  v_reactivated_membership boolean := false;
  v_event_id uuid;
  v_status text;
begin
  if p_actor_user_id is null or p_company_id is null or p_auth_user_id is null then
    raise exception 'OFFICE_INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'actor_user_id, company_id and auth_user_id are required.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'OFFICE_INVITE_INVALID_EMAIL'
      using errcode = 'P0001',
            hint = 'A valid Office user email is required.';
  end if;

  if v_role is null or v_role not in ('Admin', 'Manager', 'Office', 'Supervisor') then
    raise exception 'OFFICE_INVITE_INVALID_ROLE'
      using errcode = 'P0001',
            hint = 'Target role must be Admin, Manager, Office, or Supervisor.';
  end if;

  -- Reject Driver explicitly (also covered by allowlist above).
  if v_role = 'Driver' then
    raise exception 'OFFICE_INVITE_INVALID_ROLE'
      using errcode = 'P0001',
            hint = 'Driver is not an Office invitation role.';
  end if;

  select exists(select 1 from public.companies c where c.id = p_company_id)
  into v_company_exists;

  if not v_company_exists then
    raise exception 'OFFICE_INVITE_COMPANY_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'Company was not found.';
  end if;

  select cm.role
  into v_actor_role
  from public.company_members cm
  where cm.user_id = p_actor_user_id
    and cm.company_id = p_company_id
    and cm.is_active = true;

  if v_actor_role is null
     or not public.drevora_is_office_membership_role(v_actor_role) then
    raise exception 'OFFICE_INVITE_FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Only Office membership roles may invite Office users.';
  end if;

  -- Serialize concurrent invites for the same Auth user.
  perform pg_advisory_xact_lock(
    872014552,
    hashtext(p_auth_user_id::text)
  );

  select count(*)::integer
  into v_other_active
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.is_active = true
    and cm.company_id is distinct from p_company_id;

  if v_other_active > 0 then
    raise exception 'USER_ALREADY_LINKED_TO_ANOTHER_COMPANY'
      using errcode = 'P0001',
            hint = 'Auth user already has an active membership in another company.';
  end if;

  select cm.*
  into v_membership
  from public.company_members cm
  where cm.user_id = p_auth_user_id
    and cm.company_id = p_company_id
  for update;

  if found then
    if v_membership.is_active then
      -- Active Worker membership cannot be converted via Office invite.
      if v_membership.role = 'Driver'
         or not public.drevora_is_office_membership_role(v_membership.role) then
        raise exception 'OFFICE_INVITE_EMAIL_CONFLICT'
          using errcode = 'P0001',
                hint = 'This Auth user already has a non-Office membership in this company.';
      end if;

      -- Idempotent: keep existing Office role (do not silently overwrite).
      v_status := 'already_linked';

      insert into public.office_user_invitation_events (
        company_id,
        invited_email,
        invited_role,
        actor_user_id,
        auth_user_id,
        membership_id,
        full_name,
        status,
        details
      )
      values (
        p_company_id,
        v_email,
        v_role,
        p_actor_user_id,
        p_auth_user_id,
        v_membership.id,
        v_full_name,
        v_status,
        jsonb_build_object(
          'existing_role', v_membership.role,
          'requested_role', v_role,
          'created_membership', false,
          'reactivated_membership', false
        )
      )
      returning id into v_event_id;

      return jsonb_build_object(
        'ok', true,
        'code', 'already_linked',
        'membership_id', v_membership.id,
        'membership_role', v_membership.role,
        'auth_user_id', p_auth_user_id,
        'company_id', p_company_id,
        'created_membership', false,
        'reactivated_membership', false,
        'event_id', v_event_id
      );
    end if;

    -- Reactivate inactive membership with the invited Office role.
    update public.company_members
    set
      role = v_role,
      is_active = true,
      updated_at = timezone('utc', now())
    where id = v_membership.id
    returning * into v_membership;

    v_reactivated_membership := true;
    v_status := 'linked';
  else
    insert into public.company_members (
      user_id,
      company_id,
      role,
      is_active
    )
    values (
      p_auth_user_id,
      p_company_id,
      v_role,
      true
    )
    returning * into v_membership;

    v_created_membership := true;
    v_status := 'linked';
  end if;

  -- Safety: never leave a Driver membership from this RPC path.
  if v_membership.role = 'Driver'
     or not public.drevora_is_office_membership_role(v_membership.role) then
    raise exception 'OFFICE_INVITE_PARTIAL_LINK_FAILED'
      using errcode = 'P0001',
            hint = 'Office invite did not produce an Office membership role.';
  end if;

  insert into public.office_user_invitation_events (
    company_id,
    invited_email,
    invited_role,
    actor_user_id,
    auth_user_id,
    membership_id,
    full_name,
    status,
    details
  )
  values (
    p_company_id,
    v_email,
    v_role,
    p_actor_user_id,
    p_auth_user_id,
    v_membership.id,
    v_full_name,
    v_status,
    jsonb_build_object(
      'membership_role', v_membership.role,
      'created_membership', v_created_membership,
      'reactivated_membership', v_reactivated_membership
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'linked',
    'membership_id', v_membership.id,
    'membership_role', v_membership.role,
    'auth_user_id', p_auth_user_id,
    'company_id', p_company_id,
    'created_membership', v_created_membership,
    'reactivated_membership', v_reactivated_membership,
    'event_id', v_event_id
  );
exception
  when unique_violation then
    raise exception 'OFFICE_INVITE_DUPLICATE_MEMBERSHIP'
      using errcode = 'P0001',
            hint = 'An active company membership already exists for this user.';
end;
$fn$;

comment on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) is
  'Service-role: link Auth user as Office company_members row (Admin/Manager/Office/Supervisor). Never creates drivers. Audits to office_user_invitation_events.';

revoke all on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.drevora_link_invited_office_user(uuid, uuid, uuid, text, text, text) to service_role;

-- Optional helper for Edge Function failure audits (service_role table write also works).
create or replace function public.drevora_insert_office_user_invitation_event(
  p_company_id uuid,
  p_invited_email text,
  p_invited_role text,
  p_actor_user_id uuid,
  p_auth_user_id uuid,
  p_membership_id uuid,
  p_full_name text,
  p_status text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_invited_email, '')));
  v_role text := nullif(btrim(coalesce(p_invited_role, '')), '');
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if p_company_id is null or v_email = '' or v_role is null or v_status is null then
    raise exception 'OFFICE_INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'company_id, invited_email, invited_role and status are required.';
  end if;

  if v_role not in ('Admin', 'Manager', 'Office', 'Supervisor') then
    raise exception 'OFFICE_INVITE_INVALID_ROLE'
      using errcode = 'P0001',
            hint = 'invited_role must be an MVP Office system role.';
  end if;

  if v_status not in (
    'linked',
    'already_linked',
    'link_failed',
    'invite_send_failed',
    'email_failed'
  ) then
    raise exception 'OFFICE_INVITE_INVALID_ARGUMENT'
      using errcode = 'P0001',
            hint = 'status is invalid.';
  end if;

  insert into public.office_user_invitation_events (
    company_id,
    invited_email,
    invited_role,
    actor_user_id,
    auth_user_id,
    membership_id,
    full_name,
    status,
    details
  )
  values (
    p_company_id,
    v_email,
    v_role,
    p_actor_user_id,
    p_auth_user_id,
    p_membership_id,
    nullif(btrim(coalesce(p_full_name, '')), ''),
    v_status,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

comment on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) is
  'Service-role append-only writer for office_user_invitation_events.';

revoke all on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) from anon;
revoke all on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) from authenticated;
grant execute on function public.drevora_insert_office_user_invitation_event(uuid, text, text, uuid, uuid, uuid, text, text, jsonb) to service_role;
