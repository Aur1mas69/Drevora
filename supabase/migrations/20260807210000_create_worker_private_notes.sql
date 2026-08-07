-- =============================================================================
-- DREVORA migration: 20260807210000_create_worker_private_notes
--
-- Purpose:
--   Private personal work notes for the signed-in Worker only
--   (gate codes, site instructions, depot info — not a password manager).
--
-- Privacy:
--   - SELECT/INSERT/UPDATE/DELETE only when
--     driver_id = public.drevora_auth_user_driver_id()
--     AND public.drevora_auth_user_belongs_to_company_id(company_id)
--   - No Office/Admin policies (normal app/RLS cannot read these notes)
--   - Browser-supplied driver_id / company_id cannot bypass RLS
--
-- Apply manually on the Supabase project after review. Do not auto-apply.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.companies') is null then
    raise exception 'DREVORA STOP 20260807210000: public.companies is missing';
  end if;

  if to_regclass('public.drivers') is null then
    raise exception 'DREVORA STOP 20260807210000: public.drivers is missing';
  end if;

  if to_regprocedure('public.drevora_auth_user_driver_id()') is null then
    raise exception
      'DREVORA STOP 20260807210000: public.drevora_auth_user_driver_id() is missing';
  end if;

  if to_regprocedure('public.drevora_auth_user_belongs_to_company_id(uuid)') is null then
    raise exception
      'DREVORA STOP 20260807210000: public.drevora_auth_user_belongs_to_company_id(uuid) is missing';
  end if;

  if to_regprocedure('public.drevora_driver_in_company(uuid, uuid)') is null then
    raise exception
      'DREVORA STOP 20260807210000: public.drevora_driver_in_company(uuid, uuid) is missing';
  end if;

  if to_regprocedure('public.drevora_set_updated_at()') is null then
    raise exception
      'DREVORA STOP 20260807210000: public.drevora_set_updated_at() is missing';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------
create table if not exists public.worker_private_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  title text not null,
  content text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_private_notes_title_len_check check (
    char_length(trim(title)) >= 1 and char_length(title) <= 120
  ),
  constraint worker_private_notes_content_len_check check (
    char_length(trim(content)) >= 1 and char_length(content) <= 4000
  )
);

create index if not exists worker_private_notes_driver_pinned_updated_idx
  on public.worker_private_notes (driver_id, is_pinned desc, updated_at desc);

create index if not exists worker_private_notes_company_driver_idx
  on public.worker_private_notes (company_id, driver_id);

comment on table public.worker_private_notes is
  'Private Worker personal work notes. Own-row RLS only via drevora_auth_user_driver_id(); no Office policies.';

drop trigger if exists worker_private_notes_set_updated_at on public.worker_private_notes;
create trigger worker_private_notes_set_updated_at
  before update on public.worker_private_notes
  for each row
  execute function public.drevora_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — Worker own-row only; no Office/Admin policies
-- -----------------------------------------------------------------------------
alter table public.worker_private_notes enable row level security;

revoke all on table public.worker_private_notes from anon;
revoke all on table public.worker_private_notes from authenticated;
revoke all on table public.worker_private_notes from public;

grant select, insert, update, delete on table public.worker_private_notes to authenticated;

drop policy if exists worker_private_notes_worker_select_own on public.worker_private_notes;
create policy worker_private_notes_worker_select_own
  on public.worker_private_notes
  for select
  to authenticated
  using (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
  );

drop policy if exists worker_private_notes_worker_insert_own on public.worker_private_notes;
create policy worker_private_notes_worker_insert_own
  on public.worker_private_notes
  for insert
  to authenticated
  with check (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
  );

drop policy if exists worker_private_notes_worker_update_own on public.worker_private_notes;
create policy worker_private_notes_worker_update_own
  on public.worker_private_notes
  for update
  to authenticated
  using (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
  )
  with check (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
  );

drop policy if exists worker_private_notes_worker_delete_own on public.worker_private_notes;
create policy worker_private_notes_worker_delete_own
  on public.worker_private_notes
  for delete
  to authenticated
  using (
    driver_id = public.drevora_auth_user_driver_id()
    and public.drevora_auth_user_belongs_to_company_id(company_id)
    and public.drevora_driver_in_company(driver_id, company_id)
  );

commit;

-- =============================================================================
-- Manual verification (do not execute as part of migration):
--
-- as Worker A: insert/select own notes — expect success
-- as Worker B: select Worker A notes — expect empty / denied
-- as Office role: select from worker_private_notes — expect empty (no office policy)
-- attempt insert with another driver's id — expect RLS rejection
-- =============================================================================
