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
  setAuthenticatedSession: (session: AuthSession) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    async function restoreSession() {
      try {
        const existingSession = await authService.getCurrentSession()
        if (!isCancelled && existingSession) {
          setSession(existingSession)
        }
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

  const setAuthenticatedSession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession)
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      isAuthLoading,
      session,
      setAuthenticatedSession,
      signOut,
    }),
    [isAuthLoading, session, setAuthenticatedSession, signOut],
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
