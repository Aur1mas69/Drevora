/**
 * Verified public.company_members.role helpers.
 * Portal sessionStorage / login URL must never grant Office UI access.
 *
 * MVP system roles (stored distinctly — never collapsed to Admin):
 *   Admin | Manager | Office | Supervisor | Driver
 *
 * Admin / Manager / Office / Supervisor currently share full Office access.
 * Driver is Worker/mobile only.
 *
 * Legacy Office membership values (Transport Manager, Planner, Office Staff)
 * remain accepted for access so existing rows are not rewritten.
 */

/** Canonical MVP Office system roles offered for new Office users. */
export const OFFICE_MEMBERSHIP_ROLES = [
  'Admin',
  'Manager',
  'Office',
  'Supervisor',
] as const

export type CanonicalOfficeMembershipRole =
  (typeof OFFICE_MEMBERSHIP_ROLES)[number]

/**
 * Legacy Office membership roles still accepted by access gates.
 * Not offered for new Office users; do not auto-convert existing rows.
 */
export const LEGACY_OFFICE_MEMBERSHIP_ROLES = [
  'Transport Manager',
  'Planner',
  'Office Staff',
] as const

export type LegacyOfficeMembershipRole =
  (typeof LEGACY_OFFICE_MEMBERSHIP_ROLES)[number]

/** Every company_members.role value that grants Office shell access. */
export const ALL_OFFICE_MEMBERSHIP_ROLES = [
  ...OFFICE_MEMBERSHIP_ROLES,
  ...LEGACY_OFFICE_MEMBERSHIP_ROLES,
] as const

export type OfficeMembershipRole = (typeof ALL_OFFICE_MEMBERSHIP_ROLES)[number]

/** Normal Worker membership role for the Worker shell. */
export const WORKER_MEMBERSHIP_ROLE = 'Driver' as const

export type WorkerMembershipRole = typeof WORKER_MEMBERSHIP_ROLE

/** Full MVP system role vocabulary on company_members.role. */
export const SYSTEM_MEMBERSHIP_ROLES = [
  ...OFFICE_MEMBERSHIP_ROLES,
  WORKER_MEMBERSHIP_ROLE,
] as const

export type SystemMembershipRole = (typeof SYSTEM_MEMBERSHIP_ROLES)[number]

/** Existing Worker shell landing route (Worker DashboardPage + MainLayout). */
export const WORKER_HOME_PATH = '/dashboard'

/** Canonical login route for Worker and Office (single official login page). */
export const LOGIN_PATH = '/login'

/**
 * Alias of LOGIN_PATH for older Worker call sites.
 * Legacy URL `/worker-login` redirects to LOGIN_PATH in the router.
 */
export const WORKER_LOGIN_PATH = LOGIN_PATH

/** Existing Office shell landing route. */
export const OFFICE_HOME_PATH = '/admin'

export function isCanonicalOfficeMembershipRole(
  role: string | null | undefined,
): role is CanonicalOfficeMembershipRole {
  return (
    typeof role === 'string' &&
    (OFFICE_MEMBERSHIP_ROLES as readonly string[]).includes(role)
  )
}

export function isLegacyOfficeMembershipRole(
  role: string | null | undefined,
): role is LegacyOfficeMembershipRole {
  return (
    typeof role === 'string' &&
    (LEGACY_OFFICE_MEMBERSHIP_ROLES as readonly string[]).includes(role)
  )
}

export function isOfficeMembershipRole(
  role: string | null | undefined,
): role is OfficeMembershipRole {
  return (
    typeof role === 'string' &&
    (ALL_OFFICE_MEMBERSHIP_ROLES as readonly string[]).includes(role)
  )
}

export function isWorkerMembershipRole(
  role: string | null | undefined,
): role is WorkerMembershipRole {
  return role === WORKER_MEMBERSHIP_ROLE
}

export function isSystemMembershipRole(
  role: string | null | undefined,
): role is SystemMembershipRole {
  return (
    typeof role === 'string' &&
    (SYSTEM_MEMBERSHIP_ROLES as readonly string[]).includes(role)
  )
}
