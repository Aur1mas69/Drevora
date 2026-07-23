import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import { useAuthSplashVisible } from '@/hooks/useAuthSplashVisible'
import type { ReactNode } from 'react'

/**
 * Wraps login routes so the login form never paints while session/membership
 * are still resolving (or while redirecting an already-authenticated user).
 */
export function AuthBootstrapGate({ children }: { children: ReactNode }) {
  const showSplash = useAuthSplashVisible()

  if (showSplash) {
    return <AuthSplashScreen />
  }

  return <>{children}</>
}
