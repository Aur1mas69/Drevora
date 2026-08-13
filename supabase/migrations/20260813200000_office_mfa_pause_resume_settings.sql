-- Office MFA Pause / Resume foundation.
-- Layers on 20260812200000_office_mfa_optional_aal2.sql (already applied live).
-- Does NOT edit that historical migration.
--
-- Product:
--   Pause  = mfa_enabled false; verified TOTP factor stays enrolled; AAL1 allowed
--   Resume = mfa_enabled true; reuse existing factor; AAL2 required when enabled
--   Remove / Add are Auth unenroll / enroll (not this migration)
--
-- Identity-scoped (auth.users), not company_members / companies.require_mfa.
-- Does not store TOTP secrets or IP addresses.
-- Never trusts a client-supplied user_id or MFA flag.
--
-- Central helper names are kept so existing Office WRITE RPCs/RLS keep working.
-- Idempotent. Does NOT apply itself — run manually after review.

begin;

-- -----------------------------------------------------------------------------
-- 0) Preconditions
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.drevora_auth_user_has_verified_mfa_factor()') is null then
    raise exception
      'OFFICE_MFA_PAUSE_RESUME_PRECONDITION: public.drevora_auth_user_has_verified_mfa_factor() missing — apply 20260812200000_office_mfa_optional_aal2.sql first';
  end if;

  if to_regprocedure('public.drevora_auth_session_is_aal2()') is null then
    raise exception
      'OFFICE_MFA_PAUSE_RESUME_PRECONDITION: public.drevora_auth_session_is_aal2() missing — apply 20260812200000_office_mfa_optional_aal2.sql first';
  end if;

  if to_regprocedure('public.drevora_set_updated_at()') is null then
    raise exception
      'OFFICE_MFA_PAUSE_RESUME_PRECONDITION: public.drevora_set_updated_at() missing';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1) Per-Auth-user MFA enforcement flag
-- -----------------------------------------------------------------------------
create table if not exists public.office_user_mfa_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mfa_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.office_user_mfa_settings is
  'Per Auth user Office MFA enforcement flag (Pause/Resume). Identity-scoped; not tenant-scoped. Does not store TOTP secrets or IP.';

comment on column public.office_user_mfa_settings.user_id is
  'auth.users.id. One row per Auth identity. Cascades on Auth user delete.';

comment on column public.office_user_mfa_settings.mfa_enabled is
  'true = Resume (AAL2 required when a verified factor exists). false = Pause (AAL1 allowed; factor may remain enrolled).';

drop trigger if exists office_user_mfa_settings_set_updated_at
  on public.office_user_mfa_settings;
create trigger office_user_mfa_settings_set_updated_at
  before update on public.office_user_mfa_settings
  for each row
  execute function public.drevora_set_updated_at();

alter table public.office_user_mfa_settings enable row level security;

revoke all on table public.office_user_mfa_settings from public;
revoke all on table public.office_user_mfa_settings from anon;
revoke all on table public.office_user_mfa_settings from authenticated;

drop policy if exists office_user_mfa_settings_deny_client_access
  on public.office_user_mfa_settings;
create policy office_user_mfa_settings_deny_client_access
  on public.office_user_mfa_settings
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- 2) Backfill: preserve current optional-MFA posture
--    Verified TOTP factor exists → mfa_enabled true.
--    No verified TOTP → no row (read helper returns false).
--    ON CONFLICT DO NOTHING so a later re-apply cannot un-pause a user.
-- -----------------------------------------------------------------------------
insert into public.office_user_mfa_settings (user_id, mfa_enabled, updated_at)
select distinct f.user_id, true, timezone('utc', now())
from auth.mfa_factors as f
where f.status::text = 'verified'
  and f.factor_type::text = 'totp'
  and f.user_id is not null
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3) Read helper — own row only; missing row = false
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_office_mfa_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.mfa_enabled
      from public.office_user_mfa_settings as s
      where s.user_id = (select auth.uid())
    ),
    false
  );
