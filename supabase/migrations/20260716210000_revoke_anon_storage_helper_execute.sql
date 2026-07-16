-- =============================================================================
-- DREVORA — Revoke anon EXECUTE on Storage helper functions
-- File: supabase/migrations/20260716210000_revoke_anon_storage_helper_execute.sql
-- =============================================================================
-- PURPOSE
--   Follow-up to 20260716120000_secure_storage_tenant_policies.sql.
--   That migration revoked EXECUTE from PUBLIC and granted EXECUTE to
--   authenticated, but Supabase may retain or apply an explicit EXECUTE grant
--   on the `anon` role independently of PUBLIC. Live ACL after apply showed:
--     postgres=X, anon=X, authenticated=X, service_role=X
--   for public.drevora_storage_% helpers.
--
--   This migration explicitly revokes from both `anon` and PUBLIC, then
--   re-grants EXECUTE to authenticated only. Owner privileges are unchanged.
--
-- SCOPE
--   Exactly the 19 public.drevora_storage_* functions created/replaced by
--   20260716120000_secure_storage_tenant_policies.sql (signatures from that file).
--   Does NOT touch drevora_auth_* or unrelated functions.
--   Does NOT change policies, buckets, tables, rows, or Storage objects.
--
-- REVIEW ONLY until operator applies. Not executed by the authoring agent.
-- =============================================================================

-- Supabase may grant EXECUTE to anon separately from PUBLIC; revoke both.

-- 1) public.drevora_storage_try_parse_uuid(text)
revoke all privileges on function public.drevora_storage_try_parse_uuid(text) from anon;
revoke all privileges on function public.drevora_storage_try_parse_uuid(text) from public;
grant execute on function public.drevora_storage_try_parse_uuid(text) to authenticated;

-- 2) public.drevora_storage_path_company_id(text)
revoke all privileges on function public.drevora_storage_path_company_id(text) from anon;
revoke all privileges on function public.drevora_storage_path_company_id(text) from public;
grant execute on function public.drevora_storage_path_company_id(text) to authenticated;

-- 3) public.drevora_storage_object_company_id(text, text)
revoke all privileges on function public.drevora_storage_object_company_id(text, text) from anon;
revoke all privileges on function public.drevora_storage_object_company_id(text, text) from public;
grant execute on function public.drevora_storage_object_company_id(text, text) to authenticated;

-- 4) public.drevora_storage_worker_avatar_is_canonical(text)
revoke all privileges on function public.drevora_storage_worker_avatar_is_canonical(text) from anon;
revoke all privileges on function public.drevora_storage_worker_avatar_is_canonical(text) from public;
grant execute on function public.drevora_storage_worker_avatar_is_canonical(text) to authenticated;

-- 5) public.drevora_storage_worker_avatar_is_legacy(text)
revoke all privileges on function public.drevora_storage_worker_avatar_is_legacy(text) from anon;
revoke all privileges on function public.drevora_storage_worker_avatar_is_legacy(text) from public;
grant execute on function public.drevora_storage_worker_avatar_is_legacy(text) to authenticated;

-- 6) public.drevora_storage_worker_avatar_worker_id(text)
revoke all privileges on function public.drevora_storage_worker_avatar_worker_id(text) from anon;
revoke all privileges on function public.drevora_storage_worker_avatar_worker_id(text) from public;
grant execute on function public.drevora_storage_worker_avatar_worker_id(text) to authenticated;

-- 7) public.drevora_storage_can_select_worker_avatar(text)
revoke all privileges on function public.drevora_storage_can_select_worker_avatar(text) from anon;
revoke all privileges on function public.drevora_storage_can_select_worker_avatar(text) from public;
grant execute on function public.drevora_storage_can_select_worker_avatar(text) to authenticated;

-- 8) public.drevora_storage_can_write_worker_avatar(text)
revoke all privileges on function public.drevora_storage_can_write_worker_avatar(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_worker_avatar(text) from public;
grant execute on function public.drevora_storage_can_write_worker_avatar(text) to authenticated;

-- 9) public.drevora_storage_vehicle_check_ids_from_path(text)
revoke all privileges on function public.drevora_storage_vehicle_check_ids_from_path(text) from anon;
revoke all privileges on function public.drevora_storage_vehicle_check_ids_from_path(text) from public;
grant execute on function public.drevora_storage_vehicle_check_ids_from_path(text) to authenticated;

-- 10) public.drevora_storage_path_is_vehicle_check_signature(text)
revoke all privileges on function public.drevora_storage_path_is_vehicle_check_signature(text) from anon;
revoke all privileges on function public.drevora_storage_path_is_vehicle_check_signature(text) from public;
grant execute on function public.drevora_storage_path_is_vehicle_check_signature(text) to authenticated;

-- 11) public.drevora_storage_can_select_vehicle_check_file(text)
revoke all privileges on function public.drevora_storage_can_select_vehicle_check_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_select_vehicle_check_file(text) from public;
grant execute on function public.drevora_storage_can_select_vehicle_check_file(text) to authenticated;

-- 12) public.drevora_storage_can_write_vehicle_check_file(text)
revoke all privileges on function public.drevora_storage_can_write_vehicle_check_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_vehicle_check_file(text) from public;
grant execute on function public.drevora_storage_can_write_vehicle_check_file(text) to authenticated;

-- 13) public.drevora_storage_can_delete_vehicle_check_file(text)
revoke all privileges on function public.drevora_storage_can_delete_vehicle_check_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_delete_vehicle_check_file(text) from public;
grant execute on function public.drevora_storage_can_delete_vehicle_check_file(text) to authenticated;

-- 14) public.drevora_storage_can_select_consumable_receipt(text)
revoke all privileges on function public.drevora_storage_can_select_consumable_receipt(text) from anon;
revoke all privileges on function public.drevora_storage_can_select_consumable_receipt(text) from public;
grant execute on function public.drevora_storage_can_select_consumable_receipt(text) to authenticated;

-- 15) public.drevora_storage_can_write_consumable_receipt(text)
revoke all privileges on function public.drevora_storage_can_write_consumable_receipt(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_consumable_receipt(text) from public;
grant execute on function public.drevora_storage_can_write_consumable_receipt(text) to authenticated;

-- 16) public.drevora_storage_can_select_document_file(text)
revoke all privileges on function public.drevora_storage_can_select_document_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_select_document_file(text) from public;
grant execute on function public.drevora_storage_can_select_document_file(text) to authenticated;

-- 17) public.drevora_storage_can_write_document_file(text)
revoke all privileges on function public.drevora_storage_can_write_document_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_document_file(text) from public;
grant execute on function public.drevora_storage_can_write_document_file(text) to authenticated;

-- 18) public.drevora_storage_can_select_driver_report_file(text)
revoke all privileges on function public.drevora_storage_can_select_driver_report_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_select_driver_report_file(text) from public;
grant execute on function public.drevora_storage_can_select_driver_report_file(text) to authenticated;

-- 19) public.drevora_storage_can_write_driver_report_file(text)
revoke all privileges on function public.drevora_storage_can_write_driver_report_file(text) from anon;
revoke all privileges on function public.drevora_storage_can_write_driver_report_file(text) from public;
grant execute on function public.drevora_storage_can_write_driver_report_file(text) to authenticated;
