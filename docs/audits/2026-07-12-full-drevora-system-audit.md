# DREVORA Full System Audit
Date: 2026-07-12
Mode: Read-only audit
Code changes: None
SQL migrations applied: None
Git commits: None

> Method note: This audit combined direct file inspection, safe CLI commands (`npm run lint`, `npx tsc --noEmit`, `npm run build`), a repo-wide secret scan, and five parallel read-only exploration passes over every module. Findings marked **Verified** were read directly from repository files (file:line quoted). Findings marked **Inferred** are code-evident risks whose live impact was not executed against Supabase. Findings marked **Not testable** require live Supabase/browser access that was out of scope. No live database queries, no browser tests, and no commits were performed.

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Critical findings | 4 |
| High findings | 11 |
| Medium findings | 12 |
| Low findings | 8 |
| Build (`npm run build` = `tsc -b && vite build`) | **PASS** (exit 0) |
| Typecheck (`npx tsc --noEmit`) | **PASS** (exit 0) |
| Lint (`npm run lint` = `eslint .`) | **FAIL** (exit 1 — 132 errors, 9 warnings) |
| Tests | **NOT AVAILABLE** (no test script / no test runner) |

### Readiness ratings

| Dimension | Rating | Rationale |
|-----------|--------|-----------|
| Security readiness | **NOT READY** | RLS disabled on 15 business tables + full `anon`/`authenticated` CRUD grants; tenant scope = oldest-company text; portal role is client-side `sessionStorage`; direct Supabase API bypasses all UI guards. |
| First-customer readiness | **NOT READY** | Single-tenant assumption is baked into schema, helpers and services. Onboarding a second company would mix or hide data. |
| Production readiness | **READY WITH CONDITIONS** | The app builds, typechecks, and is functionally rich for a single trusted tenant. It is **not** safe for multi-tenant production or untrusted users until Phase 0–3 below are complete. |

---

## Top 10 Risks

1. **SEC-001 — No tenant isolation at the data layer.** RLS disabled on 15 tables + `anon` CRUD grants; any anon key holder can read/write all tenants' data.
2. **SEC-002 — Authorization is client-side only.** Admin vs worker is a `sessionStorage` value chosen by which login page is used; the same Supabase user can act as admin. No server/DB enforcement.
3. **SEC-003 — “Current company” is the oldest `companies` row** (`order created_at asc limit 1`) shared globally, not tied to `auth.uid()`. Effectively one tenant.
4. **DATA-001 — Many services return all tenants' rows** (`fetchDrivers`, `fetchVehicles`, timesheets, holidays, consumables, vehicle checks, compliance) with no company filter.
5. **SEC-004 — Cross-tenant record access by ID/email.** `fetchDriverById`, `fetchDriverByEmail`, compliance services have no company check.
6. **VC-001 — Vehicle check can be marked Completed without safety data on the edit/update path** (no odometer/signature re-validation in `updateVehicleCheck`).
7. **PWA-001 — Offline is effectively disabled in production.** `main.tsx` unregisters all service workers in prod and `injectRegister: false`; offline Vehicle Checks are absent.
8. **DB-001 — Missing migration `20260712210000_add_driver_reports_cleaned_at.sql`.** App depends on `cleaned_at`; column is not created by any tracked migration and `schema.sql` lacks it.
9. **DATA-002 — Dashboard KPI counts are unscoped and ignore `cleaned_at`**, so cleaned/other-tenant driver reports inflate active counts.
10. **VC-002 — Vehicle check update can orphan child items on photo-upload failure** (delete-all-then-insert with no rollback).

---

## Findings

### [SEC-001] RLS disabled on 15 business tables with full anon/authenticated grants
Severity: **Critical**
Category: Multi-tenant security / Database
Affected module: All data modules
Affected files: `supabase/policies.sql`, `supabase/schema.sql`
Exact lines: `policies.sql:15-31` (disable RLS), `policies.sql:40-63` (grants)
Evidence:
```15:31:supabase/policies.sql
alter table public.drivers disable row level security;
alter table public.vehicles disable row level security;
...
alter table public.driver_reports disable row level security;
```
```42:44:supabase/policies.sql
grant select, insert, update, delete on public.drivers to anon, authenticated;
grant select, insert, update, delete on public.vehicles to anon, authenticated;
```
Real impact: Any holder of the public anon key (shipped in the browser bundle) can read and modify every tenant's workers, vehicles, timesheets, holidays, checks, documents and reports directly via the Supabase REST/JS API, bypassing the app entirely.
Reproduction steps: With the deployed anon key, call `supabase.from('drivers').select('*')` from any browser console — returns all rows.
Recommended fix: Complete Phase 1 (membership) → Phase 2 (`company_id`) → Phase 3 (RLS `USING`/`WITH CHECK` bound to `auth.uid()` membership). Do **not** enable RLS before the app writes `company_id` and a membership table exists (see Phase plan).
Migration required: Yes (Phase 1–3).
Risk of regression: High if RLS is enabled before app code is converted — would blank out all data.
Verified / Inferred / Not testable: **Verified** (repo). Live exploitability **Inferred**.

---

