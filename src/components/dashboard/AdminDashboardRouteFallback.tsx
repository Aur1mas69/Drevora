import {
  DashboardHeroFallback,
  DashboardOverviewSkeleton,
} from '@/components/dashboard/DashboardOverviewSkeletons'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import AdminLayout from '@/layouts/AdminLayout'

function QuickSearchFallback() {
  return (
    <div
      className="h-12 w-full rounded-[10px] border border-[#C5D4E3]/90 bg-[#FCFDFF] shadow-[0_2px_10px_rgba(33,142,231,0.08)]"
      aria-hidden="true"
    />
  )
}

export default function AdminDashboardRouteFallback() {
  return (
    <AdminLayout
      premiumBackground
      wideContent
      adminDashboard
      headerSearch={<QuickSearchFallback />}
      customHeader={<DashboardHeroFallback />}
    >
      <DashboardPageHeader />
      <DashboardOverviewSkeleton />
    </AdminLayout>
  )
}
