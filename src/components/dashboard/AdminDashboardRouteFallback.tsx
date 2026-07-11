import {
  DashboardHeroFallback,
  DashboardOverviewSkeleton,
} from '@/components/dashboard/DashboardOverviewSkeletons'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import AdminLayout from '@/layouts/AdminLayout'

function QuickSearchFallback() {
  return (
    <div
      className="rounded-2xl border border-[#C5DFFB]/85 bg-gradient-to-br from-[#F5FAFF]/98 to-[#EEF6FF]/92 px-4 py-3.5 shadow-[0_4px_20px_rgba(33,142,231,0.08)] ring-1 ring-[#D3E9FC]/70 sm:px-5 sm:py-4"
      aria-hidden="true"
    >
      <div className="h-11 rounded-[16px] border border-[#C5DFFB]/80 bg-[#FAFCFF]/95" />
    </div>
  )
}

export default function AdminDashboardRouteFallback() {
  return (
    <AdminLayout premiumBackground wideContent adminDashboard customHeader={<DashboardHeroFallback />}>
      <QuickSearchFallback />
      <DashboardPageHeader />
      <DashboardOverviewSkeleton />
    </AdminLayout>
  )
}
