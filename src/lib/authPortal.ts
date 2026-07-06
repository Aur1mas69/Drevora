export type AuthPortal = 'admin' | 'worker'

const AUTH_PORTAL_STORAGE_KEY = 'drevora.auth.portal'

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
