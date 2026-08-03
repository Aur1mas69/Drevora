-- Account deletion requests (Worker self-service, 30-day delayed anonymisation).
--
-- Idempotent. Does NOT apply itself — run manually in the Supabase SQL editor after review.
-- Does NOT delete Auth users, anonymise Workers, or schedule cron — that is Edge Function work.
--
-- Client: SELECT own rows only. No INSERT/UPDATE/DELETE for authenticated/anon.
-- Writes: service_role / Edge Function delete-account only.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid null references public.drivers (id) on delete set null,
  role_context text not null,
  status text not null,
  requested_at timestamptz not null default timezone('utc', now()),
  scheduled_for timestamptz not null,
  processed_at timestamptz null,
  cancelled_at timestamptz null,
  processing_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_deletion_requests_role_context_check check (
    role_context in ('worker', 'office')
  ),
  constraint account_deletion_requests_status_check check (
    status in ('pending', 'processing', 'completed', 'cancelled', 'failed')
  ),
  constraint account_deletion_requests_scheduled_after_requested_check check (
    scheduled_for >= requested_at
  )
);

comment on table public.account_deletion_requests is
  'Self-service account deletion requests. Access is revoked immediately; Auth deletion and Worker PII anonymisation run after scheduled_for via Edge Function.';

comment on column public.account_deletion_requests.auth_user_id is
  'Auth subject who requested deletion. Stored without FK so the audit row survives auth.users deletion.';

comment on column public.account_deletion_requests.role_context is
  'worker = Driver membership self-delete (v1). office reserved for a later Admin flow.';

comment on column public.account_deletion_requests.status is
  'pending → processing → completed | failed. cancelled reserved for support-assisted cancel before scheduled_for.';

comment on column public.account_deletion_requests.scheduled_for is
  'UTC timestamp when permanent anonymisation / Auth delete may run (requested_at + 30 days for Worker v1).';

-- One active in-flight request per auth user.
create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on public.account_deletion_requests (auth_user_id)
  where status in ('pending', 'processing');

create index if not exists account_deletion_requests_pending_scheduled_idx
  on public.account_deletion_requests (scheduled_for)
  where status = 'pending';

create index if not exists account_deletion_requests_company_id_idx
  on public.account_deletion_requests (company_id);

create index if not exists account_deletion_requests_auth_user_id_idx
  on public.account_deletion_requests (auth_user_id);

drop trigger if exists account_deletion_requests_set_updated_at
  on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
  before update on public.account_deletion_requests
  for each row
  execute function public.drevora_set_updated_at();

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from public;
revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from authenticated;

grant select on table public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_select_own
  on public.account_deletion_requests;
create policy account_deletion_requests_select_own
  on public.account_deletion_requests
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- service_role bypasses RLS for Edge Function writes.
grant all on table public.account_deletion_requests to service_role;
