REVOKE EXECUTE ON FUNCTION public.drevora_save_worker_core_document(text, uuid, uuid, text, text, uuid, text, date, date, text, text, boolean) FROM anon;

REVOKE EXECUTE ON FUNCTION public.drevora_normalize_worker_core_document_type(text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.drevora_worker_core_document_status(date) FROM anon;

REVOKE EXECUTE ON FUNCTION public.drevora_vehicle_check_is_final(text, timestamp with time zone) FROM anon;

REVOKE EXECUTE ON FUNCTION public.drevora_vehicle_check_is_worker_editable(text, timestamp with time zone) FROM anon;

REVOKE EXECUTE ON FUNCTION public.drevora_vehicle_check_is_worker_final(text, timestamp with time zone) FROM anon;