### [SEC-002] Admin/worker authorization is client-side sessionStorage only
Severity: **Critical**
Category: Authentication / Authorisation
Affected module: Authentication, all admin pages
Affected files: `src/lib/authPortal.ts`, `src/contexts/AuthContext.tsx`, `src/router/AppRouter.tsx`, `src/services/authService.ts`, login pages
Exact lines: `authPortal.ts:3-13`, `AuthContext.tsx:29-42,60-64`, `AppRouter.tsx:75-96`, `authService.ts:40-43`, `DriverLoginPage.tsx:21-22`, `LoginTwilightPreviewPage.tsx:57-58`
Evidence:
```3:12:src/lib/authPortal.ts
const AUTH_PORTAL_STORAGE_KEY = 'drevora.auth.portal'
export function readStoredAuthPortal(): AuthPortal | null {
  const value = sessionStorage.getItem(AUTH_PORTAL_STORAGE_KEY)
```
```75:96:src/router/AppRouter.tsx
function RequireAuthPage({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading, portal } = useAuth()
  ...
  if (portal === 'worker') { return <Navigate to="/dashboard" replace /> }
```
`authService.signIn` only calls `signInWithPassword` — no role gate. The portal is chosen by the login page the user visits and stored in `sessionStorage`; it is never verified against a DB role.
Real impact: A worker who authenticates can set `sessionStorage['drevora.auth.portal'] = 'admin'` (or log in via the admin page) and reach every admin route. Because there is no RLS (SEC-001), the data is fully exposed regardless of UI guards.
Reproduction steps: Log in as any user; in DevTools set the portal key to `admin`; navigate to `/admin`.
Recommended fix: Derive portal/role from an authoritative DB source (`company_members.role` after Phase 1) and enforce via RLS. Treat UI guards as UX only.
Migration required: Yes (membership + role).
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [SEC-003] "Current company" resolves to the oldest companies row, not the authenticated user
Severity: **Critical**
Category: Multi-tenant security
Affected module: Settings, Dashboard, all scoped services
Affected files: `src/services/companySettingsService.ts`, `src/lib/companySettingsGlobals.ts`, `src/contexts/CompanySettingsContext.tsx`, `supabase/policies.sql`, `supabase/schema.sql`
Exact lines: `companySettingsService.ts:689-696`, `companySettingsGlobals.ts:5-21`, `CompanySettingsContext.tsx:65-79`, `policies.sql:65-76` and `167-171`
Evidence:
```689:695:src/services/companySettingsService.ts
async function queryCompanyRow(select: string) {
  return requireSupabase().from('companies').select(select)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
}
```
```65:75:supabase/policies.sql
create or replace function public.drevora_current_company_id()
...
  select c.id from public.companies c
  order by c.created_at asc nulls last limit 1;
```
Real impact: The entire app (settings, dashboard scope, RLS helpers) treats the oldest company as "the" tenant. A second company can never be the active tenant; its users would see tenant #1's settings and, where filters apply, tenant #1's data.
Reproduction steps: Insert a second `companies` row; all sessions still load the oldest company's settings.
Recommended fix: Resolve company from `auth.uid()` → `company_members` (Phase 1/2). Remove `limit(1)`/oldest-company logic from both app and SQL helpers.
Migration required: Yes.
Risk of regression: High (touches every scoped read).
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DB-001] Missing migration for driver_reports.cleaned_at
Severity: **High**
Category: Database / migrations
Affected module: Driver Reports
Affected files: `supabase/migrations/` (absent file), `supabase/schema.sql`, `src/services/driverReportsService.ts`, `supabase/diagnostics/20260712_rls_phase1_preflight.sql`
Exact lines: `driverReportsService.ts:30,50,104,346,372-378`; preflight `:1206-1226`; `schema.sql:862-903` (no `cleaned_at`)
Evidence: No file named `20260712210000_add_driver_reports_cleaned_at.sql` exists in `supabase/migrations/` (76 files listed; not present). App reads/writes `cleaned_at`:
```343:351:src/services/driverReportsService.ts
  .from('driver_reports')
  .update({ cleaned_at: cleanedAt, updated_at: cleanedAt })
  .in('id', reportIds)
  .in('status', ['New', 'In Progress'])
  .is('cleaned_at', null)
```
Real impact: The live column reportedly exists (applied manually), but the repo cannot reproducibly recreate the schema. A fresh environment (or `schema.sql`-based rebuild) will lack `cleaned_at`, and the clean feature will error with the "cleanup is not available yet" branch.
Reproduction steps: Rebuild DB from `schema.sql` → `cleaned_at` absent → clean fails.
Recommended fix: Add an idempotent migration `alter table public.driver_reports add column if not exists cleaned_at timestamptz;` plus index, and sync `schema.sql`. (Out of scope for this audit — no migration created.)
Migration required: Yes.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-001] Core list services return all tenants' rows (no company filter)
Severity: **High**
Category: Multi-tenant / data integrity
Affected module: Workers, Vehicles, Timesheets, Holidays, Consumables, Vehicle Checks
Affected files: `driversService.ts`, `vehiclesService.ts`, `timesheetsService.ts`, `holidayRequestsService.ts`, `consumablesService.ts`, `vehicleChecksService.ts`
Exact lines: `driversService.ts:907-917`, `vehiclesService.ts:431-436`, `consumablesService.ts:200-203`, `holidayRequestsService.ts:504-506`, `timesheetsService.ts:572-576`, `vehicleChecksService.ts:407-409`
Evidence:
```907:917:src/services/driversService.ts
async function queryDrivers(select: string): Promise<Driver[]> {
  const { data, error } = await requireSupabase().from('drivers').select(select)
    .order('created_at', { ascending: false })
```
Real impact: These queries rely on there being exactly one tenant. Company filtering, where present, is done client-side in the page after fetching all rows — meaning cross-tenant data is transmitted to the browser and could surface via search, pagination or dashboard aggregation.
Reproduction steps: With two companies present, open Workers/Vehicles — all companies' rows are fetched.
Recommended fix: Scope every list query by `company_id` (Phase 2) and enforce with RLS (Phase 3).
Migration required: Yes (for durable fix).
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo). Cross-tenant leakage **Inferred** (needs 2nd tenant).

---

