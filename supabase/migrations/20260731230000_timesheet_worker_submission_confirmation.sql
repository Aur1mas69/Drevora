-- =============================================================================
-- Worker Timesheet submission confirmation (current state + audit history)
-- File: supabase/migrations/20260731230000_timesheet_worker_submission_confirmation.sql
-- =============================================================================
-- 1) Current confirmation columns on public.timesheets
-- 2) Append-only audit table public.timesheet_submission_confirmations
-- 3) Reject RPC clears current confirmation (history rows preserved)
-- 4) Entry immutability while parent is Submitted or Approved
-- Idempotent. Do not auto-apply; run on the Supabase project before testing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Current confirmation state on timesheets
-- -----------------------------------------------------------------------------
alter table public.timesheets
  add column if not exists worker_confirmed boolean not null default false;

alter table public.timesheets
  add column if not exists confirmed_by_driver_id uuid references public.drivers (id) on delete set null;

alter table public.timesheets
  add column if not exists confirmed_at timestamptz;

comment on column public.timesheets.worker_confirmed is
  'True when the Worker has confirmed the current submission. Cleared when Office returns/rejects for correction.';
comment on column public.timesheets.confirmed_by_driver_id is
  'drivers.id of the Worker who confirmed the current submission. Cleared on return/reject.';
comment on column public.timesheets.confirmed_at is
  'Timestamp of the current Worker confirmation. Cleared on return/reject; prior values live in timesheet_submission_confirmations.';

create index if not exists timesheets_confirmed_by_driver_id_idx
  on public.timesheets (confirmed_by_driver_id)
  where confirmed_by_driver_id is not null;

create index if not exists timesheets_confirmed_at_idx
  on public.timesheets (confirmed_at)
  where confirmed_at is not null;

-- -----------------------------------------------------------------------------
-- 2) Audit history (one row per confirmation / submission)
-- -----------------------------------------------------------------------------
create table if not exists public.timesheet_submission_confirmations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies (id) on delete cascade,
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  confirmed_by_driver_id uuid not null references public.drivers (id) on delete restrict,
  confirmed_at timestamptz not null,
  week_start date not null
);

comment on table public.timesheet_submission_confirmations is
  'Append-only audit of Worker Timesheet submission confirmations. Survives Office return/reject resets of timesheets.worker_confirmed.';

create index if not exists timesheet_submission_confirmations_timesheet_id_idx
  on public.timesheet_submission_confirmations (timesheet_id);

create index if not exists timesheet_submission_confirmations_company_id_idx
  on public.timesheet_submission_confirmations (company_id);

create index if not exists timesheet_submission_confirmations_confirmed_at_idx
  on public.timesheet_submission_confirmations (timesheet_id, confirmed_at desc);

alter table public.timesheet_submission_confirmations disable row level security;

