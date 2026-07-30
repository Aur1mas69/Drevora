import {
  addAppStateChangeListener,
  addScreenOffListener,
  authenticate,
  cancelAuthentication,
  clearPreferences,
  getAvailability,
  getPreferences,
  isNativeAppLockSupported,
  setPreferences,
  setSecureScreen,
  type AppLockAuthFailureCode,
  type AppLockAvailabilityStatus,
} from '@/lib/appLockNative'
import { setAppLockSignOutCleanup } from '@/lib/appLockSignOutBridge'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export const APP_LOCK_TIMEOUT_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 30_000, label: '30 seconds' },
  { value: 60_000, label: '1 minute' },
  { value: 300_000, label: '5 minutes' },
] as const

export type AppLockTimeoutMs = (typeof APP_LOCK_TIMEOUT_OPTIONS)[number]['value']

type AppLockContextValue = {
  isInitializing: boolean
  isEnabled: boolean
  isLocked: boolean
  timeoutMs: AppLockTimeoutMs
  availability: AppLockAvailabilityStatus
  isAuthenticating: boolean
  initError: boolean
  unlock: () => Promise<{ success: boolean; code?: AppLockAuthFailureCode }>
  enable: () => Promise<{ success: boolean; code?: AppLockAuthFailureCode }>
  disable: () => Promise<void>
  setTimeoutMs: (timeoutMs: AppLockTimeoutMs) => Promise<void>
  lockNow: () => void
  clearForSignOut: () => Promise<void>
  refreshAvailability: () => Promise<AppLockAvailabilityStatus>
}

const AppLockContext = createContext<AppLockContextValue | null>(null)

const ALLOWED_TIMEOUTS = new Set<number>([0, 30_000, 60_000, 300_000])

function normalizeTimeoutMs(value: number): AppLockTimeoutMs {
  if (ALLOWED_TIMEOUTS.has(value)) {
    return value as AppLockTimeoutMs
  }
  return 60_000
}

