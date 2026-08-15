-- =============================================================================
-- DREVORA migration: 20260815120000_drivers_preferred_language
--
-- Purpose:
--   Persist a Worker UI language preference on public.drivers and allow the
--   authenticated Worker to update only that column via a SECURITY DEFINER RPC.
--
-- Safety:
--   - Adds preferred_language with default 'en' (existing rows stay English)
--   - CHECK constraint limits values to en/lt/pl/ro/ru
--   - Does not grant table-level UPDATE on drivers
--   - Worker identity derived only from auth.uid() via drevora_auth_user_driver_id()
--   - RPC updates ONLY drivers.preferred_language for the caller's active row
--   - EXECUTE granted only to authenticated (+ service_role when present);
--     PUBLIC and anon remain revoked
--   - Does not change existing RLS policies
--
-- Idempotent.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.drivers') is null then
    raise exception 'DREVORA STOP 20260815120000: public.drivers is missing';
  end if;

  if to_regprocedure('public.drevora_auth_user_driver_id()') is null then
    raise exception
      'DREVORA STOP 20260815120000: public.drevora_auth_user_driver_id() is missing';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Column
-- -----------------------------------------------------------------------------
alter table public.drivers
  add column if not exists preferred_language text not null default 'en';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_preferred_language_check'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      add constraint drivers_preferred_language_check
      check (preferred_language in ('en', 'lt', 'pl', 'ro', 'ru'));
  end if;
end $$;

comment on column public.drivers.preferred_language is
  'Worker UI language: en | lt | pl | ro | ru. Default en. Office/Admin stays English.';

-- -----------------------------------------------------------------------------
-- RPC: set the caller's preferred language
-- -----------------------------------------------------------------------------
create or replace function public.drevora_worker_set_preferred_language(
  p_language text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_id uuid;
  v_language text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_language := lower(btrim(coalesce(p_language, '')));
  if v_language not in ('en', 'lt', 'pl', 'ro', 'ru') then
    raise exception 'Unsupported language';
  end if;

  v_worker_id := public.drevora_auth_user_driver_id();
  if v_worker_id is null then
    raise exception 'Worker profile not found';
  end if;

  update public.drivers d
  set preferred_language = v_language
  where d.id = v_worker_id
    and d.archived_at is null;

  if not found then
    raise exception 'Unable to update language';
  end if;

  return v_language;
end;
$$;

comment on function public.drevora_worker_set_preferred_language(text) is
  'Worker-only: set drivers.preferred_language for the authenticated active Worker. Updates only that column. Allowed values: en, lt, pl, ro, ru.';

revoke all on function public.drevora_worker_set_preferred_language(text) from public;
revoke all on function public.drevora_worker_set_preferred_language(text) from anon;
grant execute on function public.drevora_worker_set_preferred_language(text) to authenticated;

do $$
begin
  if to_regrole('service_role') is not null then
    execute 'grant execute on function public.drevora_worker_set_preferred_language(text) to service_role';
  end if;
end $$;

commit;
