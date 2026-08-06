-- Hotfix: drevora_auth_user_driver_id must not use min(uuid).
-- PostgreSQL has no min(uuid) / max(uuid). The Worker Identity foundation
-- (20260806200000) introduced min(d.id) which breaks RLS-backed Worker pages.
--
-- Idempotent forward-only replace. Does not roll back identity foundation.
-- Apply manually on production after this file is deployed to the repo.

create or replace function public.drevora_auth_user_driver_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_id uuid := null;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Prefer immutable Auth link (exact-one active linked profile in membership company).
  -- UUID-safe exact-one pick: count(*) + (array_agg(... order by ...))[1]. Never min(uuid).
  select
    count(*)::integer,
    (array_agg(d.id order by d.id))[1]
  into v_count, v_id
  from public.drivers d
  where d.auth_user_id = auth.uid()
    and d.company_id is not null
    and d.archived_at is null
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_count = 1 then
    return v_id;
  end if;

  if v_count > 1 then
    -- Ambiguous Auth link — do not silently choose a Worker.
    return null;
  end if;

  -- Transitional email fallback only for rows not yet linked (auth_user_id is null).
  select
    count(*)::integer,
    (array_agg(d.id order by d.id))[1]
  into v_count, v_id
  from public.drivers d
  inner join auth.users u on u.id = auth.uid()
  where d.auth_user_id is null
    and lower(trim(coalesce(d.email, ''))) = lower(trim(coalesce(u.email, '')))
    and d.company_id is not null
    and d.archived_at is null
    and coalesce(trim(d.email), '') <> ''
    and public.drevora_auth_user_belongs_to_company_id(d.company_id);

  if v_count = 1 then
    return v_id;
  end if;

  -- Zero or multiple email matches — safe null (no silent pick).
  return null;
end;
$$;

comment on function public.drevora_auth_user_driver_id() is
  'Returns active Worker drivers.id. Prefers drivers.auth_user_id = auth.uid(); email match is temporary fallback only when auth_user_id is null. Exact-one match required (UUID-safe array_agg). Archived Workers resolve to NULL.';

revoke all on function public.drevora_auth_user_driver_id() from public;
revoke all on function public.drevora_auth_user_driver_id() from anon;
grant execute on function public.drevora_auth_user_driver_id() to authenticated;
grant execute on function public.drevora_auth_user_driver_id() to service_role;

notify pgrst, 'reload schema';
