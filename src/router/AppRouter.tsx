import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import {
  MembershipAccessBlocked,
  MembershipLoadingScreen,
  useMembershipAccessState,
} from '@/components/auth/MembershipAccessGate'
import AdminDashboardRouteFallback from '@/components/dashboard/AdminDashboardRouteFallback'
import { loadAdminDashboardPage, preloadAdminDashboardPage } from '@/lib/adminDashboardRoute'
import { OFFICE_HOME_PATH, WORKER_HOME_PATH } from '@/lib/membershipRoles'

const MainLayout = lazy(() => import('@/layouts/MainLayout'))
const AdminDashboardPage = lazy(loadAdminDashboardPage)
const AdminComingSoonPage = lazy(() => import('@/pages/admin/AdminComingSoonPage'))
const ContactsPage = lazy(() => import('@/pages/ContactsPage'))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'))
const DriverReportsPage = lazy(() => import('@/pages/DriverReportsPage'))
const ConsumablesPage = lazy(() => import('@/pages/ConsumablesPage'))
const VehicleComplianceProfilePage = lazy(
  () => import('@/pages/VehicleComplianceProfilePage'),
)
const WorkerComplianceProfilePage = lazy(
  () => import('@/pages/WorkerComplianceProfilePage'),
)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const DriverDetailsPage = lazy(() => import('@/pages/DriverDetailsPage'))
const DriverLoginPage = lazy(() => import('@/pages/DriverLoginPage'))
const WorkerLoginPage = lazy(() => import('@/pages/WorkerLoginPage'))
const LoginTwilightPreviewPage = lazy(
  () => import('@/pages/LoginTwilightPreviewPage'),
)
const DriversPage = lazy(() => import('@/pages/DriversPage'))
const MyHolidaysPage = lazy(() => import('@/pages/MyHolidaysPage'))
const WorkerTimesheetsPage = lazy(
  () => import('@/pages/worker/WorkerTimesheetsPage'),
)
const WorkerVehiclesPage = lazy(
  () => import('@/pages/worker/WorkerVehiclesPage'),
)
const WorkerVehicleChecksPage = lazy(
  () => import('@/pages/worker/WorkerVehicleChecksPage'),
)
const WorkerConsumablesPage = lazy(
  () => import('@/pages/worker/WorkerConsumablesPage'),
)
const WorkerDriverReportsPage = lazy(
  () => import('@/pages/worker/WorkerDriverReportsPage'),
)
const WorkerContactsPage = lazy(
  () => import('@/pages/worker/WorkerContactsPage'),
)
const WorkerSettingsPage = lazy(
  () => import('@/pages/worker/WorkerSettingsPage'),
)
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const FaqHelpPage = lazy(() => import('@/pages/FaqHelpPage'))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const TermsPage = lazy(() => import('@/pages/TermsPage'))
const HolidayRequestsPage = lazy(() => import('@/pages/HolidayRequestsPage'))
const VehicleChecksPage = lazy(() => import('@/pages/VehicleChecksPage'))
const TimesheetsPage = lazy(() => import('@/pages/TimesheetsPage'))
const VehicleDetailsPage = lazy(() => import('@/pages/VehicleDetailsPage'))
const VehiclesPage = lazy(() => import('@/pages/VehiclesPage'))

function RouteLoadingFallback() {
  return <MembershipLoadingScreen />
}

/**
 * Office shell: verified company_members office role only.
 * Never uses sessionStorage portal. Does not render Office pages while loading.
 */
