import { App } from '@capacitor/app'
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * Native Capacitor app-lock bridge — AppLockBiometric Android plugin.
 * No plaintext / localStorage fallback.
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

type AppLockBiometricPlugin = {
  getAvailability: (options: {
    allowDeviceCredential: boolean
  }) => Promise<{ status: AppLockAvailabilityStatus }>
  authenticate: (options: {
    title: string
    subtitle?: string
    allowDeviceCredential: boolean
  }) => Promise<{ success: true }>
  cancelAuthentication: () => Promise<void>
  getPreferences: () => Promise<{ enabled: boolean; timeoutMs: number }>
  setPreferences: (options: {
    enabled: boolean
    timeoutMs: number
  }) => Promise<{ enabled: boolean; timeoutMs: number }>
  clearPreferences: () => Promise<void>
  setSecureScreen: (options: { enabled: boolean }) => Promise<void>
  addListener: (
    eventName: 'screenOff',
    listenerFunc: () => void,
  ) => Promise<PluginListenerHandle>
}

const AppLockBiometric = registerPlugin<AppLockBiometricPlugin>('AppLockBiometric')

const AUTH_FAILURE_CODES: ReadonlySet<string> = new Set([
  'cancelled',
  'failed',
  'lockedOut',
  'permanentlyLockedOut',
  'notAvailable',
  'activityUnavailable',
  'promptAlreadyActive',
  'unknown',
])

function asAuthFailureCode(value: unknown): AppLockAuthFailureCode {
  if (typeof value === 'string' && AUTH_FAILURE_CODES.has(value)) {
    return value as AppLockAuthFailureCode
  }
  return 'unknown'
}

function normalizeTimeoutMs(timeoutMs: number): number {
  if (
    timeoutMs === 0 ||
    timeoutMs === 30_000 ||
    timeoutMs === 60_000 ||
    timeoutMs === 300_000
  ) {
    return timeoutMs
  }
  return 60_000
}

/** Native Android builds expose the first-party app-lock plugin. */
export const isNativeAppLockSupported = true

export async function getAvailability(options?: {
  allowDeviceCredential?: boolean
}): Promise<AppLockAvailability> {
  const result = await AppLockBiometric.getAvailability({
    allowDeviceCredential: options?.allowDeviceCredential ?? true,
  })
  return { status: result.status }
}

export async function authenticate(options?: {
  title?: string
  subtitle?: string
  allowDeviceCredential?: boolean
}): Promise<AppLockAuthenticateResult> {
  try {
    await AppLockBiometric.authenticate({
      title: options?.title?.trim() || 'Unlock DREVORA',
      subtitle: options?.subtitle,
      allowDeviceCredential: options?.allowDeviceCredential ?? true,
    })
    return { success: true }
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? asAuthFailureCode((error as { code?: unknown }).code)
        : 'unknown'
    return { success: false, code }
  }
}

export async function cancelAuthentication(): Promise<void> {
  await AppLockBiometric.cancelAuthentication()
}

export async function getPreferences(): Promise<AppLockPreferences> {
  const result = await AppLockBiometric.getPreferences()
  return {
    enabled: Boolean(result.enabled),
    timeoutMs: normalizeTimeoutMs(Number(result.timeoutMs)),
  }
}

export async function setPreferences(
  preferences: AppLockPreferences,
): Promise<AppLockPreferences> {
  const result = await AppLockBiometric.setPreferences({
    enabled: Boolean(preferences.enabled),
    timeoutMs: normalizeTimeoutMs(preferences.timeoutMs),
  })
  return {
    enabled: Boolean(result.enabled),
    timeoutMs: normalizeTimeoutMs(Number(result.timeoutMs)),
  }
}

export async function clearPreferences(): Promise<void> {
  await AppLockBiometric.clearPreferences()
}

export async function setSecureScreen(options: { enabled: boolean }): Promise<void> {
  await AppLockBiometric.setSecureScreen({ enabled: Boolean(options.enabled) })
}

export async function addScreenOffListener(
  listener: () => void,
): Promise<AppLockScreenOffHandle> {
  const handle = await AppLockBiometric.addListener('screenOff', listener)
  return {
    async remove() {
      await handle.remove()
    },
  }
}

export async function addAppStateChangeListener(
  listener: (isActive: boolean) => void,
): Promise<AppLockScreenOffHandle> {
  const handle = await App.addListener('appStateChange', (state) => {
    listener(Boolean(state.isActive))
  })
  return {
    async remove() {
      await handle.remove()
    },
  }
}