### [SEC-004] Cross-tenant record access by ID/email
Severity: **High**
Category: Multi-tenant security
Affected module: Workers, Compliance
Affected files: `driversService.ts`, `workerComplianceService.ts`, `vehicleComplianceService.ts`, `src/hooks/useCurrentWorker.ts`
Exact lines: `driversService.ts:1081-1105,1120-1138`, `workerComplianceService.ts:97-102`, `vehicleComplianceService.ts:89-93`, `useCurrentWorker.ts:24-33`
Evidence:
```1120:1137:src/services/driversService.ts
export async function fetchDriverByEmail(email: string): Promise<Driver | null> {
  ...
  .from('drivers').select(select).ilike('email', normalizedEmail).maybeSingle()
```
Real impact: Any authenticated client that knows (or guesses) a worker UUID or email can load that worker; compliance records are globally readable/writable. Worker→identity binding is email-only with no company check.
Recommended fix: Add `company_id` scoping + RLS; bind worker resolution to membership.
Migration required: Yes.
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [VC-001] Vehicle check can be completed without odometer/signature on the edit path
Severity: **High**
Category: Safety-critical correctness
Affected module: Vehicle Checks
Affected files: `src/services/vehicleChecksService.ts`, `src/components/vehicle-checks/EditVehicleCheckModal.tsx`
Exact lines: `vehicleChecksService.ts:639-672` (no validation), `EditVehicleCheckModal.tsx:225-252`; contrast create path `vehicleChecksService.ts:513-524`
Evidence: Create path validates items, odometer and signature:
```513:524:src/services/vehicleChecksService.ts
  if (input.items.length === 0) { throw ...'checklist cannot be empty.' }
  if (input.odometer == null || Number.isNaN(input.odometer) || input.odometer < 0) { throw ...'Odometer / mileage is required.' }
  if (!input.signatureFile) { throw ...'Worker signature is required.' }
```
`updateVehicleCheck` applies a patch with no such checks:
```639:672:src/services/vehicleChecksService.ts
export async function updateVehicleCheck(id, input) {
  ...
  if (input.odometer !== undefined) patch.odometer = input.odometer
  if (input.status !== undefined) patch.status = input.status
```
Real impact: An admin edit can set status to Completed with `odometer: null` and no signature re-validation. Defect notes/photos are never required on either path. For a DVSA safety record this is a compliance gap.
Recommended fix: Apply the same completion invariants in `updateVehicleCheck`; require defect notes/photo where template flags demand.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [VC-002] Vehicle check update can orphan child items on photo-upload failure
Severity: **High**
Category: Data integrity
Affected module: Vehicle Checks
Affected files: `src/services/vehicleChecksService.ts`
Exact lines: `690-711`
Evidence:
```690:711:src/services/vehicleChecksService.ts
  const { error: deleteError } = await requireSupabase()
    .from(VEHICLE_CHECK_ITEMS_TABLE).delete().eq('vehicle_check_id', id)
  ...
  } catch (photoError) { throw new VehicleChecksServiceError(...) }
```
Real impact: Update deletes all child items first, then re-inserts and uploads photos. A failure mid-way (e.g. photo upload) can leave a `vehicle_checks` row with zero `vehicle_check_items` — a corrupted safety record. The create path rolls back (`593-628`); the update path does not.
Recommended fix: Wrap update in a transaction/RPC or insert-then-swap; roll back on failure.
Migration required: No (unless moving to an RPC).
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [PWA-001] Offline effectively disabled in production; offline Vehicle Checks absent
Severity: **High**
Category: PWA / offline
Affected module: PWA, Vehicle Checks
Affected files: `src/main.tsx`, `vite.config.ts`
Exact lines: `main.tsx:9-16,30-33`, `vite.config.ts:15-17,48-60`
Evidence:
```9:16:src/main.tsx
async function clearStaleServiceWorkers() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
```
`vite-plugin-pwa` uses `injectRegister: false` and there is no SW registration anywhere in `src/`. Production actively unregisters SWs.
Real impact: The generated `sw.js` never controls the app in production → no precache, no offline fallback, no install/update prompt. Offline capture + sync for Vehicle Checks is not implemented at all (no IndexedDB/queue). Field workers cannot complete checks without connectivity.
Recommended fix: Decide PWA strategy deliberately: either remove PWA plugin (if offline is not a goal) or register the SW and implement an offline queue for Vehicle Checks. Also clear caches on logout.
Migration required: No.
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo). Runtime behaviour **Inferred**.

---

### [DATA-002] Dashboard KPI counts are unscoped and ignore cleaned_at
Severity: **High**
Category: Correctness / data integrity
Affected module: Dashboard
Affected files: `src/services/dashboardService.ts`, `src/components/dashboard/DriverReportsOverviewCard.tsx`
Exact lines: `dashboardService.ts:407-416,1273-1302,1311`, overview card `15-16`
Evidence:
```1273:1277:src/services/dashboardService.ts
    let request = requireSupabase().from('driver_reports').select('status, company, worker_id')
    if (scope.companyName) { request = request.eq('company', scope.companyName) }
```
No `.is('cleaned_at', null)` filter; `countTableRows` (drivers/vehicles) and holiday counts (`:1311`) have no company filter at all.
Real impact: Cleaned driver reports still count as open on the dashboard even though the Driver Reports page hides them; worker/vehicle/holiday KPIs count all tenants. The "New Reports" KPI actually shows new+in-progress combined (`open = newCount + inProgressCount`, `:1299-1302`).
Recommended fix: Add `cleaned_at IS NULL` to dashboard driver-report counts; scope all KPI counts by company; relabel "New Reports".
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [SEC-005] Storage buckets scoped by bucket only; worker-avatars public; two buckets lack policies
Severity: **High**
Category: Storage security
Affected module: Documents, Vehicle Checks, Workers, Consumables
Affected files: `supabase/migrations/20260705310000_worker_avatars_storage_bucket.sql`, `20260706220000_create_documents_table.sql`, `20260706230000_create_driver_reports_table.sql`, `20260709220000_vehicle_check_photos_storage_bucket.sql`, `20260705210000_consumable_receipts_storage_bucket.sql`
Exact lines: avatars `:3-15,17-43`; vehicle-check-photos `:17-22`; document-files bucket `20260706220000:58-69` (no policies)
Evidence:
```17:22:supabase/migrations/20260709220000_vehicle_check_photos_storage_bucket.sql
create policy "vehicle check photos select"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'vehicle-check-photos');
```
Real impact: `worker-avatars` is a public bucket. All storage policies key on `bucket_id` only (no `{company_id}/...` path check) and grant `anon`, so any anon user can read/write any tenant's defect photos, receipts, and (once uploaded) documents. `document-files` and `driver-report-files` buckets have no `storage.objects` policies in the repo (rely on Supabase defaults). Medical documents live in `document-files`.
Recommended fix: Make policies path-tenant-scoped after Phase 2; keep private buckets private; add explicit policies for `document-files`/`driver-report-files`.
Migration required: Yes.
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo). Live bucket ACLs **Not testable** without Supabase access.

