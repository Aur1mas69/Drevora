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
import ContactsPage from '@/pages/ContactsPage'
import DocumentsPage from '@/pages/DocumentsPage'
import DriverReportsPage from '@/pages/DriverReportsPage'
import ConsumablesPage from '@/pages/ConsumablesPage'
import VehicleComplianceProfilePage from '@/pages/VehicleComplianceProfilePage'
import WorkerComplianceProfilePage from '@/pages/WorkerComplianceProfilePage'
import DashboardPage from '@/pages/DashboardPage'
import DriverDetailsPage from '@/pages/DriverDetailsPage'
import DriverLoginPage from '@/pages/DriverLoginPage'
import WorkerLoginPage from '@/pages/WorkerLoginPage'
import DriversPage from '@/pages/DriversPage'
import HistoryPage from '@/pages/HistoryPage'
import MyHolidaysPage from '@/pages/MyHolidaysPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProfilePage from '@/pages/ProfilePage'
import FaqHelpPage from '@/pages/FaqHelpPage'
import SettingsPage from '@/pages/SettingsPage'
import HolidayRequestsPage from '@/pages/HolidayRequestsPage'
import VehicleChecksPage from '@/pages/VehicleChecksPage'
import TimesheetsPage from '@/pages/TimesheetsPage'
import VehicleDetailsPage from '@/pages/VehicleDetailsPage'
import VehiclesPage from '@/pages/VehiclesPage'
import { useAuth } from '@/contexts/AuthContext'

function RequireWorkerAuth() {
  const { isAuthenticated, isAuthLoading, portal } = useAuth()

  if (isAuthLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/driver-login" replace />
  }

  if (portal === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <MainLayout />
}

function RequireAuthPage({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading, portal } = useAuth()

  if (isAuthLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />
  }

  if (portal === 'worker') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        <Route path="/driver-login" element={<DriverLoginPage />} />
        <Route path="/worker-login" element={<WorkerLoginPage />} />
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
          path="/documents"
          element={
            <RequireAuthPage>
              <DocumentsPage />
            </RequireAuthPage>
          }
        />
        <Route path="/compliance" element={<Navigate to="/documents" replace />} />
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
          path="/contacts"
          element={
            <RequireAuthPage>
              <ContactsPage />
            </RequireAuthPage>
          }
        />
        <Route
          path="/consumables"
          element={
            <RequireAuthPage>
              <ConsumablesPage />
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
          path="/admin/faq"
          element={
            <RequireAuthPage>
              <FaqHelpPage />
            </RequireAuthPage>
          }
        />
        <Route path="/admin/help" element={<Navigate to="/admin/faq" replace />} />
        <Route path="/help" element={<Navigate to="/admin/faq" replace />} />
        <Route path="/faq" element={<Navigate to="/admin/faq" replace />} />
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
        <Route path="/admin/compliance/licences" element={<Navigate to="/documents" replace />} />
        <Route path="/admin/compliance/cpc" element={<Navigate to="/documents" replace />} />
        <Route path="/admin/compliance/tachograph-cards" element={<Navigate to="/documents" replace />} />
        <Route path="/admin/compliance/documents" element={<Navigate to="/documents" replace />} />
        <Route
          path="/admin/driver-reports"
          element={
            <RequireAuthPage>
              <DriverReportsPage />
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
        <Route element={<RequireWorkerAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/worker/holidays" element={<MyHolidaysPage />} />
          <Route path="/my-holidays" element={<Navigate to="/worker/holidays" replace />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
