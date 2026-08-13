-- Office MFA is optional. Privileged Office WRITE helpers still exist, but
-- AAL2 is required only when the current authenticated user has a verified
-- MFA factor in auth.mfa_factors.
--
-- Canonical helpers (names unchanged so existing RPCs/RLS keep working):
--   public.drevora_auth_user_has_verified_mfa_factor()
--   public.drevora_auth_session_is_aal2()
--   public.drevora_auth_require_aal2()
--
-- Semantics after this migration:
--   - No verified MFA factor → AAL1 is valid (session helper returns true)
--   - Verified MFA factor exists → current JWT aal must be aal2
--
-- Factor state is read from auth.mfa_factors for auth.uid() only.
-- Never trusts a client-supplied MFA flag / aal body field.
-- Does not use IP address as an authentication factor.
--
-- Idempotent. Does NOT apply itself — run manually after review.
-- Does not edit historical migrations.

begin;

-- -----------------------------------------------------------------------------
-- Verified-factor lookup (SECURITY DEFINER: auth.mfa_factors is not readable
-- by authenticated). Bound to auth.uid() — no user_id argument.
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_user_has_verified_mfa_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.mfa_factors as f
    where f.user_id = (select auth.uid())
      and f.status = 'verified'
  );
$$;

comment on function public.drevora_auth_user_has_verified_mfa_factor() is
  'True when the current auth.uid() has at least one verified row in auth.mfa_factors. SECURITY DEFINER; no user_id argument; never trust client MFA flags.';

revoke all on function public.drevora_auth_user_has_verified_mfa_factor() from public;
revoke all on function public.drevora_auth_user_has_verified_mfa_factor() from anon;
revoke all on function public.drevora_auth_user_has_verified_mfa_factor() from authenticated;

-- -----------------------------------------------------------------------------
-- Session helper: AAL2, or AAL1 when the user has not enrolled MFA.
-- Name kept so existing Office WRITE RPCs and RLS policies pick up optional MFA
-- without per-object edits. SECURITY DEFINER so it can call the factor helper
-- without exposing that helper to authenticated. auth.jwt() still reads the
-- caller request JWT. Not for service_role end-user AAL checks.
-- -----------------------------------------------------------------------------
create or replace function public.drevora_auth_session_is_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    or not public.drevora_auth_user_has_verified_mfa_factor();
$$;

comment on function public.drevora_auth_session_is_aal2() is
  'Office MFA satisfied: JWT aal is aal2, or the current user has no verified MFA factor. For direct authenticated RPC/RLS paths only — not for service_role callers.';

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
  'Raises MFA_REQUIRED when the current user has a verified MFA factor and the JWT is not aal2. No-op for users without a verified factor. Call from Office WRITE RPCs under the caller session — never rely on this inside service_role Edge Function RPC paths for the end-user AAL.';

revoke all on function public.drevora_auth_session_is_aal2() from public;
revoke all on function public.drevora_auth_session_is_aal2() from anon;
grant execute on function public.drevora_auth_session_is_aal2() to authenticated;

revoke all on function public.drevora_auth_require_aal2() from public;
revoke all on function public.drevora_auth_require_aal2() from anon;
grant execute on function public.drevora_auth_require_aal2() to authenticated;

commit;
