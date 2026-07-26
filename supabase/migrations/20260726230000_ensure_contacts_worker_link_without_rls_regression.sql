-- DREVORA — Ensure Contacts Worker-link without RLS regression
-- File: supabase/migrations/20260726230000_ensure_contacts_worker_link_without_rls_regression.sql
--
-- Purpose:
--   Live projects return PostgREST 42703:
--     column contacts.worker_id does not exist
--
--   Canonical column / FK / indexes / category allow-list already exist in:
--     supabase/migrations/20260712160000_contacts_worker_link.sql
--     supabase/schema.sql
--
-- Why this file exists instead of re-running 20260712160000:
--   The historical migration ends with DISABLE ROW LEVEL SECURITY and broad
--   GRANT to anon/authenticated. After 20260715210000 (Contacts RLS enabled),
--   applying that full file would weaken live tenant isolation.
--
-- This repair only ensures the Worker-link schema. It does NOT:
--   - disable/enable/force RLS
--   - grant/revoke privileges
--   - create/drop/alter policies
--   - invent or backfill Worker links
--   - rewrite Contact category data
--   - modify company_id, Auth helpers or tenant logic
--
-- Idempotent. Does NOT apply itself — run manually in the Supabase SQL editor
-- after review.

-- =============================================================================
-- 0) Pre-apply diagnostics (commented — run manually before apply)
-- =============================================================================
-- select c.relname,
--        c.relrowsecurity as rls_enabled,
--        c.relforcerowsecurity as rls_forced
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'contacts';
--
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'contacts'
--   and column_name = 'worker_id';
--
-- select count(*) as contact_count from public.contacts;

begin;

-- =============================================================================
-- 1) Preflight — Contacts RLS must already be enabled
-- =============================================================================
do $$
declare
  v_rls_enabled boolean;
begin
  select c.relrowsecurity
  into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'contacts';

  if v_rls_enabled is distinct from true then
    raise exception 'CONTACTS_RLS_REQUIRED'
      using errcode = 'P0001',
            hint = 'public.contacts must have row level security enabled before this repair. Apply the tenant RLS migrations first; do not run 20260712160000 (it disables RLS).';
  end if;
end $$;

-- =============================================================================
-- 2) worker_id column (nullable, no default)
-- =============================================================================
alter table public.contacts
  add column if not exists worker_id uuid;

comment on column public.contacts.worker_id is
  'Optional link to public.drivers (Worker). NULL when not linked. ON DELETE SET NULL. Does not cascade-delete Contacts.';

-- =============================================================================
-- 3) Canonical FK → drivers(id) ON DELETE SET NULL
-- =============================================================================
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

-- =============================================================================
-- 4) Canonical indexes
-- =============================================================================
create index if not exists contacts_worker_id_idx
  on public.contacts (worker_id);

create unique index if not exists contacts_worker_id_unique_idx
  on public.contacts (worker_id)
  where worker_id is not null;

-- =============================================================================
-- 5) Canonical category CHECK (includes worker)
--     Constraint name: contacts_category_check
--     Allow-list verified from schema.sql + 20260712160000 (no later changes).
-- =============================================================================
do $$
declare
  v_invalid_count integer;
begin
  select count(*)::integer
  into v_invalid_count
  from public.contacts
  where category is null
     or category not in (
      'customer',
      'supplier',
      'garage_workshop',
      'site_plant',
      'insurance',
      'accountant',
      'emergency',
      'worker',
      'other'
    );

  if v_invalid_count > 0 then
    raise exception 'CONTACTS_CATEGORY_PREFLIGHT_FAILED'
      using errcode = 'P0001',
            hint = format(
              '%s contact row(s) have category values outside the canonical allow-list. Resolve them before applying this migration; category data will not be rewritten.',
              v_invalid_count
            );
  end if;
end $$;

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

-- =============================================================================
-- 6) PostgREST schema cache
-- =============================================================================
notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- 7) Post-apply diagnostics (commented — after COMMIT only)
-- =============================================================================
-- -- 1) worker_id column type / nullability / default
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'contacts'
--   and column_name = 'worker_id';
-- -- Expected: uuid, YES (nullable), column_default null
--
-- -- 2) FK target and ON DELETE
-- select
--   c.conname,
--   pg_get_constraintdef(c.oid) as definition
-- from pg_constraint c
-- where c.conrelid = 'public.contacts'::regclass
--   and c.conname = 'contacts_worker_id_fkey';
-- -- Expected: FOREIGN KEY (worker_id) REFERENCES drivers(id) ON DELETE SET NULL
--
-- -- 3) Indexes
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'contacts'
--   and indexname in ('contacts_worker_id_idx', 'contacts_worker_id_unique_idx')
-- order by indexname;
--
-- -- 4) Category CHECK
-- select conname, pg_get_constraintdef(oid) as definition
-- from pg_constraint
-- where conrelid = 'public.contacts'::regclass
--   and conname = 'contacts_category_check';
-- -- Expected: includes worker among the nine canonical categories
--
-- -- 5) RLS enabled / forced
-- select c.relname,
--        c.relrowsecurity as rls_enabled,
--        c.relforcerowsecurity as rls_forced
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'contacts';
-- -- Expected: rls_enabled = true (forced may be false)
--
-- -- 6) Contacts RLS policies
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'contacts'
-- order by policyname;
--
-- -- 7) Effective table privileges
-- select
--   has_table_privilege('anon', 'public.contacts', 'SELECT') as anon_select,
--   has_table_privilege('anon', 'public.contacts', 'INSERT') as anon_insert,
--   has_table_privilege('anon', 'public.contacts', 'UPDATE') as anon_update,
--   has_table_privilege('anon', 'public.contacts', 'DELETE') as anon_delete,
--   has_table_privilege('authenticated', 'public.contacts', 'SELECT') as auth_select,
--   has_table_privilege('authenticated', 'public.contacts', 'INSERT') as auth_insert,
--   has_table_privilege('authenticated', 'public.contacts', 'UPDATE') as auth_update,
--   has_table_privilege('authenticated', 'public.contacts', 'DELETE') as auth_delete;
--
-- -- 8) Cross-company Worker links (expected zero when both have company_id)
-- select count(*) as cross_company_worker_links
-- from public.contacts c
-- join public.drivers d on d.id = c.worker_id
-- where c.worker_id is not null
--   and c.company_id is not null
--   and d.company_id is not null
--   and c.company_id is distinct from d.company_id;
--
-- -- 9) Contact row count (compare with pre-apply)
-- select count(*) as contact_count from public.contacts;