async function safeSetSecureScreen(enabled: boolean): Promise<void> {
  try {
    await setSecureScreen({ enabled })
  } catch {
    // Never block lock-state transitions on FLAG_SECURE failures.
  }
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(isNativeAppLockSupported)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLocked, setIsLocked] = useState(isNativeAppLockSupported)
  const [timeoutMs, setTimeoutMsState] = useState<AppLockTimeoutMs>(60_000)
  const [availability, setAvailability] =
    useState<AppLockAvailabilityStatus>('unknown')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [initError, setInitError] = useState(false)

  const isEnabledRef = useRef(false)
  const isLockedRef = useRef(isNativeAppLockSupported)
  const timeoutMsRef = useRef<AppLockTimeoutMs>(60_000)
  const unlockInFlightRef = useRef(false)
  const lastBackgroundAtRef = useRef<number | null>(null)
  const appStateDebounceRef = useRef<number | null>(null)
  const lockGenerationRef = useRef(0)

  const applyLocked = useCallback((locked: boolean) => {
    isLockedRef.current = locked
    setIsLocked(locked)
    if (locked) {
      lockGenerationRef.current += 1
      void safeSetSecureScreen(true)
    } else {
      void safeSetSecureScreen(false)
    }
  }, [])

  const lockNow = useCallback(() => {
    if (!isEnabledRef.current) return
    if (isLockedRef.current) {
      void safeSetSecureScreen(true)
      return
    }
    applyLocked(true)
  }, [applyLocked])

  const refreshAvailability = useCallback(async () => {
    try {
      const result = await getAvailability({ allowDeviceCredential: true })
      setAvailability(result.status)
      return result.status
    } catch {
      setAvailability('unknown')
      return 'unknown' as AppLockAvailabilityStatus
    }
  }, [])

  const clearForSignOut = useCallback(async () => {
    try {
      await cancelAuthentication()
    } catch {
      // ignore
    }
    try {
      await clearPreferences()
    } catch {
      // ignore
    }
    isEnabledRef.current = false
    timeoutMsRef.current = 60_000
    lastBackgroundAtRef.current = null
    unlockInFlightRef.current = false
    setIsEnabled(false)
    setTimeoutMsState(60_000)
    setIsAuthenticating(false)
    setAvailability('unknown')
    setInitError(false)
    applyLocked(false)
    setIsInitializing(false)
  }, [applyLocked])

  useEffect(() => {
    setAppLockSignOutCleanup(() => clearForSignOut())
    return () => setAppLockSignOutCleanup(null)
  }, [clearForSignOut])

  useEffect(() => {
    if (!isNativeAppLockSupported) {
      setIsInitializing(false)
      setIsEnabled(false)
      applyLocked(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const prefs = await getPreferences()
        if (cancelled) return
        const enabled = Boolean(prefs.enabled)
        const nextTimeout = normalizeTimeoutMs(prefs.timeoutMs)
        isEnabledRef.current = enabled
        timeoutMsRef.current = nextTimeout
        setIsEnabled(enabled)
        setTimeoutMsState(nextTimeout)
        applyLocked(enabled)
        await refreshAvailability()
        setInitError(false)
      } catch {
        if (cancelled) return
        setInitError(true)
        isEnabledRef.current = true
        setIsEnabled(true)
        applyLocked(true)
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [applyLocked, refreshAvailability])

  useEffect(() => {
    if (!isNativeAppLockSupported) return

    let appStateHandle: { remove: () => Promise<void> } | null = null
    let screenOffHandle: { remove: () => Promise<void> } | null = null
    let removed = false

    void (async () => {
      appStateHandle = await addAppStateChangeListener((isActive) => {
        if (removed) return
        if (appStateDebounceRef.current != null) {
          window.clearTimeout(appStateDebounceRef.current)
        }
        appStateDebounceRef.current = window.setTimeout(() => {
          if (!isEnabledRef.current) {
            if (isActive) lastBackgroundAtRef.current = null
            return
          }

          if (!isActive) {
            lastBackgroundAtRef.current = Date.now()
            if (timeoutMsRef.current === 0) {
              lockNow()
            }
            return
          }

          const backgroundedAt = lastBackgroundAtRef.current
          lastBackgroundAtRef.current = null
          if (backgroundedAt == null) {
            return
          }
          const elapsed = Date.now() - backgroundedAt
          if (elapsed >= timeoutMsRef.current) {
            lockNow()
          }
        }, 50)
      })

      screenOffHandle = await addScreenOffListener(() => {
        if (removed) return
        if (isEnabledRef.current) {
          lockNow()
        }
      })
    })()

    return () => {
      removed = true
      if (appStateDebounceRef.current != null) {
        window.clearTimeout(appStateDebounceRef.current)
        appStateDebounceRef.current = null
      }
      void appStateHandle?.remove()
      void screenOffHandle?.remove()
      void cancelAuthentication()
    }
  }, [lockNow])

  const unlock = useCallback(async () => {
    if (!isEnabledRef.current) {
      applyLocked(false)
      return { success: true as const }
    }
    if (unlockInFlightRef.current || isAuthenticating) {
      return { success: false as const, code: 'promptAlreadyActive' as const }
    }

    unlockInFlightRef.current = true
    setIsAuthenticating(true)
    const generation = lockGenerationRef.current

    try {
      const result = await authenticate({
        title: 'Unlock DREVORA',
        subtitle: 'Confirm it is you to continue',
        allowDeviceCredential: true,
      })

      if (generation !== lockGenerationRef.current) {
        return { success: false as const, code: 'cancelled' as const }
      }

      if (result.success) {
        applyLocked(false)
        return { success: true as const }
      }

      applyLocked(true)
      return { success: false as const, code: result.code }
    } catch {
      applyLocked(true)
      return { success: false as const, code: 'unknown' as const }
    } finally {
      unlockInFlightRef.current = false
      setIsAuthenticating(false)
    }
  }, [applyLocked, isAuthenticating])

  const enable = useCallback(async () => {
    const status = await refreshAvailability()
    if (status !== 'available') {
      return { success: false as const, code: 'notAvailable' as const }
    }

    if (unlockInFlightRef.current || isAuthenticating) {
      return { success: false as const, code: 'promptAlreadyActive' as const }
    }

    unlockInFlightRef.current = true
    setIsAuthenticating(true)
    try {
      const result = await authenticate({
        title: 'Enable App Lock',
        subtitle: 'Confirm it is you to turn on app lock',
        allowDeviceCredential: true,
      })
      if (!result.success) {
        return { success: false as const, code: result.code }
      }

      const persisted = await setPreferences({
        enabled: true,
        timeoutMs: timeoutMsRef.current,
      })
      isEnabledRef.current = true
      timeoutMsRef.current = normalizeTimeoutMs(persisted.timeoutMs)
      setIsEnabled(true)
      setTimeoutMsState(timeoutMsRef.current)
      applyLocked(false)
      return { success: true as const }
    } catch {
      return { success: false as const, code: 'unknown' as const }
    } finally {
      unlockInFlightRef.current = false
      setIsAuthenticating(false)
    }
  }, [applyLocked, isAuthenticating, refreshAvailability])

  const disable = useCallback(async () => {
    try {
      await cancelAuthentication()
    } catch {
      // ignore
    }
    const persisted = await setPreferences({
      enabled: false,
      timeoutMs: timeoutMsRef.current,
    })
    isEnabledRef.current = false
    timeoutMsRef.current = normalizeTimeoutMs(persisted.timeoutMs)
    setIsEnabled(false)
    setTimeoutMsState(timeoutMsRef.current)
    setIsAuthenticating(false)
    applyLocked(false)
  }, [applyLocked])

  const setTimeoutMs = useCallback(
    async (nextTimeout: AppLockTimeoutMs) => {
      const normalized = normalizeTimeoutMs(nextTimeout)
      const persisted = await setPreferences({
        enabled: isEnabledRef.current,
        timeoutMs: normalized,
      })
      timeoutMsRef.current = normalizeTimeoutMs(persisted.timeoutMs)
      setTimeoutMsState(timeoutMsRef.current)
    },
    [],
  )

  const value = useMemo<AppLockContextValue>(
    () => ({
      isInitializing,
      isEnabled,
      isLocked,
      timeoutMs,
      availability,
      isAuthenticating,
      initError,
      unlock,
      enable,
      disable,
      setTimeoutMs,
      lockNow,
      clearForSignOut,
      refreshAvailability,
    }),
    [
      availability,
      clearForSignOut,
      disable,
      enable,
      initError,
      isAuthenticating,
      isEnabled,
      isInitializing,
      isLocked,
      lockNow,
      refreshAvailability,
      setTimeoutMs,
      timeoutMs,
      unlock,
    ],
  )

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
}

export function useAppLock(): AppLockContextValue {
  const context = useContext(AppLockContext)
  if (!context) {
    throw new Error('useAppLock must be used within AppLockProvider')
  }
  return context
}
