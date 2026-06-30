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

**`supabase/schema.sql` is the single source of truth** for all database structure.

### Migration-first workflow

If a new feature requires **new tables or columns**, always generate the SQL migration **before** implementing React UI, services, or types. **Never assume tables already exist** in the user's Supabase project.

Required order:

1. `supabase/migrations/` — new timestamped migration file
2. `supabase/schema.sql` — keep in sync
3. `supabase/policies.sql` — when RLS or grants change
4. TypeScript service layer
5. React UI

Every database change must also update when applicable:

- `supabase/seed.sql` — when demo seed data changes
- `supabase/README.md` — when setup steps change

Rules:

- Do not create ad-hoc SQL Editor queries or ask the user to run “Untitled query” scripts.
- Do not duplicate schema definitions outside `supabase/schema.sql`.
- Prefer idempotent SQL (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Never drop tables or delete data in schema updates unless explicitly requested.

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