grant select, insert on public.timesheet_submission_confirmations to anon, authenticated;
revoke update, delete on public.timesheet_submission_confirmations from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) Reject clears current confirmation (audit table unchanged)
-- -----------------------------------------------------------------------------
create or replace function public.drevora_reject_timesheets(
  p_company_id uuid,
  p_timesheet_ids uuid[]
)
returns table (
  id uuid,
  status text,
  rejected_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rejected_at timestamptz := transaction_timestamp();
  v_ids uuid[];
  v_requested integer;
  v_locked integer;
  v_invalid integer;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'TIMESHEET_REJECT_UNAUTHORIZED'
      using errcode = '42501',
            hint = 'Authentication required.';
  end if;

  if p_company_id is null then
    raise exception 'TIMESHEET_REJECT_INVALID'
      using errcode = '22023',
            hint = 'company_id is required.';
  end if;

  if not public.drevora_auth_user_has_office_role_for_company(p_company_id) then
    raise exception 'TIMESHEET_REJECT_FORBIDDEN'
      using errcode = '42501',
            hint = 'Office access for this company is required.';
  end if;

  if p_timesheet_ids is null or coalesce(cardinality(p_timesheet_ids), 0) = 0 then
    raise exception 'TIMESHEET_REJECT_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  if exists (
    select 1
    from unnest(p_timesheet_ids) as x(id)
    where x.id is null
  ) then
    raise exception 'TIMESHEET_REJECT_INVALID'
      using errcode = '22023',
            hint = 'Timesheet ids must not contain null.';
  end if;

  select array_agg(distinct x.id order by x.id)
  into v_ids
  from unnest(p_timesheet_ids) as x(id);

  v_requested := coalesce(cardinality(v_ids), 0);
  if v_requested = 0 then
    raise exception 'TIMESHEET_REJECT_EMPTY'
      using errcode = '22023',
            hint = 'At least one Timesheet id is required.';
  end if;

  perform 1
  from (
    select t.id
    from public.timesheets t
    where t.company_id = p_company_id
      and t.id = any (v_ids)
    order by t.id
    for update
  ) as locked;

  select count(*)::integer
  into v_locked
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids);

  if v_locked is distinct from v_requested then
    raise exception 'TIMESHEET_REJECT_NOT_FOUND'
      using errcode = 'P0002',
            hint = 'One or more Timesheets were not found for this company.';
  end if;

  select count(*)::integer
  into v_invalid
  from public.timesheets t
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and (
      t.deleted_at is not null
      or t.cleaned_at is not null
      or t.status is distinct from 'Submitted'
    );

  if v_invalid > 0 then
    raise exception 'TIMESHEET_REJECT_INVALID_STATE'
      using errcode = 'P0001',
            hint = 'Every selected Timesheet must be Current, not deleted, and Submitted.';
  end if;

  return query
  update public.timesheets t
  set
    status = 'Rejected',
    rejected_at = v_rejected_at,
    updated_at = v_rejected_at,
    worker_confirmed = false,
    confirmed_by_driver_id = null,
    confirmed_at = null
  where t.company_id = p_company_id
    and t.id = any (v_ids)
    and t.deleted_at is null
    and t.cleaned_at is null
    and t.status = 'Submitted'
  returning t.id, t.status, t.rejected_at, t.updated_at;

  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_requested then
    raise exception 'TIMESHEET_REJECT_PARTIAL'
      using errcode = 'P0001',
            hint = 'Reject aborted: not every requested Timesheet could be rejected.';
  end if;
end;
$$;

comment on function public.drevora_reject_timesheets(uuid, uuid[]) is
  'Office-only atomic Reject: sets status=Rejected, rejected_at, updated_at; clears current Worker confirmation fields. Audit rows in timesheet_submission_confirmations are preserved. Does not touch entries, week_start, submitted_at, cleaned_at, deleted_at, retention or approved_at.';

revoke all on function public.drevora_reject_timesheets(uuid, uuid[]) from public;
revoke all on function public.drevora_reject_timesheets(uuid, uuid[]) from anon;
grant execute on function public.drevora_reject_timesheets(uuid, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Immutable entries while Submitted or Approved
-- -----------------------------------------------------------------------------
create or replace function public.drevora_enforce_timesheet_entries_immutable_when_locked()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_timesheet_id uuid;
begin
  v_timesheet_id := coalesce(new.timesheet_id, old.timesheet_id);

  select t.status
  into v_status
  from public.timesheets t
  where t.id = v_timesheet_id
  for share;

  if v_status in ('Submitted', 'Approved') then
    raise exception 'TIMESHEET_ENTRIES_LOCKED'
      using errcode = 'P0001',
            hint = 'Submitted and Approved Timesheets are read-only. Return/reject the Timesheet before editing days.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists timesheet_entries_immutable_when_locked
  on public.timesheet_entries;

create trigger timesheet_entries_immutable_when_locked
  before insert or update or delete
  on public.timesheet_entries
  for each row
  execute function public.drevora_enforce_timesheet_entries_immutable_when_locked();

comment on function public.drevora_enforce_timesheet_entries_immutable_when_locked() is
  'Blocks insert/update/delete of timesheet_entries while the parent Timesheet status is Submitted or Approved.';

revoke all on function public.drevora_enforce_timesheet_entries_immutable_when_locked() from public;
grant execute on function public.drevora_enforce_timesheet_entries_immutable_when_locked() to authenticated;

commit;