$$;

comment on function public.drevora_auth_office_mfa_is_enabled() is
  'True when the current auth.uid() has office_user_mfa_settings.mfa_enabled = true. Missing row is false. No user_id argument.';

revoke all on function public.drevora_auth_office_mfa_is_enabled() from public;
revoke all on function public.drevora_auth_office_mfa_is_enabled() from anon;
grant execute on function public.drevora_auth_office_mfa_is_enabled() to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Set-own RPC — Pause requires JWT AAL2; Resume allowed at AAL1.
--    Never unenrolls factors. Never accepts a user_id argument.
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_set_own_office_mfa_enabled(
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_enabled boolean;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  v_enabled := coalesce(p_enabled, false);

  -- Pause: require the real session AAL (JWT), not the MFA-satisfied helper.
  if v_enabled is not true then
    if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
      raise exception 'DREVORA: MFA_REQUIRED Two-factor authentication is required.';
    end if;
  end if;

  insert into public.office_user_mfa_settings as s (
    user_id,
    mfa_enabled,
    updated_at
  )
  values (
    v_uid,
    v_enabled,
    timezone('utc', now())
  )
  on conflict (user_id) do update
    set mfa_enabled = excluded.mfa_enabled,
        updated_at = timezone('utc', now());

  return v_enabled;
end;
$$;

comment on function public.drevora_auth_set_own_office_mfa_enabled(boolean) is
  'Sets the caller''s own MFA enforcement flag. Pause (false) requires JWT aal2 and does not unenroll factors. Resume (true) is allowed at AAL1. No user_id argument.';

revoke all on function public.drevora_auth_set_own_office_mfa_enabled(boolean) from public;
revoke all on function public.drevora_auth_set_own_office_mfa_enabled(boolean) from anon;
grant execute on function public.drevora_auth_set_own_office_mfa_enabled(boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Central session helper — Pause/Resume semantics
--    false  → AAL1 acceptable
--    true + verified factor → JWT must be aal2
--    true + no verified factor → not acceptable (fail closed until enrollment)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_session_is_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not public.drevora_auth_office_mfa_is_enabled()
    or (
      public.drevora_auth_user_has_verified_mfa_factor()
      and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    );
$$;

comment on function public.drevora_auth_session_is_aal2() is
  'Office MFA satisfied: enforcement paused (mfa_enabled false / missing row), or enforcement on with a verified factor and JWT aal2. Enabled without a verified factor is not satisfied. Direct authenticated RPC/RLS only — not service_role end-user AAL.';

create or replace function public.drevora_auth_require_aal2()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.drevora_auth_session_is_aal2() then
    raise exception 'DREVORA: MFA_REQUIRED Two-factor authentication is required.';
  end if;
end;
$$;

comment on function public.drevora_auth_require_aal2() is
  'Raises MFA_REQUIRED unless Office MFA is paused for the caller, or the caller has a verified factor and JWT aal2. Call from Office WRITE RPCs under the caller session — never inside service_role Edge Function RPC paths for the end-user AAL.';

revoke all on function public.drevora_auth_session_is_aal2() from public;
revoke all on function public.drevora_auth_session_is_aal2() from anon;
grant execute on function public.drevora_auth_session_is_aal2() to authenticated;

revoke all on function public.drevora_auth_require_aal2() from public;
revoke all on function public.drevora_auth_require_aal2() from anon;
grant execute on function public.drevora_auth_require_aal2() to authenticated;

-- Factor helper remains ungranted to authenticated (reads auth.mfa_factors).
revoke all on function public.drevora_auth_user_has_verified_mfa_factor() from public;
revoke all on function public.drevora_auth_user_has_verified_mfa_factor() from anon;
revoke all on function public.drevora_auth_user_has_verified_mfa_factor() from authenticated;

commit;