---

### [DATA-003] Timesheet list break totals count default breaks on empty days
Severity: **Medium**
Category: Correctness
Affected module: Timesheets
Affected files: `src/lib/timesheetUtils.ts`, `src/services/timesheetsService.ts`
Exact lines: `timesheetUtils.ts:162-164`; `timesheetsService.ts:466-478,734-738`
Evidence: Detail view only counts breaks for days with start+finish (`timesheetUtils.ts:162-164`), but list aggregation sums all DB `break_minutes` (`timesheetsService.ts:466-478`), and empty timesheets seed 30-min breaks on all 7 days.
Real impact: A new draft with no times can show ~3.5h of break in the list but 0 in the drawer — list/detail KPI mismatch.
Recommended fix: Only aggregate break minutes for days with start+finish in the list path.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-004] Timesheet list totals ignore per-day weekend multipliers
Severity: **Medium**
Category: Correctness (payroll-adjacent)
Affected module: Timesheets
Affected files: `src/lib/timesheetUtils.ts`
Exact lines: `251-259` (list path uses global multiplier) vs `110-190` (detail path uses `resolveDayOvertimeRules`)
Evidence:
```251:259:src/lib/timesheetUtils.ts
totalHours: roundHoursOneDecimal(
  calculateEntryPaidEquivalentHours({ totalMinutes, overtimeMinutes, additionalHours },
    getGlobalOvertimeMultiplier()))   // not per-day Sat/Sun rules
```
Real impact: When Saturday/Sunday multipliers differ from the weekday multiplier, the list `totalHours` disagrees with the drawer/PDF total.
Recommended fix: Apply per-day rules in the list aggregation path.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-005] Holiday "today"/month bounds use UTC date (timezone shift)
Severity: **Medium**
Category: Correctness / timezone
Affected module: Holiday Requests, Dashboard
Affected files: `src/lib/holidayRequestUtils.ts`
Exact lines: `204-214`
Evidence:
```204:214:src/lib/holidayRequestUtils.ts
export function todayIsoDate(): string { return new Date().toISOString().slice(0, 10) }
export function getMonthBounds(date = new Date()) { ... start.toISOString().slice(0, 10) ... }
```
Real impact: In UK summer (UTC+1), just after midnight `todayIsoDate()` returns yesterday, shifting "workers off today", "upcoming leave" and month-boundary stats. Other helpers (`toLocalIsoDate`) use local components correctly — inconsistent.
Recommended fix: Use local-date formatting consistently.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-006] No overlap/allowance enforcement on holiday requests
Severity: **Medium**
Category: Correctness / business rules
Affected module: Holiday Requests
Affected files: `src/services/holidayRequestsService.ts`, `src/components/holidays/NewHolidayRequestModal.tsx`
Exact lines: `holidayRequestsService.ts:453-466,606-643`; modal `384-390`
Evidence: `assertHolidayBalanceAllowsRequest` only rejects zero/negative ranges; over-allowance is a non-blocking warning; there is no duplicate/overlap check for the same worker (only a per-day capacity check). Pro-rata by start date and automatic bank-holiday exclusion are not implemented.
Real impact: A worker can submit overlapping requests and exceed entitlement; bank holidays count as working days unless a custom working week is configured. May be by design, but should be confirmed against business rules.
Recommended fix: Add overlap detection and optional hard allowance enforcement; document bank-holiday handling.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-007] Consumables monthly totalLitres ignores millilitre entries
Severity: **Medium**
Category: Correctness
Affected module: Consumables
Affected files: `src/lib/consumableUtils.ts`
Exact lines: `917-921`
Evidence:
```917:921:src/lib/consumableUtils.ts
totalLitres: records.filter((row) => row.unit === 'L')
  .reduce((sum, row) => sum + row.quantity, 0),
```
Real impact: `dieselLitres`/`adBlueLitres` use `quantityToLitres` (converts ml→L) but `totalLitres` filters only `unit === 'L'`; a 500 ml diesel entry contributes 0 to `totalLitres` but 0.5 to `dieselLitres`. Summary inconsistency.
Recommended fix: Use `quantityToLitres` in `totalLitres`.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-008] Documents orphan-merge and stale file paths
Severity: **Medium**
Category: Data integrity / security
Affected module: Documents
Affected files: `src/services/documentsService.ts`, `src/pages/DocumentsPage.tsx`, `src/lib/documentUtils.ts`
Exact lines: `documentsService.ts:471-475`; `DocumentsPage.tsx:236-274`; `documentUtils.ts:281-290`
Evidence: A worker-scoped secondary query pulls rows by `worker_id IN companyDriverIds` **without** a company filter on the row (`:471-475`); a document with a wrong/null `company` but valid `worker_id` can surface. "View" opens a signed URL that errors (404 toast) when `filePath` is stale.
Real impact: Potential cross-tenant document surfacing via orphan merge; broken View links on stale/replaced files.
Recommended fix: Filter orphan-merge by company; validate storage path existence before View or handle gracefully.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [VC-003] Duplicate vehicle-check submission possible; defect notes/photos optional
Severity: **Medium**
Category: Correctness / safety
Affected module: Vehicle Checks
Affected files: `src/components/vehicle-checks/NewVehicleCheckModal.tsx`, `src/services/vehicleChecksService.ts`, `src/components/vehicle-checks/VehicleCheckChecklistForm.tsx`
Exact lines: `NewVehicleCheckModal.tsx:158-163`; `VehicleCheckChecklistForm.tsx:266-269`
Evidence: Submit is guarded by an `isSaving` flag only; there is no idempotency token or DB uniqueness on `(vehicle_id, worker_id, inspection_date)`. Defect notes/photos are shown but never required.
Real impact: A double-submit after a slow network can create duplicate checks; a defect can be recorded with no note or photo.
Recommended fix: Add idempotency/unique constraint; require defect evidence per template flags.
Migration required: Optional (unique index).
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [VC-004] Vehicle delete cascades historical checks with no guard
Severity: **Medium**
Category: Data integrity
Affected module: Vehicles
Affected files: `src/services/vehiclesService.ts`, `supabase/schema.sql`
Exact lines: `vehiclesService.ts:637-643`; `schema.sql` FK cascades
Evidence: `deleteVehicle` is a hard delete; `vehicle_checks`, `vehicle_availability`, `vehicle_compliance_records` and vehicle-linked `documents` cascade-delete. No reference count or UI warning.
Real impact: Deleting a vehicle destroys its historical safety checks and compliance records irreversibly.
Recommended fix: Soft-delete or block delete when historical safety records exist; warn with counts.
Migration required: Possibly (soft delete column).
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DATA-009] Worker delete/edit lacks duplicate-email guard and is a hard delete
Severity: **Medium**
Category: Data integrity
Affected module: Workers
Affected files: `src/services/driversService.ts`, `src/pages/DriversPage.tsx`
Exact lines: `driversService.ts:333-343,1237`; `DriversPage.tsx:200-205`
Evidence: Empty emails get an internal placeholder; there is no pre-insert duplicate-email check (only worker_code unique retries); `deleteDriver` is a hard delete with no affected-row verification.
Real impact: Duplicate real emails depend solely on a DB unique index (surface as a generic error); deletion is destructive and unverified.
Recommended fix: Explicit duplicate-email check; soft-delete/archive; verify affected rows.
Migration required: Optional.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DB-002] schema.sql drift vs migrations
Severity: **Medium**
Category: Database / migrations
Affected module: DB
Affected files: `supabase/schema.sql`, various migrations
Exact lines: `schema.sql:862-903` (no `cleaned_at`), `:658,668,699` (`vehicle_check_templates` text only), missing Phase 1 `company_id`/`company_members`
Evidence: `schema.sql` lacks `driver_reports.cleaned_at`, `vehicle_check_templates.company_id` (added in `20260629190000`/`20260709121500`), and the Phase 1 `company_id`/`company_members` objects.
Real impact: `schema.sql` cannot be used to faithfully rebuild the live DB. Environments diverge.
Recommended fix: Regenerate `schema.sql` from the true migration set once the missing `cleaned_at` migration is added.
Migration required: Yes (the cleaned_at migration) + schema regen.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [LINT-001] Lint fails: 132 errors (mostly react-hooks/set-state-in-effect)
Severity: **Medium**
Category: Code quality / build hygiene
Affected module: Many pages
Affected files: e.g. `src/pages/VehiclesPage.tsx:160,174,193`, `WorkerComplianceProfilePage.tsx:95`, `services/vehicleCheckTemplatesService.ts:150,737`, `services/vehicleChecksService.ts:314`
Evidence: `npm run lint` → 132 errors, 9 warnings. Rule breakdown:
```
90  react-hooks/set-state-in-effect
25  react-refresh/only-export-components
 9  react-hooks/exhaustive-deps
 7  @typescript-eslint/no-unused-vars
 4  react-hooks/static-components
 3  react-hooks/refs
 1  no-useless-assignment / prefer-const / preserve-caught-error
```
Real impact: Lint is not wired into `build` (build still passes), so this does not block deploys, but the `set-state-in-effect` warnings point at real cascading-render patterns (many `void loadX()` and filter-reset effects). `exhaustive-deps` misses can cause stale data.
Recommended fix: Address `exhaustive-deps` and `set-state-in-effect` hotspots; remove unused vars. Do not blanket-disable.
Migration required: No.
Risk of regression: Low–Medium (behavioural if effects are refactored).
Verified / Inferred / Not testable: **Verified** (CLI).

