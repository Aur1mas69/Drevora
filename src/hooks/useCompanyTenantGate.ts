import { useCompanySettings } from '@/contexts/CompanySettingsContext'

/**
 * Authoritative tenant readiness for authenticated admin data loads.
 * Tenant-owned queries must wait until companyReady is true.
 */
export function useCompanyTenantGate() {
  const {
    companyId,
    companyReady,
    companyLoading,
    authLoading,
    membershipError,
  } = useCompanySettings()

  return {
    companyId,
    companyReady,
    companyLoading,
    authLoading,
    membershipError,
  }
}
