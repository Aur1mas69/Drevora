-- =============================================================================
-- DREVORA — Revoke anon EXECUTE on support-attachment storage helpers
-- File: supabase/migrations/20260802150000_revoke_anon_support_attachment_storage_execute.sql
-- =============================================================================
-- PURPOSE
--   Follow-up to 20260801130000_create_support_requests.sql.
--   That migration revoked EXECUTE from PUBLIC and granted EXECUTE to
--   authenticated, but did not explicitly revoke the separate `anon` role.
--   Supabase Security Advisor reports:
--     anon_security_definer_function_executable
--   for:
--     public.drevora_storage_can_access_support_attachment(text)
--     public.drevora_storage_can_write_support_attachment(text)
--
-- AUDIT CONCLUSION
--   Anonymous support attachment access is NOT used.
--   - storage.objects policies are TO authenticated only
--   - frontend uploads via authenticated Worker session (no RPC to these helpers)
--   - no public/unauthenticated support upload flow
--   Helpers are invoked only from storage RLS policy expressions for signed-in Workers.
--
-- SECURITY MODEL
--   - anon: no EXECUTE (intentional)
--   - public: no EXECUTE (intentional)
--   - authenticated: EXECUTE preserved (required for storage policy evaluation)
--   - Function bodies, SECURITY DEFINER, and storage policies unchanged
--   - service_role / owner privileges unchanged
--
-- SCOPE
--   Exactly these two function signatures. Does not address other authenticated
--   SECURITY DEFINER Advisor warnings or leaked-password protection.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

begin;

do $$
begin
  if to_regprocedure('public.drevora_storage_can_access_support_attachment(text)') is null
     or to_regprocedure('public.drevora_storage_can_write_support_attachment(text)') is null then
    raise exception
      'SUPPORT_ATTACH_REVOKE_PRECONDITION: support-attachment storage helpers missing; apply 20260801130000_create_support_requests.sql first';
  end if;
end $$;

-- Supabase may grant EXECUTE to anon separately from PUBLIC; revoke both.
-- Anonymous execution is intentionally denied: support attachments are Worker-auth only.

revoke all privileges on function public.drevora_storage_can_access_support_attachment(text) from anon;
revoke all privileges on function public.drevora_storage_can_access_support_attachment(text) from public;
grant execute on function public.drevora_storage_can_access_support_attachment(text) to authenticated;

revoke all privileges on function public.drevora_storage_can_write_support_attachment(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_support_attachment(text) from public;
grant execute on function public.drevora_storage_can_write_support_attachment(text) to authenticated;

comment on function public.drevora_storage_can_access_support_attachment(text) is
  'SECURITY DEFINER storage helper for support-attachments SELECT. EXECUTE: authenticated only; anon/public denied. Used by storage.objects policy support_attachments_select_own.';

comment on function public.drevora_storage_can_write_support_attachment(text) is
  'SECURITY DEFINER storage helper for support-attachments INSERT/DELETE. EXECUTE: authenticated only; anon/public denied. Used by storage.objects policies support_attachments_insert_own / support_attachments_delete_own.';

notify pgrst, 'reload schema';

commit;
