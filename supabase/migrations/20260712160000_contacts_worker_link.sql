-- Link contacts to workers (drivers) without cascading deletes.
-- Worker phone rows remain sourced from public.drivers; this FK is for optional directory links.

alter table public.contacts
  add column if not exists worker_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contacts_worker_id_fkey'
      and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint contacts_worker_id_fkey
      foreign key (worker_id)
      references public.drivers (id)
      on delete set null;
  end if;
end $$;

create index if not exists contacts_worker_id_idx on public.contacts (worker_id);

create unique index if not exists contacts_worker_id_unique_idx
  on public.contacts (worker_id)
  where worker_id is not null;

alter table public.contacts drop constraint if exists contacts_category_check;

alter table public.contacts
  add constraint contacts_category_check check (
    category in (
      'customer',
      'supplier',
      'garage_workshop',
      'site_plant',
      'insurance',
      'accountant',
      'emergency',
      'worker',
      'other'
    )
  );

alter table public.contacts disable row level security;

grant select, insert, update, delete on public.contacts to anon, authenticated;
