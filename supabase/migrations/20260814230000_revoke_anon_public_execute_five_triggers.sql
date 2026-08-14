REVOKE EXECUTE ON FUNCTION public.drevora_drivers_auth_user_id_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.drevora_drivers_auth_user_id_guard() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.drevora_drivers_login_email_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.drevora_drivers_login_email_guard() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.drevora_enforce_timesheet_entries_immutable_when_locked() FROM anon;
REVOKE EXECUTE ON FUNCTION public.drevora_enforce_timesheet_entries_immutable_when_locked() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.drevora_validate_worker_submission_attachments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.drevora_validate_worker_submission_attachments() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.drevora_validate_worker_submission_completeness() FROM anon;
REVOKE EXECUTE ON FUNCTION public.drevora_validate_worker_submission_completeness() FROM PUBLIC;