function RequireOfficeAccess({ children }: { children: ReactNode }) {
  const access = useMembershipAccessState()

  useEffect(() => {
    if (access.status === 'office') {
      preloadAdminDashboardPage()
    }
  }, [access.status])

  if (access.status === 'loading') {
    return <MembershipLoadingScreen />
  }

  if (access.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (access.status === 'worker') {
    return <Navigate to={WORKER_HOME_PATH} replace />
  }

  if (access.status === 'blocked') {
    return <MembershipAccessBlocked message={access.message} />
  }

  return children
}

/**
 * Worker shell: verified company_members role Driver only.
 * Renders MainLayout (Worker nav) only after role is confirmed.
 */
function RequireWorkerAccess() {
  const access = useMembershipAccessState()

  if (access.status === 'loading') {
    return <MembershipLoadingScreen />
  }

  if (access.status === 'unauthenticated') {
    return <Navigate to="/driver-login" replace />
  }

  if (access.status === 'office') {
    return <Navigate to={OFFICE_HOME_PATH} replace />
  }

  if (access.status === 'blocked') {
    return <MembershipAccessBlocked message={access.message} />
  }

  return <MainLayout />
}

function AdminDashboardRoute() {
  return (
    <Suspense fallback={<AdminDashboardRouteFallback />}>
      <AdminDashboardPage />
    </Suspense>
  )
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginTwilightPreviewPage />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        <Route path="/driver-login" element={<DriverLoginPage />} />
        <Route path="/worker-login" element={<WorkerLoginPage />} />
        <Route
          path="/login-design-preview"
          element={<LoginTwilightPreviewPage />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <RequireOfficeAccess>
              <AdminDashboardRoute />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireOfficeAccess>
              <AdminDashboardRoute />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/drivers"
          element={
            <RequireOfficeAccess>
              <DriversPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/drivers/:id"
          element={
            <RequireOfficeAccess>
              <DriverDetailsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/documents"
          element={
            <RequireOfficeAccess>
              <DocumentsPage />
            </RequireOfficeAccess>
          }
        />
        <Route path="/compliance" element={<Navigate to="/documents" replace />} />
        <Route
          path="/compliance/workers/:workerId"
          element={
            <RequireOfficeAccess>
              <WorkerComplianceProfilePage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/compliance/vehicles/:vehicleId"
          element={
            <RequireOfficeAccess>
              <VehicleComplianceProfilePage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/contacts"
          element={
            <RequireOfficeAccess>
              <ContactsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/consumables"
          element={
            <RequireOfficeAccess>
              <ConsumablesPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/vehicles"
          element={
            <RequireOfficeAccess>
              <VehiclesPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/vehicles/:id"
          element={
            <RequireOfficeAccess>
              <VehicleDetailsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/timesheets"
          element={
            <RequireOfficeAccess>
              <TimesheetsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireOfficeAccess>
              <SettingsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/faq"
          element={
            <RequireOfficeAccess>
              <FaqHelpPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/terms"
          element={
            <RequireOfficeAccess>
              <TermsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/privacy"
          element={
            <RequireOfficeAccess>
              <PrivacyPage />
            </RequireOfficeAccess>
          }
        />
        <Route path="/admin/help" element={<Navigate to="/admin/faq" replace />} />
        <Route path="/help" element={<Navigate to="/admin/faq" replace />} />
        <Route path="/faq" element={<Navigate to="/admin/faq" replace />} />
        <Route
          path="/admin/holidays"
          element={
            <RequireOfficeAccess>
              <HolidayRequestsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/vehicle-checks"
          element={
            <RequireOfficeAccess>
              <VehicleChecksPage />
            </RequireOfficeAccess>
          }
        />
        <Route path="/admin/compliance/licences" element={<Navigate to="/documents" replace />} />
        <Route path="/admin/compliance/cpc" element={<Navigate to="/documents" replace />} />
        <Route path="/admin/compliance/tachograph-cards" element={<Navigate to="/documents" replace />} />
        <Route path="/admin/compliance/documents" element={<Navigate to="/documents" replace />} />
        <Route
          path="/admin/driver-reports"
          element={
            <RequireOfficeAccess>
              <DriverReportsPage />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Reports" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/reports/analytics"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Analytics" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/reports/exports"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Exports" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="User Management" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Roles & Permissions" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Notifications" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/integrations"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Integrations" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Billing" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/api-keys"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="API Keys" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Audit Log" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/system-logs"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="System Logs" />
            </RequireOfficeAccess>
          }
        />
        <Route
          path="/admin/backups"
          element={
            <RequireOfficeAccess>
              <AdminComingSoonPage title="Backups" />
            </RequireOfficeAccess>
          }
        />
        <Route element={<RequireWorkerAccess />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/worker/timesheets" element={<WorkerTimesheetsPage />} />
          <Route path="/worker/holidays" element={<MyHolidaysPage />} />
          <Route path="/my-holidays" element={<Navigate to="/worker/holidays" replace />} />
          <Route path="/worker/vehicles" element={<WorkerVehiclesPage />} />
          <Route
            path="/worker/vehicle-checks"
            element={<WorkerVehicleChecksPage />}
          />
          <Route path="/worker/consumables" element={<WorkerConsumablesPage />} />
          <Route
            path="/worker/driver-reports"
            element={<WorkerDriverReportsPage />}
          />
          <Route path="/worker/contacts" element={<WorkerContactsPage />} />
          <Route path="/worker/settings" element={<WorkerSettingsPage />} />
          <Route path="/history" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/profile"
            element={<Navigate to="/worker/settings" replace />}
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default AppRouter
