-- Idempotent follow-up for projects that ran an earlier dashboard_notes draft
-- or need RLS/index/trigger sync without recreating the table.

create table if not exists public.dashboard_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid,
  note text not null,
  status text not null default 'open',
  priority text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_notes_status_check check (status in ('open', 'done')),
  constraint dashboard_notes_note_not_empty check (char_length(trim(note)) > 0)
);

alter table public.dashboard_notes
  alter column created_at set default now(),
  alter column updated_at set default now();

create index if not exists dashboard_notes_company_id_idx
  on public.dashboard_notes (company_id);

create index if not exists dashboard_notes_status_idx
  on public.dashboard_notes (status);

create index if not exists dashboard_notes_due_date_idx
  on public.dashboard_notes (due_date)
  where due_date is not null;

create index if not exists dashboard_notes_company_status_idx
  on public.dashboard_notes (company_id, status);

create index if not exists dashboard_notes_company_updated_idx
  on public.dashboard_notes (company_id, updated_at desc);

create or replace function public.drevora_current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.companies c
  order by c.created_at asc nulls last
  limit 1;
$$;

create or replace function public.drevora_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboard_notes_set_updated_at on public.dashboard_notes;

create trigger dashboard_notes_set_updated_at
  before update on public.dashboard_notes
  for each row
  execute function public.drevora_set_updated_at();

alter table public.dashboard_notes enable row level security;

grant select, insert, update, delete on public.dashboard_notes to anon, authenticated;

drop policy if exists dashboard_notes_company_select on public.dashboard_notes;
drop policy if exists dashboard_notes_company_insert on public.dashboard_notes;
drop policy if exists dashboard_notes_company_update on public.dashboard_notes;
drop policy if exists dashboard_notes_company_delete on public.dashboard_notes;

create policy dashboard_notes_company_select
  on public.dashboard_notes
  for select
  to anon, authenticated
  using (company_id = public.drevora_current_company_id());

create policy dashboard_notes_company_insert
  on public.dashboard_notes
  for insert
  to anon, authenticated
  with check (company_id = public.drevora_current_company_id());

create policy dashboard_notes_company_update
  on public.dashboard_notes
  for update
  to anon, authenticated
  using (company_id = public.drevora_current_company_id())
  with check (company_id = public.drevora_current_company_id());

create policy dashboard_notes_company_delete
  on public.dashboard_notes
  for delete
  to anon, authenticated
  using (company_id = public.drevora_current_company_id());
