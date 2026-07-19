import { useCallback, useEffect, useRef, useState } from 'react'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import {
  MissingCompanyContextError,
} from '@/lib/companySettingsGlobals'
import {
  dashboardService,
  emptyDashboardStats,
  type DashboardSectionKey,
  type DashboardStats,
} from '@/services/dashboardService'

export type DashboardLoadingState = Record<DashboardSectionKey, boolean>

export const initialDashboardLoadingState: DashboardLoadingState = {
  kpis: true,
  timesheet: true,
  holidays: true,
  driverReports: true,
  fleetStatus: true,
  vehicleChecks: true,
  tyreChecks: true,
  consumables: true,
  recentActivity: true,
}

const allLoadedState: DashboardLoadingState = {
  kpis: false,
  timesheet: false,
  holidays: false,
  driverReports: false,
  fleetStatus: false,
  vehicleChecks: false,
  tyreChecks: false,
  consumables: false,
  recentActivity: false,
}

export function useDashboardStats() {
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const [stats, setStats] = useState<DashboardStats>(emptyDashboardStats)
  const [loading, setLoading] = useState<DashboardLoadingState>(initialDashboardLoadingState)
  const [loadError, setLoadError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const markSectionLoaded = useCallback((section: DashboardSectionKey) => {
    setLoading((current) => {
      if (!current[section]) return current
      return { ...current, [section]: false }
    })
  }, [])

  useEffect(() => {
    // Membership still resolving — keep skeletons, never treat as empty data.
    if (companyLoading || (!companyReady && !membershipError)) {
      setLoading(initialDashboardLoadingState)
      setLoadError(null)
      return
    }

    // Membership failed — stop loading and clear tenant stats.
    if (!companyReady || !companyId) {
      requestIdRef.current += 1
      setStats(emptyDashboardStats)
      setLoading(allLoadedState)
      setLoadError(membershipError)
      return
    }

    const requestId = ++requestIdRef.current
    const controller = new AbortController()

    setStats(emptyDashboardStats)
    setLoading(initialDashboardLoadingState)
    setLoadError(null)

    void dashboardService
      .loadDashboardStatsProgressively({
        companyId,
        signal: controller.signal,
        onUpdate: (patch) => {
          if (requestId !== requestIdRef.current) return
          setStats((current) => ({ ...current, ...patch }))
        },
        onSectionLoaded: (section) => {
          if (requestId !== requestIdRef.current) return
          markSectionLoaded(section)
        },
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return

        if (error instanceof MissingCompanyContextError) {
          // Not an empty workspace — keep waiting / surface membership state.
          setLoading(initialDashboardLoadingState)
          setLoadError(null)
          return
        }

        console.error('[useDashboardStats] dashboard load failed:', error)
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load dashboard data.',
        )
        setLoading(allLoadedState)
      })

    return () => {
      controller.abort()
    }
  }, [companyReady, companyId, companyLoading, membershipError, markSectionLoaded])

  // Logout / company switch must not leave previous tenant counts visible.
  useEffect(() => {
    if (!companyId) {
      setStats(emptyDashboardStats)
    }
  }, [companyId])

  const isInitialLoad =
    loading.kpis &&
    loading.timesheet &&
    loading.holidays &&
    loading.driverReports &&
    loading.fleetStatus &&
    loading.vehicleChecks &&
    loading.tyreChecks &&
    loading.consumables &&
    loading.recentActivity

  return { stats, loading, isInitialLoad, loadError, companyReady }
}
