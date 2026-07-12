# Demo data for screenshots

Temporary fictional UK transport dataset seeded into your **current single company**.

## Behaviour

- Does **not** create a separate “DREVORA Demo Transport Ltd” company.
- Does **not** rename your company or change your admin account.
- Queries `public.companies` first:
  - **1 company** → uses that company (exact `id` + `name`)
  - **0 companies** → stops with an error
  - **2+ companies** → requires explicit `DEMO_TARGET_COMPANY_ID` (never silent pick)
- Stores every inserted row ID in `scripts/.demo-data-manifest.json`
- `npm run remove:demo` deletes **only** those IDs

## Counts

| Entity | Count |
| --- | --- |
| Workers (`drivers`) | 30 |
| Vehicles | 35 (30 HGV + 5 forklifts) |
| Timesheets | 100 (+ daily entries) |
| Holiday requests | 20 |
| Driver reports | 20 |
| Vehicle checks | ~40 completed |

Workers and driver reports use `company = <exact current company name>`.

## Prerequisites

In `.env.local` (never commit):

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

`VITE_SUPABASE_URL` is accepted as a URL fallback.  
**Never** put the service-role key in any `VITE_*` variable.

If you have more than one company:

```bash
DEMO_TARGET_COMPANY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Commands

Validate without inserting:

```bash
npm run seed:demo -- --dry-run
```

Seed (or resume missing sections from the manifest):

```bash
npm run seed:demo
```

If a previous run created data but crashed before writing the manifest:

```bash
npm run seed:demo -- --rebuild-manifest
npm run seed:demo
```

`--rebuild-manifest` recovers IDs from DEMO markers only (`DEMO-` fleet numbers, `@demo.drevora.local` emails, `[DEMO]` notes/descriptions). It does not invent IDs.

Remove only seeded rows:

```bash
npm run remove:demo
```

## Resume behaviour

- The manifest is written after every successful section (and after each vehicle check).
- Re-running `npm run seed:demo` skips sections already listed in the manifest.
- Vehicle check item inserts use only live columns: `category`, `item_name`, `result`, `comment`, `photo_url` (no `allow_notes`).

## Admin visibility

Because this project loads the single existing company for Settings/hero, and list screens already show that tenant’s operational data, seeded rows appear for the currently logged-in admin. No separate demo login or company linking is required.
