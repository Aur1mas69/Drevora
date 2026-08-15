import {
  APP_LOCK_TIMEOUT_OPTIONS,
  useAppLock,
  type AppLockTimeoutMs,
} from '@/contexts/AppLockContext'
import type { AppLockAvailabilityStatus } from '@/lib/appLockNative'
import { cn } from '@/lib/utils'
import { Fingerprint, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function statusLabel(
  status: AppLockAvailabilityStatus,
  enabled: boolean,
  t: (key: string, options?: { defaultValue: string }) => string,
): string {
  if (enabled) {
    return t('security.appLockOn', { defaultValue: 'App lock is on for this device.' })
  }
  switch (status) {
    case 'available':
      return t('security.appLockHint', {
        defaultValue: 'Require unlock when you return to DREVORA.',
      })
    case 'notEnrolled':
      return t('security.notEnrolled', {
        defaultValue: 'Set up a screen lock or biometric in your device settings first.',
      })
    case 'noHardware':
      return t('security.noHardware', {
        defaultValue: 'This device does not support biometric unlock.',
      })
    case 'temporarilyUnavailable':
      return t('security.temporarilyUnavailable', {
        defaultValue: 'Biometric unlock is temporarily unavailable.',
      })
    case 'securityUpdateRequired':
      return t('security.securityUpdateRequired', {
        defaultValue:
          'A device security update is required before app lock can be used.',
      })
    case 'disabledForApps':
      return t('security.disabledForApps', {
        defaultValue: 'Biometric unlock is disabled for apps on this device.',
      })
    case 'unsupported':
      return t('security.unsupported', {
        defaultValue: 'App lock is not supported on this device.',
      })
    default:
      return t('security.checking', {
        defaultValue: 'Checking device unlock availability…',
      })
  }
}

/**
 * Native-only Worker Settings controls for biometric app lock.
 * Mount only from native builds (import.meta.env.MODE === 'native').
 */
export function NativeBiometricAppLockSettings() {
  const { t } = useTranslation('worker')
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
          setHint(statusLabel(availability, false, t))
          return
        }
        const result = await enable()
        if (!result.success) {
          if (result.code === 'cancelled') {
            setHint(
              t('security.enableCancelled', {
                defaultValue: 'Enable cancelled. App lock stays off.',
              }),
            )
            return
          }
          setHint(statusLabel(availability, false, t))
        }
        return
      }
      await disable()
    } catch {
      setHint(
        t('security.updateLockFailed', {
          defaultValue: 'Unable to update app lock right now.',
        }),
      )
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
      setHint(
        t('security.updateTimeoutFailed', {
          defaultValue: 'Unable to update lock timeout.',
        }),
      )
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
                {t('security.biometricAria', { defaultValue: 'Biometric App Lock' })}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--worker-text-secondary)]">
                {hint ?? statusLabel(availability, isEnabled, t)}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              aria-label={t('security.biometricAria', {
                defaultValue: 'Biometric App Lock',
              })}
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
              {isAuthenticating
                ? t('security.confirmDevice', {
                    defaultValue: 'Confirm on your device…',
                  })
                : t('security.saving', { defaultValue: 'Saving…' })}
            </p>
          ) : null}

          {isEnabled ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                {t('security.lockAfter', { defaultValue: 'Lock after' })}
              </p>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] p-1"
                role="radiogroup"
                aria-label={t('security.lockAfter', { defaultValue: 'Lock after' })}
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
                      {option.value === 0
                        ? t('security.immediately', { defaultValue: 'Immediately' })
                        : option.value === 30_000
                          ? t('security.seconds30', { defaultValue: '30 seconds' })
                          : option.value === 60_000
                            ? t('security.minute1', { defaultValue: '1 minute' })
                            : t('security.minutes5', { defaultValue: '5 minutes' })}
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
