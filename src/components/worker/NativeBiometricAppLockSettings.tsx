import {
  APP_LOCK_TIMEOUT_OPTIONS,
  useAppLock,
  type AppLockTimeoutMs,
} from '@/contexts/AppLockContext'
import type { AppLockAvailabilityStatus } from '@/lib/appLockNative'
import { cn } from '@/lib/utils'
import { Fingerprint, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

function statusLabel(status: AppLockAvailabilityStatus, enabled: boolean): string {
  if (enabled) {
    return 'App lock is on for this device.'
  }
  switch (status) {
    case 'available':
      return 'Require unlock when you return to DREVORA.'
    case 'notEnrolled':
      return 'Set up a screen lock or biometric in your device settings first.'
    case 'noHardware':
      return 'This device does not support biometric unlock.'
    case 'temporarilyUnavailable':
      return 'Biometric unlock is temporarily unavailable.'
    case 'securityUpdateRequired':
      return 'A device security update is required before app lock can be used.'
    case 'disabledForApps':
      return 'Biometric unlock is disabled for apps on this device.'
    case 'unsupported':
      return 'App lock is not supported on this device.'
    default:
      return 'Checking device unlock availability…'
  }
}

/**
 * Native-only Worker Settings controls for biometric app lock.
 * Mount only from native builds (import.meta.env.MODE === 'native').
 */
export function NativeBiometricAppLockSettings() {
  const {
    isEnabled,
    timeoutMs,
    availability,
    isAuthenticating,
    isInitializing,
    enable,
    disable,
    setTimeoutMs,
    refreshAvailability,
  } = useAppLock()

  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    void refreshAvailability()
  }, [refreshAvailability])

  const canEnable = availability === 'available' && !isInitializing
  const controlsDisabled = busy || isAuthenticating || isInitializing

  async function handleToggle(nextEnabled: boolean) {
    if (controlsDisabled) return
    setHint(null)
    setBusy(true)
    try {
      if (nextEnabled) {
        if (!canEnable) {
          setHint(statusLabel(availability, false))
          return
        }
        const result = await enable()
        if (!result.success) {
          if (result.code === 'cancelled') {
            setHint('Enable cancelled. App lock stays off.')
            return
          }
          setHint(statusLabel(availability, false))
        }
        return
      }
      await disable()
    } catch {
      setHint('Unable to update app lock right now.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTimeoutChange(next: AppLockTimeoutMs) {
    if (!isEnabled || controlsDisabled) return
    setBusy(true)
    setHint(null)
    try {
      await setTimeoutMs(next)
    } catch {
      setHint('Unable to update lock timeout.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-[color:var(--worker-border)] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]">
          <Fingerprint className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--worker-text)]">
                Biometric App Lock
              </p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--worker-text-secondary)]">
                {hint ?? statusLabel(availability, isEnabled)}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              aria-label="Biometric App Lock"
              disabled={controlsDisabled || (!isEnabled && !canEnable)}
              onClick={() => void handleToggle(!isEnabled)}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--worker-card)] disabled:opacity-50',
                isEnabled
                  ? 'bg-[color:var(--worker-primary)]'
                  : 'bg-[color:var(--worker-border)]',
              )}
            >
              <span
                className={cn(
                  'inline-block size-5 rounded-full bg-white shadow transition-transform',
                  isEnabled ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>

          {busy || isAuthenticating ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--worker-text-muted)]">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {isAuthenticating ? 'Confirm on your device…' : 'Saving…'}
            </p>
          ) : null}

          {isEnabled ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                Lock after
              </p>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] p-1"
                role="radiogroup"
                aria-label="Lock after"
              >
                {APP_LOCK_TIMEOUT_OPTIONS.map((option) => {
                  const selected = timeoutMs === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={controlsDisabled}
                      onClick={() => void handleTimeoutChange(option.value)}
                      className={cn(
                        'inline-flex h-10 items-center justify-center rounded-xl px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)] disabled:opacity-60',
                        selected
                          ? 'bg-[color:var(--worker-card)] text-[color:var(--worker-text)] shadow-sm'
                          : 'text-[color:var(--worker-text-secondary)] hover:text-[color:var(--worker-text)]',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
