/**
 * Web/PWA app-lock bridge — no Capacitor plugin, no native APIs, no persistence.
 */

export type AppLockAvailabilityStatus =
  | 'available'
  | 'noHardware'
  | 'notEnrolled'
  | 'temporarilyUnavailable'
  | 'securityUpdateRequired'
  | 'unsupported'
  | 'disabledForApps'
  | 'unknown'

export type AppLockAuthFailureCode =
  | 'cancelled'
  | 'failed'
  | 'lockedOut'
  | 'permanentlyLockedOut'
  | 'notAvailable'
  | 'activityUnavailable'
  | 'promptAlreadyActive'
  | 'unknown'

export type AppLockPreferences = {
  enabled: boolean
  timeoutMs: number
}

export type AppLockAvailability = {
  status: AppLockAvailabilityStatus
}

export type AppLockAuthenticateResult =
  | { success: true }
  | { success: false; code: AppLockAuthFailureCode }

export type AppLockScreenOffHandle = {
  remove: () => Promise<void>
}

/** Web builds never expose native biometric app lock. */
export const isNativeAppLockSupported = false

export async function getAvailability(
  _options?: { allowDeviceCredential?: boolean },
): Promise<AppLockAvailability> {
  return { status: 'unsupported' }
}

export async function authenticate(_options?: {
  title?: string
  subtitle?: string
  allowDeviceCredential?: boolean
}): Promise<AppLockAuthenticateResult> {
  return { success: false, code: 'notAvailable' }
}

export async function cancelAuthentication(): Promise<void> {
  // no-op
}

export async function getPreferences(): Promise<AppLockPreferences> {
  return { enabled: false, timeoutMs: 60_000 }
}

export async function setPreferences(
  _preferences: AppLockPreferences,
): Promise<AppLockPreferences> {
  return { enabled: false, timeoutMs: 60_000 }
}

export async function clearPreferences(): Promise<void> {
  // no-op
}

export async function setSecureScreen(_options: { enabled: boolean }): Promise<void> {
  // no-op
}

export async function addScreenOffListener(
  _listener: () => void,
): Promise<AppLockScreenOffHandle> {
  return {
    async remove() {
      // no-op
    },
  }
}

export async function addAppStateChangeListener(
  _listener: (isActive: boolean) => void,
): Promise<AppLockScreenOffHandle> {
  return {
    async remove() {
      // no-op
    },
  }
}