---

### [ERR-001] Success toasts shown without verifying affected rows on delete
Severity: **Medium**
Category: Error handling
Affected module: Contacts, Workers, Documents
Affected files: `src/services/contactsService.ts:542-560`, `src/services/driversService.ts:1238-1243`, `src/pages/DocumentsPage.tsx:345`
Evidence:
```1238:1243:src/services/driversService.ts
  const { error } = await requireSupabase().from('drivers').delete().eq('id', id)
  if (error) { throw ... }
  // no affected-count verification
```
Real impact: A delete that matches zero rows (already gone, or blocked by a future RLS policy) still reports success. This is the same class of bug as the original Driver Reports clean stub.
Recommended fix: Use `.select('id')` on delete/update and treat zero rows as an error where the user expects a change.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [ERR-002] Broad silent catches hide failures
Severity: **Medium**
Category: Error handling
Affected module: Dashboard, Drivers, Auth
Affected files: `src/services/dashboardService.ts` (many `catch { return [] }`), `src/contexts/AuthContext.tsx:44`, `src/pages/ContactsPage.tsx:176-189` (no catch around mutation), `src/main.tsx:31`
Evidence: `dashboardService.ts` has ~18 `catch { return [] }` sites; dashboard sections silently render empty on error. `ContactsPage` shows a success toast in a `try/finally` with no `catch`, so mutation errors are uncaught after the toast.
Real impact: Failures are invisible to users and support; a partially failed dashboard looks like "no data".
Recommended fix: Log with context and surface a non-blocking error state; add `catch` around mutations before toasts.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [SETTINGS-001] All company settings are global singletons
Severity: **Medium**
Category: Multi-tenant / correctness
Affected module: Settings
Affected files: `src/services/companySettingsService.ts`, `src/lib/companySettingsGlobals.ts`, `src/contexts/CompanySettingsContext.tsx`
Exact lines: `companySettingsService.ts:655-696,909-949`
Evidence: `updateCompanySettings` loads the oldest company and updates it; the settings object is a module-level singleton applied app-wide. Every setting (week rules, overtime, holiday rules, time format, medical toggle, theme, session timeout, MFA flag) affects the single global company.
Real impact: With more than one tenant, one company editing settings changes them for everyone. Company name is locked in the UI (`toDbPayload` skips `name`) — intentional.
Recommended fix: Scope settings load/save by the authenticated user's company (Phase 2).
Migration required: Yes (for durable fix).
Risk of regression: Medium.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [PERF-001] Full-table loads and heavy dashboard fan-out
Severity: **Medium**
Category: Performance
Affected module: Dashboard, all list pages
Affected files: `src/services/dashboardService.ts:437-476,1646-1656`, list services (DATA-001)
Evidence: Dashboard fires ~9 parallel queries (`:1646-1656`) and loads full `vehicles`/`vehicle_availability`/`drivers` tables; list pages fetch all rows and filter client-side.
Real impact: Works at small scale; degrades as any tenant's data grows and (pre-RLS) multiplies across tenants. Client-side filtering ships unnecessary data.
Recommended fix: Server-side pagination + company scoping; select only needed columns.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [PERF-002] Large JS chunks in build output
Severity: **Low**
Category: Performance
Affected module: Build
Affected files: build output (`dist/assets/*`)
Evidence: `index-*.js` 519 kB (gzip 152 kB), `ConsumablesPage` 458 kB (gzip 129 kB), `timesheetPdfExport` 436 kB (gzip 141 kB), `AdminDashboardPage` 236 kB. Vite warns chunks > 500 kB.
Real impact: Slower first load, especially on the PDF export and Consumables (recharts) routes. Routes are lazy-loaded which mitigates initial cost.
Recommended fix: Dynamic-import PDF/chart libs; manual chunking.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (CLI build output).

