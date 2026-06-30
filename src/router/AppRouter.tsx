import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import type { ReactNode } from 'react'
import MainLayout from '@/layouts/MainLayout'
import AdminDashboardPage from '@/pages/AdminDashboardPage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import AdminComingSoonPage from '@/pages/admin/AdminComingSoonPage'
import CompliancePage from '@/pages/CompliancePage'
import VehicleComplianceProfilePage from '@/pages/VehicleComplianceProfilePage'
import WorkerComplianceProfilePage from '@/pages/WorkerComplianceProfilePage'
import DashboardPage from '@/pages/DashboardPage'
import DriverDetailsPage from '@/pages/DriverDetailsPage'
import DriverLoginPage from '@/pages/DriverLoginPage'
import DriversPage from '@/pages/DriversPage'
import HistoryPage from '@/pages/HistoryPage'
import LandingPage from '@/pages/LandingPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'
import HolidayRequestsPage from '@/pages/HolidayRequestsPage'
import VehicleChecksPage from '@/pages/VehicleChecksPage'
import TimesheetsPage from '@/pages/TimesheetsPage'
import VehicleDetailsPage from '@/pages/VehicleDetailsPage'
import VehiclesPage from '@/pages/VehiclesPage'
import { useAuth } from '@/contexts/AuthContext'

function RequireAuth() {
  const { isAuthenticated, isAuthLoading } = useAuth()

  if (isAuthLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />
  }

  return <MainLayout />
}

function RequireAuthPage({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAuth()

  if (isAuthLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />
  }

  return children
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Navigate to="/admin-login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/admin-login" replace />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/driver-login" element={<DriverLoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAuthPage>
              <AdminDashboardPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuthPage>
              <AdminDashboardPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/drivers"
          element={
            <RequireAuthPage>
              <DriversPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/drivers/:id"
          element={
            <RequireAuthPage>
              <DriverDetailsPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/compliance"
          element={
            <RequireAuthPage>
              <CompliancePage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/compliance/workers/:workerId"
          element={
            <RequireAuthPage>
              <WorkerComplianceProfilePage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/compliance/vehicles/:vehicleId"
          element={
            <RequireAuthPage>
              <VehicleComplianceProfilePage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/vehicles"
          element={
            <RequireAuthPage>
              <VehiclesPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/vehicles/:id"
          element={
            <RequireAuthPage>
              <VehicleDetailsPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/timesheets"
          element={
            <RequireAuthPage>
              <TimesheetsPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAuthPage>
              <SettingsPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/holidays"
          element={
            <RequireAuthPage>
              <HolidayRequestsPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/vehicle-checks"
          element={
            <RequireAuthPage>
              <VehicleChecksPage />
            </RequireAuthPage>
          }
        />
        <Route path="/admin/compliance/licences" element={<Navigate to="/compliance" replace />} />
        <Route path="/admin/compliance/cpc" element={<Navigate to="/compliance" replace />} />
        <Route path="/admin/compliance/tachograph-cards" element={<Navigate to="/compliance" replace />} />
        <Route path="/admin/compliance/documents" element={<Navigate to="/compliance" replace />} />
        <Route
          path="/admin/driver-reports"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage
                title="Driver Reports"
                description="Driver-specific reporting and exports will be available in a future release."
              />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Reports" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/reports/analytics"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Analytics" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/reports/exports"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Exports" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="User Management" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Roles & Permissions" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Notifications" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/integrations"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Integrations" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Billing" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/api-keys"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="API Keys" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Audit Log" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/system-logs"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="System Logs" />
            </RequireAuthPage>
          }
        />
        <Route
          path="/admin/backups"
          element={
            <RequireAuthPage>
              <AdminComingSoonPage title="Backups" />
            </RequireAuthPage>
          }
        />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
