import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import { Button } from '@/components/ui/button'
import { useAppLock } from '@/contexts/AppLockContext'
import { useAuth } from '@/contexts/AuthContext'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import type { AppLockAvailabilityStatus } from '@/lib/appLockNative'
import { Loader2, LockKeyhole } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import drevoraLogoFull from '@/assets/drevora-logo-full.png'

function availabilityGuidance(status: AppLockAvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'Use your fingerprint, face, or device screen lock to continue.'
    case 'notEnrolled':
      return 'Set up a screen lock or biometric in your device settings, then try again.'
    case 'noHardware':
      return 'This device does not support biometric unlock.'
    case 'temporarilyUnavailable':
      return 'Unlock is temporarily unavailable. Try again in a moment.'
    case 'securityUpdateRequired':
      return 'Unlock is unavailable right now. Use Sign out if you need to leave.'
    case 'disabledForApps':
      return 'Biometric unlock is disabled for apps on this device.'
    case 'unsupported':
      return 'App lock is not supported on this device.'
    default:
      return 'Unlock is unavailable. You can sign out and sign in again.'
  }
}

/**
 * Opaque gate before MainLayout / Worker pages. Never mounts children while locked.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const {
    isInitializing,
    isEnabled,
    isLocked,
    isAuthenticating,
    availability,
    initError,
    unlock,
    clearForSignOut,
    refreshAvailability,
  } = useAppLock()

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (isEnabled && isLocked) {
      void refreshAvailability()
    }
  }, [isEnabled, isLocked, refreshAvailability])

  async function handleUnlock() {
    setStatusMessage(null)
    const result = await unlock()
    if (!result.success) {
      if (result.code === 'cancelled') {
        setStatusMessage('Unlock cancelled. DREVORA stays locked.')
        return
      }
      if (result.code === 'lockedOut' || result.code === 'permanentlyLockedOut') {
        setStatusMessage('Too many attempts. Try again later, or sign out.')
        return
      }
      if (result.code === 'promptAlreadyActive') {
        return
      }
      setStatusMessage(availabilityGuidance(availability))
    }
  }

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await clearForSignOut()
      await signOut()
      navigate(LOGIN_PATH, { replace: true })
    } catch {
      try {
        await signOut()
      } catch {
        // ignore
      }
      navigate(LOGIN_PATH, { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  if (isInitializing) {
    return <AuthSplashScreen />
  }

  if (initError) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-dvh w-full flex-col items-center justify-center bg-[#F7FAFF] px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <img
          src={drevoraLogoFull}
          alt="DREVORA"
          className="h-auto w-[220px] object-contain"
          draggable={false}
        />
        <p className="mt-8 text-center text-lg font-semibold text-slate-900">
          DREVORA is locked
        </p>
        <p className="mt-2 max-w-sm text-center text-sm text-slate-600">
          App lock could not be verified on this device. Sign out to continue safely.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-8 h-12 w-full max-w-xs rounded-2xl"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign out
        </Button>
      </div>
    )
  }

  if (!isEnabled || !isLocked) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-[100] flex min-h-dvh w-full flex-col items-center justify-center bg-[#F7FAFF] px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <img
        src={drevoraLogoFull}
        alt="DREVORA"
        className="h-auto w-[220px] object-contain"
        draggable={false}
      />

      <div className="mt-8 flex size-14 items-center justify-center rounded-full bg-[#E8F1FF] text-[#2563EB]">
        <LockKeyhole className="size-7" strokeWidth={1.75} aria-hidden />
      </div>

      <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-slate-900">
        DREVORA is locked
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-slate-600">
        Unlock to open your workspace. Your account stays signed in.
      </p>
      <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-slate-500">
        {statusMessage ?? availabilityGuidance(availability)}
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button
          type="button"
          className="h-12 w-full rounded-2xl bg-[#2563EB] text-base font-semibold text-white hover:bg-[#1d4ed8]"
          disabled={isAuthenticating || isSigningOut || availability === 'noHardware'}
          onClick={() => void handleUnlock()}
        >
          {isAuthenticating ? <Loader2 className="size-4 animate-spin" /> : null}
          Unlock
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-2xl"
          disabled={isSigningOut || isAuthenticating}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign out
        </Button>
      </div>
    </div>
  )
}