---

### [ROUTE-001] Duplicate/orphan routes and nav mismatches
Severity: **Low**
Category: Routing
Affected module: Routing
Affected files: `src/router/AppRouter.tsx`, `src/lib/adminNavigation.ts`, orphan pages
Exact lines: `AppRouter.tsx:112-121,130-137`; `adminNavigation.ts:115-118,80`
Evidence: `/login` and `/login-design-preview` render the same page; `/admin` and `/admin/dashboard` duplicate; `CompliancePage.tsx`, `AdminLoginPage.tsx`, `src/pages/LandingPage.tsx`, `src/components/landing/*`, `WorkEntryPage.tsx` are unrouted; `/admin/driver-reports` is implemented but flagged "coming soon" in `comingSoonAdminRoutes`; two worker login URLs (`/driver-login`, `/worker-login`).
Real impact: Confusing surface area, dead code weight (landing components + framer-motion), and a possible nav inconsistency for driver reports.
Recommended fix: Remove orphan pages/preview routes; reconcile the coming-soon set with real routes.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

### [LEGAL-001] Landing legal links are placeholders; retention wording vs behaviour
Severity: **Low**
Category: Legal consistency
Affected module: Landing, Legal pages
Affected files: `landing/index.html:1287-1292`, `src/pages/PrivacyPage.tsx`, `src/pages/TermsPage.tsx`
Evidence: Landing footer Privacy/Terms/Cookies are `href="#"`. The in-app Privacy page (`PrivacyPage.tsx:644-738`) already **self-discloses** the gaps: six-year retention is a maximum framework, "automated six-year deletion is not yet" implemented (`:648-649`), and the Vehicle Check callout states a 24-month target "does not yet enforce automated deletion" (`:698-702`).
Real impact: Landing visitors cannot reach legal pages. The legal copy is honest about non-implemented retention/export automation, so the main risk is the broken landing links and ensuring UI "delete" wording matches archive/soft-delete behaviour.
Recommended fix: Point landing footer to the published legal pages; keep in-app disclosures in sync as retention/export features land.
Migration required: No.
Risk of regression: Low. (Note: `landing/` must not be modified in this audit — recorded only.)
Verified / Inferred / Not testable: **Verified** (repo).

---

### [DEPLOY-001] CSP allows unsafe-inline/unsafe-eval; landing has no security headers; no CI/Node pin
Severity: **Low**
Category: Deployment / configuration
Affected module: Deployment
Affected files: `vercel.json:1-37`, `landing/vercel.json:1-5`, no `.github/workflows`, no `.nvmrc`/`engines`
Evidence: Root `vercel.json` sets good headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy) but CSP `script-src` includes `'unsafe-inline' 'unsafe-eval'`. `landing/vercel.json` has only build config — no headers/rewrites. No CI workflows, no Node version pin, no `engines`. Source maps are not emitted (good). Secrets scan: no service_role/API keys in tracked source (only in gitignored `scripts/` using `.env.local`, and landing server function using `process.env.RESEND_API_KEY`).
Real impact: Weaker CSP than ideal; landing lacks hardening; environment reproducibility relies on developer machines.
Recommended fix: Tighten CSP where feasible; add landing security headers; pin Node via `.nvmrc`/`engines`; add a CI workflow running build+lint+typecheck.
Migration required: No.
Risk of regression: Low.
Verified / Inferred / Not testable: **Verified** (repo).

---

## Known Issues Confirmation

