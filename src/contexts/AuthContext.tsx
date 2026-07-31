import {
  clearStoredAuthPortal,
  readStoredAuthPortal,
  writeStoredAuthPortal,
  type AuthPortal,
} from '@/lib/authPortal'
import { clearGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import { runAppLockSignOutCleanup } from '@/lib/appLockSignOutBridge'
import { clearNativeOfflineMembershipSnapshot } from '@/lib/nativeOfflineMembership'
import { clearWorkerOfflineBootstrap } from '@/lib/workerOfflineBootstrap'
import { clearCompanyMembershipCache } from '@/services/companyMembershipService'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authService, type AuthSession } from '@/services/authService'

type AuthContextValue = {
  isAuthenticated: boolean
  isAuthLoading: boolean
  session: AuthSession | null
  portal: AuthPortal | null
  setAuthenticatedSession: (session: AuthSession, portal: AuthPortal) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [portal, setPortal] = useState<AuthPortal | null>(() => readStoredAuthPortal())
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    async function restoreSession() {
      try {
        const existingSession = await authService.getCurrentSession()
        if (!isCancelled && existingSession) {
          setSession(existingSession)
          setPortal(readStoredAuthPortal())
        }
      } catch {
        // Session restore must not block public routes from rendering.
        // Keep isAuthLoading true until finally so Login is not flashed mid-recovery.
      } finally {
        if (!isCancelled) {
          setIsAuthLoading(false)
        }
      }
    }

    void restoreSession()

    return () => {
      isCancelled = true
    }
  }, [])

  const setAuthenticatedSession = useCallback(
    (nextSession: AuthSession, nextPortal: AuthPortal) => {
      setSession(nextSession)
      setPortal(nextPortal)
      writeStoredAuthPortal(nextPortal)
    },
    [],
  )

  const signOut = useCallback(async () => {
    // Best-effort local app-lock cleanup (native). Never blocks Supabase sign-out.
    await runAppLockSignOutCleanup()
    await clearNativeOfflineMembershipSnapshot()
    await clearWorkerOfflineBootstrap()
    await authService.signOut()
    setSession(null)
    setPortal(null)
    clearStoredAuthPortal()
    clearCompanyMembershipCache()
    clearGlobalCompanySettings()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      isAuthLoading,
      session,
      portal,
      setAuthenticatedSession,
      signOut,
    }),
    [isAuthLoading, portal, session, setAuthenticatedSession, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
