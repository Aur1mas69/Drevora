export type AuthPortal = 'admin' | 'worker'

const AUTH_PORTAL_STORAGE_KEY = 'drevora.auth.portal'

/**
 * Portal selection is UI/routing presentation only.
 * It is NOT a security boundary: it must not determine companyId, prove
 * company_members membership, grant Admin/Worker database access, or replace
 * membershipRole from public.company_members.
 */
export function readStoredAuthPortal(): AuthPortal | null {
  const value = sessionStorage.getItem(AUTH_PORTAL_STORAGE_KEY)
  if (value === 'admin' || value === 'worker') return value
  return null
}

export function writeStoredAuthPortal(portal: AuthPortal): void {
  sessionStorage.setItem(AUTH_PORTAL_STORAGE_KEY, portal)
}

export function clearStoredAuthPortal(): void {
  sessionStorage.removeItem(AUTH_PORTAL_STORAGE_KEY)
}