| Item | Status |
|------|--------|
| **Driver Reports cleanup** | Working tree (uncommitted, `git status` shows `M`) now **persists** via `cleanDriverReportsCurrentView` with `.select('id, cleaned_at')`, 0-row→error toast, and refetch (`driverReportsService.ts:318-397`, `DriverReportsPage.tsx:261-301`). Visibility filters exclude `cleaned_at` from Current, include it in History/All (`driverReportUtils.ts:198-213`). **Most likely cause of the reported live bug:** the fix is not yet committed/deployed (last commit `864227f`), so production still runs the earlier stub; secondarily, a company-text mismatch could yield 0 affected rows. **Live validation: NOT TESTED** against live Supabase. |
| **driver_reports.cleaned_at migration file** | **MISSING** — no `20260712210000_add_driver_reports_cleaned_at.sql`; not in `schema.sql`. Live column reportedly exists (manual apply). See DB-001. |
| **Phase 1 tenant membership migration** | Present, **untracked**, **REVIEW ONLY**, **not applied**. Correctly does **not** enable RLS on the 15 business tables; hard-stops on ambiguous/unmatched backfill (`20260712220000:518-522`). |
| **RLS disabled tables** | Confirmed 15 business tables RLS-disabled + compliance; `anon`/`authenticated` full CRUD grants (`policies.sql:15-63`). See SEC-001. |
| **company_members** | **Absent** in production schema; defined only in the untracked Phase 1 migration (`:66-115`). |
| **oldest-company logic** | Confirmed in app (`companySettingsService.ts:689-696`) and SQL helpers (`policies.sql:65-76,167-171`) and a documents backfill (`20260706220000:153-158`). See SEC-003. |
| **text company filtering** | Confirmed: `resolveCompanyScope()` → `getGlobalCompanySettings()?.name` used by driver reports/contacts/documents; other services use no filter. |
| **sessionStorage portal security** | Confirmed client-only authorization (`authPortal.ts`, `AppRouter.tsx`). See SEC-002. |
| **service_role exposure** | **None** in tracked frontend/source. Only in gitignored `scripts/*` (guarded against `VITE_*`) and landing server function via `process.env`. |
| **Vehicle Checks template/guidance** | 27 DVSA items with guidance present (`defaultDvsaVehicleCheckItems.ts`, sortOrder 1–27); create-time duplicate guard; loader injects fallback guidance. INFO/PASS. |
| **offline Vehicle Checks** | **ABSENT** — no IndexedDB/queue; SW unregistered in prod; no worker vehicle-check route. See PWA-001. |
| **Documents View 404 risk** | Present — stale `filePath`/`fileUrl` → signed-URL error toast; external URLs returned unscoped. See DATA-008. |
| **legal-page implementation** | In-app `/terms`, `/privacy`, `/admin/faq` implemented and honest about non-implemented retention/export automation. Landing footer legal links are `#` placeholders. See LEGAL-001. |
| **landing login links** | Correct: `landing/index.html` → `https://app.drevora.app/login` (`:96,159,1206`). |

---

## Module Scorecard

Scores 0–10 (evidence-based; low where isolation/enforcement is missing).

| Module | Correctness | Security | Data integrity | Usability | Mobile | Prod readiness |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|
| Authentication | 6 | 2 | 5 | 7 | 7 | 3 |
| Dashboard | 5 | 3 | 4 | 8 | 7 | 4 |
| Workers | 7 | 2 | 5 | 8 | 7 | 4 |
| Vehicles | 7 | 2 | 5 | 8 | 7 | 4 |
| Timesheets | 6 | 3 | 6 | 8 | 6 | 5 |
| Holiday Requests | 6 | 3 | 6 | 8 | 7 | 5 |
| Vehicle Checks | 6 | 3 | 5 | 8 | 6 | 4 |
| Driver Reports | 7 | 3 | 6 | 8 | 7 | 5 |
| Documents | 6 | 2 | 5 | 7 | 7 | 4 |
| Consumables | 7 | 3 | 6 | 8 | 7 | 5 |
| Contacts | 7 | 3 | 6 | 8 | 7 | 5 |
| Settings | 5 | 2 | 5 | 8 | 7 | 3 |
| Landing | 7 | 6 | 8 | 8 | 7 | 6 |
| PWA/offline | 2 | 5 | 6 | 5 | 4 | 2 |
| Supabase security | 3 | 1 | 4 | — | — | 2 |

> Mobile scores are **Inferred** from responsive Tailwind usage and mobile-first components; no browser testing was performed (Area 22 requires live browser verification — **NOT TESTED**).

---

## Command Results

| Command | Result | Exit | Notes |
|---------|--------|-----:|-------|
| `git status --short` | PASS | 0 | 5 modified driver-reports files (uncommitted fix) + untracked `supabase/diagnostics/`, Phase 1 migration. Working tree preserved. |
| `git branch --show-current` | PASS | 0 | `main` |
| `git log -1 --oneline` | PASS | 0 | `864227f Fix driver reports cleanup and update dashboard UI` |
| `npx tsc --noEmit` | **PASS** | 0 | No type errors. |
| `npm run build` (`tsc -b && vite build`) | **PASS** | 0 | Built in ~13–14s; PWA `sw.js` generated; chunk-size warnings (PERF-002). |
| `npm run lint` (`eslint .`) | **FAIL** | 1 | 132 errors, 9 warnings (LINT-001). Lint is not part of `build`. |
| Tests | **NOT AVAILABLE** | — | No `test` script; only `verify:paid-breaks` (tsx script, not run — would touch data expectations). |
| Secret scan (Grep, tracked files) | PASS | — | No service_role/API keys/passwords in tracked frontend/source. |
| `npm audit` | **NOT RUN** | — | Available at root and `landing/`; skipped per instructions (no fixes). |

Notable lint hotspots: `VehiclesPage.tsx:160,174,193`; `WorkerComplianceProfilePage.tsx:95`; `vehicleCheckTemplatesService.ts:150,737`; `vehicleChecksService.ts:314` (unused stripped-field vars — not dead upload logic).

---

## Database and Migration Map

76 migration files; timestamps unique; lexicographic = chronological; **no duplicate or out-of-order timestamps**. Applied status is **unknown** (not verified against live DB).

Selected chronology (see Area 2 detail for the full 76):

