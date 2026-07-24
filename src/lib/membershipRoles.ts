/**
 * Verified public.company_members.role helpers.
 * Portal sessionStorage / login URL must never grant Office UI access.
 */

export const OFFICE_MEMBERSHIP_ROLES = [
  'Admin',
  'Transport Manager',
  'Supervisor',
  'Planner',
  'Office Staff',
] as const

export type OfficeMembershipRole = (typeof OFFICE_MEMBERSHIP_ROLES)[number]

/** Normal Worker membership role for the Worker shell. */
export const WORKER_MEMBERSHIP_ROLE = 'Driver' as const

export type WorkerMembershipRole = typeof WORKER_MEMBERSHIP_ROLE

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

export function isOfficeMembershipRole(
  role: string | null | undefined,
): role is OfficeMembershipRole {
  return (
    typeof role === 'string' &&
    (OFFICE_MEMBERSHIP_ROLES as readonly string[]).includes(role)
  )
}

export function isWorkerMembershipRole(
  role: string | null | undefined,
): role is WorkerMembershipRole {
  return role === WORKER_MEMBERSHIP_ROLE
}
