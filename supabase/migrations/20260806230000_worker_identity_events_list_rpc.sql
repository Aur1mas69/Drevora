-- DREVORA — List Worker identity events (Office read RPC)
-- File: supabase/migrations/20260806230000_worker_identity_events_list_rpc.sql
--
-- Purpose:
--   Office-only SECURITY DEFINER RPC to list safe Worker identity/access history.
--   Resolves actor label via same-company Worker name or Auth email.
--   Never trusts a browser-supplied company ID.
--   Never returns auth_user_id, actor UUID, raw old_values/new_values, or tokens.
--
-- Idempotent. Does NOT apply itself — run manually after review.
-- Does not change historical event rows.

begin;

create or replace function public.drevora_list_worker_identity_events(
  p_driver_id uuid
)
returns table (
  id uuid,
  event_type text,
  created_at timestamptz,
  reason text,
  actor_label text,
  old_email text,
  new_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_driver_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = '22023',
            hint = 'Worker id is required.';
  end if;

  select d.company_id
  into v_company_id
  from public.drivers d
  where d.id = p_driver_id;

  if not found or v_company_id is null then
    raise exception 'WORKER_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'Worker not found.';
  end if;

  -- Resolve company from the Worker row only — never from browser input.
  if not exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.company_id = v_company_id
      and cm.is_active is true
  ) then
    raise exception 'FORBIDDEN'
      using errcode = '42501',
            hint = 'Active company membership is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  return query
  select
    e.id,
    e.event_type,
    e.created_at,
    e.reason,
    nullif(
      btrim(
        coalesce(
          nullif(
            btrim(
              concat_ws(
                ' ',
                nullif(btrim(coalesce(actor_driver.first_name, '')), ''),
                nullif(btrim(coalesce(actor_driver.last_name, '')), '')
              )
            ),
            ''
          ),
          nullif(btrim(coalesce(actor_auth.email::text, '')), '')
        )
      ),
      ''
    ) as actor_label,
    case
      when coalesce(e.old_values->>'email', '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
        then lower(btrim(e.old_values->>'email'))
      else null
    end as old_email,
    case
      when coalesce(e.new_values->>'email', '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
        then lower(btrim(e.new_values->>'email'))
      else null
    end as new_email
  from public.worker_identity_events e
  left join lateral (
    select d.first_name, d.last_name
    from public.drivers d
    where d.company_id = v_company_id
      and e.actor_user_id is not null
      and d.auth_user_id = e.actor_user_id
    order by d.archived_at nulls first, d.id
    limit 1
  ) actor_driver on true
  left join auth.users actor_auth
    on actor_auth.id = e.actor_user_id
  where e.driver_id = p_driver_id
    and e.company_id = v_company_id
  order by e.created_at desc, e.id desc;
end;
$$;

comment on function public.drevora_list_worker_identity_events(uuid) is
  'Office-only: list safe Worker identity/access events for one Worker in the caller company. Never trusts browser companyId. Never returns auth IDs, raw JSON, or tokens.';

revoke all on function public.drevora_list_worker_identity_events(uuid) from public;
revoke all on function public.drevora_list_worker_identity_events(uuid) from anon;
grant execute on function public.drevora_list_worker_identity_events(uuid) to authenticated;
revoke all on function public.drevora_list_worker_identity_events(uuid) from service_role;
grant execute on function public.drevora_list_worker_identity_events(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
