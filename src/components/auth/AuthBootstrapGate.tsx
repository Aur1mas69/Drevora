import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import {
  MembershipAccessBlocked,
  useMembershipAccessState,
} from '@/components/auth/MembershipAccessGate'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthSplashVisible } from '@/hooks/useAuthSplashVisible'
import type { ReactNode } from 'react'

/**
 * Wraps login routes so the login form never paints while session/membership
 * are still resolving (or while redirecting an already-authenticated user).
 *
 * If a local session restored (SecureAuthStorage / localStorage) but membership
 * is still settling / blocked, keep splash (or blocked UI) — never flash Login.
 */
export function AuthBootstrapGate({ children }: { children: ReactNode }) {
  const showSplash = useAuthSplashVisible()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const access = useMembershipAccessState()

  if (showSplash || isAuthLoading) {
    return <AuthSplashScreen />
  }

  if (isAuthenticated) {
    if (access.status === 'blocked') {
      return <MembershipAccessBlocked message={access.message} />
    }
    // Authenticated Worker/Office/unlinked: redirect effect owns navigation.
    return <AuthSplashScreen />
  }

  return <>{children}</>
}
