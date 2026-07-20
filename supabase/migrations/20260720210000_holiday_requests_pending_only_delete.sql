-- Restrict Holiday Request hard-delete to Pending rows for office roles.
-- Preserves Approved / Declined (Rejected) / Cancelled historical records.
-- Idempotent: drop + recreate the existing office delete policy.

drop policy if exists holiday_requests_office_delete on public.holiday_requests;

create policy holiday_requests_office_delete
  on public.holiday_requests
  for delete
  to authenticated
  using (
    company_id is not null
    and public.drevora_auth_user_has_office_role_for_company(company_id)
    and status = 'Pending'
  );

comment on policy holiday_requests_office_delete on public.holiday_requests is
  'Office members may hard-delete only Pending holiday requests in their company. Approved/Rejected/Cancelled history is preserved.';
