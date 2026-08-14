# DREVORA Supabase Database

```
supabase/
  migrations/      Canonical production database history (ONLY apply these)
  diagnostics/     Read-only operator checks (do not confuse with migrations)
  schema.sql       Legacy snapshot — do not apply to production
  policies.sql     Legacy MVP RLS dump — do not apply to production
  scripts/         Legacy one-off apply_*.sql — do not apply to production
  seed.sql         Optional local/demo data only
```

## Canonical database source

**`supabase/migrations/` is the only canonical source for production database changes.**

All table, RLS, grant, Storage, function, and trigger changes for live DREVORA must go through a reviewed migration in that folder. Do not paste SQL into the Supabase SQL Editor as a substitute for a migration.

## Legacy SQL — do not apply to production

These files are historical. They must **not** be run against production (or any live DREVORA project):

- `supabase/policies.sql`
- `supabase/schema.sql` used as a full executable production setup script
- `supabase/scripts/apply_*.sql` (including `apply_vehicle_check_storage_bucket.sql` and `apply_vehicle_check_template_rls.sql`)

They can remain in the repo for history. Do not treat “Safe to re-run” or “Paste into SQL Editor” comments inside them as current instructions.

## Production changes

1. Inspect the live schema and existing migrations.
2. Add a new timestamped file under `supabase/migrations/`.
3. Review and apply **only that migration** through the normal approved process.

Do not run `schema.sql` + `policies.sql` to “sync” an existing project. Do not use legacy SQL to fix empty query results, missing buckets, or RLS blocks.

## Diagnostics

`supabase/diagnostics/` may contain **read-only** diagnostic SQL for operators. It is not a migration set. Do not apply diagnostic files as schema or policy changes.

## Seed data

`seed.sql` inserts a sample company only when `companies` is empty. Do not run it on production.
