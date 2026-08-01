import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { RequireWorkerLegalAcceptance } from '@/components/legal/RequireWorkerLegalAcceptance'
import { AppLockGate } from '@/components/auth/AppLockGate'
import {
  MembershipAccessBlocked,
  MembershipLoadingScreen,
  useMembershipAccessState,
} from '@/components/auth/MembershipAccessGate'
import { NativeWorkerAccessBlocked } from '@/components/auth/NativeWorkerAccessBlocked'
import { WORKER_ACCOUNT_ARCHIVED_MESSAGE } from '@/hooks/useCurrentWorker'
import { getWorkerAccessStatus } from '@/services/driversService'
import { LOGIN_PATH, WORKER_HOME_PATH } from '@/lib/membershipRoles'

const MainLayout = lazy(() => import('@/layouts/MainLayout'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const LoginTwilightPreviewPage = lazy(
  () => import('@/pages/LoginTwilightPreviewPage'),
)
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
const WorkerTyreCheckPage = lazy(
  () => import('@/pages/worker/WorkerTyreCheckPage'),
)
const WorkerConsumablesPage = lazy(
  () => import('@/pages/worker/WorkerConsumablesPage'),
)
const WorkerDriverReportsPage = lazy(
  () => import('@/pages/worker/WorkerDriverReportsPage'),
)
const WorkerDocumentsPage = lazy(
  () => import('@/pages/worker/WorkerDocumentsPage'),
)
const WorkerContactsPage = lazy(
  () => import('@/pages/worker/WorkerContactsPage'),
)
const WorkerSettingsPage = lazy(
  () => import('@/pages/worker/WorkerSettingsPage'),
)
const WorkerTimesheetSettingsPage = lazy(
  () => import('@/pages/worker/WorkerTimesheetSettingsPage'),
)
const WorkerSecuritySettingsPage = lazy(
  () => import('@/pages/worker/WorkerSecuritySettingsPage'),
)
const WorkerSettingsContactOfficePage = lazy(
  () => import('@/pages/worker/WorkerSettingsContactOfficePage'),
)
const WorkerSettingsHelpPage = lazy(
  () => import('@/pages/worker/WorkerSettingsHelpPage'),
)
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'))
const WorkerTermsPage = lazy(() => import('@/pages/WorkerTermsPage'))
const WorkerCompanyPrivacyNoticePage = lazy(
  () => import('@/pages/worker/WorkerCompanyPrivacyNoticePage'),
)
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function RouteLoadingFallback() {
  return <MembershipLoadingScreen />
}

/** Preserve plan query + auth hash when sending `/` to `/login`. */
function RootToLoginRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={`/login${location.search}${location.hash}`}
      replace
    />
  )
}

/**
 * Worker shell for the Capacitor app: Driver membership only.
 * Office / unlinked accounts see NativeWorkerAccessBlocked — never Admin routes.
 */
function RequireWorkerAccess() {
  const access = useMembershipAccessState()
  const [workerLifecycle, setWorkerLifecycle] = useState<
    'loading' | 'active' | 'archived' | 'none'
  >('loading')

  useEffect(() => {
    if (access.status !== 'worker') {
      setWorkerLifecycle('loading')
      return
    }

    let cancelled = false
    setWorkerLifecycle('loading')

    void getWorkerAccessStatus()
      .then((status) => {
        if (!cancelled) setWorkerLifecycle(status)
      })
      .catch(() => {
        if (!cancelled) setWorkerLifecycle('none')
      })

    return () => {
      cancelled = true
    }
  }, [access.status])

  if (access.status === 'loading') {
    return <MembershipLoadingScreen />
  }

  if (access.status === 'unauthenticated') {
    return <Navigate to={LOGIN_PATH} replace />
  }

  if (
    access.status === 'office' ||
    access.status === 'unlinked'
  ) {
    return <NativeWorkerAccessBlocked />
  }

  if (access.status === 'blocked') {
    return <MembershipAccessBlocked message={access.message} />
  }

  if (workerLifecycle === 'loading') {
    return <MembershipLoadingScreen />
  }

  if (workerLifecycle === 'archived') {
    return (
      <MembershipAccessBlocked message={WORKER_ACCOUNT_ARCHIVED_MESSAGE} />
    )
  }

  return (
    <AppLockGate>
      <RequireWorkerLegalAcceptance>
        <MainLayout />
      </RequireWorkerLegalAcceptance>
    </AppLockGate>
  )
}

/**
 * Worker-only router for Capacitor native builds.
 * Must not import AppRouter, AdminLayout, or Office page modules.
 */
function WorkerAppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<RootToLoginRedirect />} />
          <Route path={LOGIN_PATH} element={<LoginTwilightPreviewPage />} />
          <Route path="/worker-login" element={<Navigate to={LOGIN_PATH} replace />} />
          <Route path="/driver-login" element={<Navigate to={LOGIN_PATH} replace />} />

          {/* Login may redirect Office → /admin; unlinked → /onboarding. Catch without Admin/onboarding modules. */}
          <Route path="/admin" element={<NativeWorkerAccessBlocked />} />
          <Route path="/admin/*" element={<NativeWorkerAccessBlocked />} />
          <Route path="/onboarding" element={<NativeWorkerAccessBlocked />} />

          <Route element={<RequireWorkerAccess />}>
            <Route path={WORKER_HOME_PATH} element={<DashboardPage />} />
            <Route path="/worker/timesheets" element={<WorkerTimesheetsPage />} />
            <Route path="/worker/holidays" element={<MyHolidaysPage />} />
            <Route
              path="/my-holidays"
              element={<Navigate to="/worker/holidays" replace />}
            />
            <Route path="/worker/vehicles" element={<WorkerVehiclesPage />} />
            <Route
              path="/worker/vehicle-checks"
              element={<WorkerVehicleChecksPage />}
            />
            <Route
              path="/worker/tyre-checks/new"
              element={<WorkerTyreCheckPage />}
            />
            <Route path="/worker/consumables" element={<WorkerConsumablesPage />} />
            <Route
              path="/worker/driver-reports"
              element={<WorkerDriverReportsPage />}
            />
            <Route path="/worker/documents" element={<WorkerDocumentsPage />} />
            <Route path="/worker/contacts" element={<WorkerContactsPage />} />
            <Route path="/worker/settings" element={<WorkerSettingsPage />} />
            <Route
              path="/worker/settings/timesheet"
              element={<WorkerTimesheetSettingsPage />}
            />
            <Route
              path="/worker/settings/security"
              element={<WorkerSecuritySettingsPage />}
            />
            <Route
              path="/worker/settings/contact-office"
              element={<WorkerSettingsContactOfficePage />}
            />
            <Route
              path="/worker/settings/help"
              element={<WorkerSettingsHelpPage />}
            />
            <Route
              path="/worker/settings/help/legal/worker-terms"
              element={<WorkerTermsPage />}
            />
            <Route
              path="/worker/settings/help/legal/privacy"
              element={<PrivacyPage />}
            />
            <Route
              path="/worker/settings/help/legal/company-privacy-notice"
              element={<WorkerCompanyPrivacyNoticePage />}
            />
            <Route path="/history" element={<Navigate to={WORKER_HOME_PATH} replace />} />
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

export default WorkerAppRouter
