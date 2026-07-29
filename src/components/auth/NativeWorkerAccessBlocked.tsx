import {
  MembershipAccessBlocked,
  MembershipLoadingScreen,
  useMembershipAccessState,
} from '@/components/auth/MembershipAccessGate'
import { LOGIN_PATH, WORKER_HOME_PATH } from '@/lib/membershipRoles'
import { Navigate } from 'react-router-dom'

const NATIVE_WORKER_ONLY_MESSAGE =
  'DREVORA mobile is available only to Worker accounts. Sign out and use the web app for Office access.'

/**
 * Native (Capacitor) gate for Office / unlinked / unsupported accounts.
 * Does not import Admin layout, onboarding, or Office pages.
 */
export function NativeWorkerAccessBlocked() {
  const access = useMembershipAccessState()

  if (access.status === 'loading') {
    return <MembershipLoadingScreen />
  }

  if (access.status === 'unauthenticated') {
    return <Navigate to={LOGIN_PATH} replace />
  }

  if (access.status === 'worker') {
    return <Navigate to={WORKER_HOME_PATH} replace />
  }

  return <MembershipAccessBlocked message={NATIVE_WORKER_ONLY_MESSAGE} />
}
