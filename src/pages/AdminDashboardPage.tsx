import {
  DashboardOnboardingCard,
  DashboardOverview,
} from '@/components/dashboard/DashboardOverview'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import { DashboardQuickSearch } from '@/components/dashboard/DashboardQuickSearch'
import { FleetOperationsHeader } from '@/components/dashboard/FleetOperationsHeader'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useFleetOperationsHeader } from '@/hooks/useFleetOperationsHeader'
import AdminLayout from '@/layouts/AdminLayout'

function AdminDashboardPage() {
  const fleetHeader = useFleetOperationsHeader()
  const { stats, loading, loadError, companyReady } = useDashboardStats()

  const isEmptyWorkspace =
    companyReady &&
    !loadError &&
    !loading.kpis &&
    !loading.fleetStatus &&
    stats.workers === 0 &&
    stats.vehicles === 0

  return (
    <AdminLayout
      premiumBackground
      wideContent
      adminDashboard
      headerLeading={<DashboardPageHeader />}
      headerSearch={<DashboardQuickSearch />}
      customHeader={<FleetOperationsHeader {...fleetHeader} />}
    >
      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
        >
          {loadError}
        </div>
      ) : null}
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
