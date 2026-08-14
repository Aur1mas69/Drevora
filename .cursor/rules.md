# DREVORA AI Rules

## Project

DREVORA is a professional SaaS platform for transport and logistics companies.

The goal is to build production-quality software, not prototypes.

---

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase

---

## General Rules

- Always use TypeScript.
- Never create .js or .jsx files.
- Always use .ts and .tsx.
- Never duplicate components.
- Build reusable components.
- Keep the code clean and production-ready.

---

## UI Rules

- Mobile first.
- Premium modern design.
- Dark theme by default.
- Use shadcn/ui whenever possible.
- Keep spacing consistent.
- Avoid unnecessary colors or effects.

---

## Architecture

The project must always follow SaaS architecture.

Every company is isolated.

Every entity belongs to a company.

Required field:

company_id

Roles:

- Super Admin
- Company Admin
- Office Staff
- Driver

Drivers only access their own data.

Company Admins only access their own company's data.

---

## Authentication

Authentication will use Supabase.

Company Admin invites drivers.

Drivers create their own password.

Never generate demo users.

Never hardcode authentication.

---

## Data

Never hardcode data that will later come from Supabase.

Use mock data only when explicitly requested.

---

## Database (Supabase)

**`supabase/migrations/` is the canonical database history.** It is the only path for production database, RLS, Storage, grant, and function changes.

Never apply these legacy files to production, and never suggest them as a fix:

- `supabase/policies.sql`
- `supabase/schema.sql` as a full executable setup script
- `supabase/scripts/apply_*.sql`

`supabase/diagnostics/` is read-only unless a file is explicitly proven to mutate. Do not confuse diagnostics with migrations.

### Migration-first workflow

If a new feature requires **new tables, columns, RLS, Storage, or functions**, create a SQL migration **before** implementing React UI, services, or types. **Never assume objects already exist** in the user's Supabase project. **Never assume `schema.sql` or `policies.sql` match live production.**

Required order:

1. Inspect live schema and existing `supabase/migrations/`
2. Add a new timestamped migration under `supabase/migrations/`
3. TypeScript service layer
4. React UI

Rules:

- Do not create ad-hoc SQL Editor queries or ask the user to run “Untitled query” scripts.
- Do not tell anyone to paste `policies.sql`, `schema.sql`, or `apply_*.sql` into the SQL Editor.
- Prefer idempotent SQL in **migrations** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Never drop tables or delete data unless explicitly requested.

---

## Components

Always prefer creating reusable components.

Never delete existing components without asking.

---

## Coding Style

Prefer simple code.

Avoid unnecessary complexity.

Always explain major architectural changes.

Never modify project structure without explanation.