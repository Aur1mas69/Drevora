# DREVORA Supabase Database

```
supabase/
  schema.sql       Single source of truth (tables, indexes)
  migrations/      Incremental migration history
  policies.sql     Row Level Security configuration
  seed.sql         Optional demo/development data
```

## Single source of truth

**`schema.sql` is the canonical database definition.** All schema changes start here.

When making a database change, update in this order:

1. **`schema.sql`** — always (required)
2. **`migrations/`** — add a new migration file when the change must apply to existing databases
3. **`policies.sql`** — when RLS or policies change
4. **`seed.sql`** — when demo seed data changes
5. **`README.md`** — when setup or workflow changes

Do not create ad-hoc SQL Editor queries or one-off “Untitled query” scripts. Keep every structural change in the repo.

## Setup (new project)

Run these files **in order** in the Supabase **SQL Editor**:

| Step | File | Purpose |
| --- | --- | --- |
| 1 | `schema.sql` | Create or sync tables and indexes |
| 2 | `policies.sql` | Apply RLS settings (disabled for MVP) |
| 3 | `seed.sql` | *(Optional)* Insert demo company profile |

All scripts are safe to re-run. They use `IF NOT EXISTS` patterns and will not drop tables or delete existing data.

## Syncing an existing project

When `schema.sql` has been updated, run the full **`schema.sql`** in the SQL Editor to sync. If a migration file was also added, run that migration on databases that were created before the change.

Then run **`policies.sql`** so RLS is disabled and API roles can read/write tables during MVP.

### App shows 0 workers/vehicles but data exists

If Supabase queries return **0 rows with no error**, RLS or missing table grants is usually blocking the anon API role. Run **`policies.sql`** against the same project referenced in `.env.local` (`VITE_SUPABASE_URL`).

## Schema overview

| Table | Purpose |
| --- | --- |
| `drivers` | Workers (table name kept for app compatibility) |
| `vehicles` | Fleet vehicles, documents, and off-road fields |
| `vehicle_availability` | Date-based vehicle status records |
| `companies` | Company profile for dashboard header and settings |

See `schema.sql` for the full column list, indexes, and comments.

## Migrations folder

The `migrations/` folder contains incremental SQL files used during development. For new project setup, running `schema.sql` is sufficient. Migration files are kept for history and reference.

## Row Level Security

During MVP development, **RLS is disabled** on all DREVORA tables. This is configured in `policies.sql`.

Before production:

1. Enable RLS on each table
2. Add tenant-scoped policies (see commented examples in `policies.sql`)
3. Do not deploy with RLS disabled

## Seed data

`seed.sql` inserts a sample company (`Jagstrans Ltd`) only when the `companies` table is empty. Skip this file in production unless you want initial demo data.
