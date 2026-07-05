import { useEffect, useState } from 'react'
import { FleetOperationsHeader } from '@/components/dashboard/FleetOperationsHeader'
import {
  DashboardOnboardingCard,
  DashboardOverview,
  DashboardPageHeader,
} from '@/components/dashboard/DashboardOverview'
import { useFleetOperationsHeader } from '@/hooks/useFleetOperationsHeader'
import AdminLayout from '@/layouts/AdminLayout'
import {
  dashboardService,
  emptyDashboardStats,
  type DashboardStats,
} from '@/services/dashboardService'

function AdminDashboardPage() {
  const fleetHeader = useFleetOperationsHeader()
  const [stats, setStats] = useState<DashboardStats>(emptyDashboardStats)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    async function load() {
      setIsLoading(true)
      const result = await dashboardService.fetchDashboardStats()
      if (!isCancelled) {
        setStats(result)
        setIsLoading(false)
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [])

  const isEmptyWorkspace = !isLoading && stats.workers === 0 && stats.vehicles === 0

  return (
    <AdminLayout
      premiumBackground
      wideContent
      customHeader={<FleetOperationsHeader {...fleetHeader} />}
    >
      <DashboardPageHeader />

      {isEmptyWorkspace ? (
        <div className="space-y-6">
          <DashboardOnboardingCard />
          <DashboardOverview stats={stats} isLoading={isLoading} />
        </div>
      ) : (
        <DashboardOverview stats={stats} isLoading={isLoading} />
      )}
    </AdminLayout>
  )
}

export default AdminDashboardPage