| Order | File | Purpose | Applied | Depends on |
|------|------|---------|---------|-----------|
| 1 | `20260627082900_create_drivers_table.sql` | drivers/workers | unknown | — |
| 9 | `20260627153000_create_companies_table.sql` | companies settings | unknown | — |
| 10 | `20260628160000_create_timesheets_tables.sql` | timesheets + entries | unknown | drivers |
| 15 | `20260628210000_create_vehicle_checks_tables.sql` | vehicle_checks + items | unknown | vehicles, drivers |
| 58 | `20260706220000_create_documents_table.sql` | documents + `document-files` bucket + **oldest-company backfill** | unknown | companies, drivers, vehicles |
| 59 | `20260706230000_create_driver_reports_table.sql` | driver_reports + `driver-report-files` bucket | unknown | drivers, vehicles |
| 62 | `20260707204700_normalize_vehicle_check_templates.sql` | parent/child templates | unknown | templates |
| 73 | `20260712160000_contacts_worker_link.sql` | contacts.worker_id FK | unknown | contacts, drivers |
| 74 | `20260712183000_restore_dvsa_walkaround_guidance.sql` | restore 27-item guidance | unknown | templates |
| 75 | `20260712190000_allow_medical_document_uploads.sql` | medical toggle | unknown | companies |
| — | **`20260712210000_add_driver_reports_cleaned_at.sql`** | **MISSING** — required by app | **not present** | driver_reports |
| 76 | `20260712220000_rls_tenant_membership_foundation.sql` | Phase 1 foundation | **REVIEW ONLY / not applied** | all root tables |

Conflicts / drift / risks:
- **Missing file** for `driver_reports.cleaned_at` (DB-001) → schema drift (DB-002).
- **Three parallel tenant models**: `company text` (drivers/documents/reports/contacts/templates), `company_id uuid` (only `dashboard_notes` today), and Phase 1's added `company_id uuid` everywhere (pending). Vehicles/consumables have no company text at all.
- **Destructive-but-guarded statements**: column drop in `20260702120000:52-53`; oldest-company document backfill `20260706220000:153-158`; dynamic index/constraint drops in `20260705170000`. No `DROP TABLE`/`DELETE FROM`/`TRUNCATE` on business tables.
- **Do not enable RLS** on business tables until app writes `company_id` + membership exists (Phase 3).

---

## Recommended Fix Order

### Phase 0 — Emergency security blockers
- Tasks: Decide interim exposure posture for the anon key; ensure no untrusted users have the anon key; add the missing `cleaned_at` migration and regenerate `schema.sql`; commit/deploy the Driver Reports clean fix so live behaviour matches the working tree.
- Dependencies: None.
- Risk: Low. Verification: build+typecheck; confirm clean persists in a controlled test.
- Modules: Driver Reports, DB.

### Phase 1 — Tenant membership foundation
- Tasks: Run the preflight (`supabase/diagnostics/20260712_rls_phase1_preflight.sql`) in SQL Editor; resolve any ambiguous/duplicate company names; apply Phase 1 migration (creates `company_members`, nullable `company_id`, auth helpers, hard-stop backfill). Does not enable business RLS.
- Dependencies: Phase 0; clean company-name uniqueness.
- Risk: Medium (backfill). Verification: preflight WOULD PASS; migration completes without hard-stop.
- Modules: DB, Auth.

### Phase 2 — Application company_id conversion
- Tasks: Populate/require `company_id` on writes; convert every service to scope by the authenticated user's `company_id` (replace oldest-company + text filters); resolve portal/role from `company_members`.
- Dependencies: Phase 1.
- Risk: High (touches all services). Verification: two-tenant test shows isolation in-app before RLS.
- Modules: All services, Settings, Dashboard, Auth.

### Phase 3 — Full RLS policies
- Tasks: Add `USING`/`WITH CHECK` policies bound to membership on all 15 tables; tenant-path storage policies; make `worker-avatars` private or path-scoped; add policies for `document-files`/`driver-report-files`. Enable RLS.
- Dependencies: Phase 2 verified.
- Risk: High (can blank data if code not converted). Verification: two-tenant API tests confirm no cross-tenant read/write.
- Modules: DB, Storage, all modules.

### Phase 4 — Critical functional bugs
- Tasks: VC-001 (update-path completion invariants), VC-002 (item orphan rollback), DATA-002 (dashboard cleaned_at + scope), DATA-003/004 (timesheet totals), DATA-005/006 (holiday date/overlap), DATA-007 (consumables litres), ERR-001/002.
- Dependencies: Phase 0.
- Risk: Low–Medium. Verification: targeted tests + manual reproduction.
- Modules: Vehicle Checks, Dashboard, Timesheets, Holidays, Consumables.

### Phase 5 — Module regression testing
- Tasks: Introduce a test runner; add unit tests for timesheet/holiday/consumable calculators and vehicle-check invariants; fix lint hotspots (LINT-001).
- Dependencies: Phase 4.
- Risk: Low. Verification: green tests; lint error count → 0.

### Phase 6 — First-customer onboarding test
- Tasks: Create a second real company + members; run through every module verifying isolation, settings, dashboards, storage.
- Dependencies: Phases 1–5.
- Risk: Medium. Verification: documented two-tenant walkthrough with PASS/FAIL.

### Phase 7 — Production release checks
- Tasks: Decide PWA/offline strategy (PWA-001); tighten CSP and add landing headers (DEPLOY-001); add CI (build+lint+typecheck) and Node pin; fix landing legal links (separate task — `landing/` excluded here); performance chunking (PERF-002).
- Dependencies: All prior.
- Risk: Low. Verification: CI green; Lighthouse/manual browser + mobile testing (Area 22/17).

---

## Safe Next Action

**Add the missing idempotent migration `supabase/migrations/20260712210000_add_driver_reports_cleaned_at.sql` (`add column if not exists cleaned_at timestamptz` + index) and sync `supabase/schema.sql`, then commit and deploy the already-written Driver Reports clean fix.** This closes the reproducible-schema gap (DB-001/DB-002) and makes live behaviour match the verified working-tree code, with zero impact on the RLS/tenant work — the single lowest-risk, highest-value step before starting the Phase 1 preflight.
