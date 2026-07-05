do $$
declare
  constraint_row record;
  index_row record;
begin
  -- Drop only the legacy full unique constraint on (driver_id, week_start), if present.
  for constraint_row in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'timesheets'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike 'unique (driver_id, week_start)%'
  loop
    execute format('alter table public.timesheets drop constraint if exists %I', constraint_row.conname);
  end loop;

  -- Drop only legacy full unique indexes on (driver_id, week_start) without deleted_at predicate.
  for index_row in
    select i.indexname
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'timesheets'
      and i.indexdef ilike 'create unique index % on public.timesheets% (driver_id, week_start)%'
      and i.indexdef not ilike '%where (deleted_at is null)%'
  loop
    execute format('drop index if exists public.%I', index_row.indexname);
  end loop;
end $$;

create unique index if not exists timesheets_driver_week_unique_idx
on public.timesheets (driver_id, week_start)
where deleted_at is null;
