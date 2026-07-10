import { FleetOperationsHeader } from '@/components/dashboard/FleetOperationsHeader'
import {
  DashboardOnboardingCard,
  DashboardOverview,
} from '@/components/dashboard/DashboardOverview'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { DashboardQuickSearch } from '@/components/dashboard/DashboardQuickSearch'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useFleetOperationsHeader } from '@/hooks/useFleetOperationsHeader'
import AdminLayout from '@/layouts/AdminLayout'

function AdminDashboardPage() {
  const fleetHeader = useFleetOperationsHeader()
  const { stats, loading } = useDashboardStats()

  const isEmptyWorkspace =
    !loading.kpis &&
    !loading.fleetStatus &&
    stats.workers === 0 &&
    stats.vehicles === 0

  return (
    <AdminLayout
      premiumBackground
      wideContent
      customHeader={<FleetOperationsHeader {...fleetHeader} />}
    >
      <DashboardQuickSearch />
      <DashboardPageHeader />

      {isEmptyWorkspace ? (
        <div className="space-y-6">
          <DashboardOnboardingCard />
          <DashboardOverview stats={stats} loading={loading} />
        </div>
      ) : (
        <DashboardOverview stats={stats} loading={loading} />
      )}
    </AdminLayout>
  )
}

export default AdminDashboardPage
