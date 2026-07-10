import { useCallback, useEffect, useState } from 'react'
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
  consumables: true,
  recentActivity: true,
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(emptyDashboardStats)
  const [loading, setLoading] = useState<DashboardLoadingState>(initialDashboardLoadingState)

  const markSectionLoaded = useCallback((section: DashboardSectionKey) => {
    setLoading((current) => {
      if (!current[section]) return current
      return { ...current, [section]: false }
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    void dashboardService.loadDashboardStatsProgressively({
      signal: controller.signal,
      onUpdate: (patch) => {
        setStats((current) => ({ ...current, ...patch }))
      },
      onSectionLoaded: markSectionLoaded,
    })

    return () => {
      controller.abort()
    }
  }, [markSectionLoaded])

  const isInitialLoad =
    loading.kpis &&
    loading.timesheet &&
    loading.holidays &&
    loading.driverReports &&
    loading.fleetStatus &&
    loading.vehicleChecks &&
    loading.consumables &&
    loading.recentActivity

  return { stats, loading, isInitialLoad }
}
