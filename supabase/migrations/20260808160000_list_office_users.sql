-- DREVORA — List Office users (Settings → Office Users)
-- SECURITY DEFINER RPC: company-scoped Office memberships only.
-- Never returns Driver memberships. Never trusts browser companyId.
-- Requires: drevora_is_office_membership_role (20260808140000).
-- Idempotent. Does NOT apply itself — run manually after review.

begin;

create or replace function public.drevora_list_office_users()
returns table (
  membership_id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  select cm.company_id
  into v_company_id
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.is_active is true
    and public.drevora_is_office_membership_role(cm.role)
  order by cm.created_at asc
  limit 1;

  if v_company_id is null then
    raise exception 'FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(v_company_id) then
    raise exception 'FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  return query
  select
    cm.id as membership_id,
    nullif(
      btrim(
        coalesce(
          nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
          nullif(btrim(coalesce(u.raw_user_meta_data->>'name', '')), ''),
          nullif(btrim(coalesce(invite.full_name, '')), '')
        )
      ),
      ''
    ) as full_name,
    nullif(lower(btrim(coalesce(u.email::text, ''))), '') as email,
    cm.role,
    cm.is_active,
    cm.created_at
  from public.company_members cm
  left join auth.users u
    on u.id = cm.user_id
  left join lateral (
    select e.full_name
    from public.office_user_invitation_events e
    where e.company_id = v_company_id
      and e.auth_user_id = cm.user_id
      and e.status in ('linked', 'already_linked')
      and nullif(btrim(coalesce(e.full_name, '')), '') is not null
    order by e.created_at desc
    limit 1
  ) invite on true
  where cm.company_id = v_company_id
    and public.drevora_is_office_membership_role(cm.role)
    and cm.role is distinct from 'Driver'
  order by
    lower(coalesce(
      nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
      nullif(btrim(coalesce(u.email::text, '')), ''),
      cm.role
    )) asc,
    cm.created_at asc;
end;
$fn$;

comment on function public.drevora_list_office_users() is
  'Office-only: list company Office memberships (Admin/Manager/Office/Supervisor + legacy). Excludes Driver. Resolves company from caller membership. Never returns auth user ids.';

revoke all on function public.drevora_list_office_users() from public;
revoke all on function public.drevora_list_office_users() from anon;
grant execute on function public.drevora_list_office_users() to authenticated;
grant execute on function public.drevora_list_office_users() to service_role;

notify pgrst, 'reload schema';

commit;
