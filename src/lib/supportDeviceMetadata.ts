import { APP_VERSION } from '@/lib/appVersion'
import { getOnlineStatus } from '@/lib/networkStatus'
import type {
  SupportDeviceMetadata,
  SupportMinimalDeviceMetadata,
  SupportNetworkState,
  SupportPlatform,
} from '@/lib/supportRequestTypes'

function detectPlatform(): SupportPlatform {
  if (import.meta.env.MODE === 'native') return 'android'
  if (typeof window !== 'undefined') {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari PWA
      ('standalone' in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    if (isStandalone) return 'pwa'
  }
  return 'web'
}

/**
 * Minimal safe metadata for Rate / Feedback submissions.
 * Never includes tokens, session JSON, passwords, or env secrets.
 */
export function collectMinimalSupportDeviceMetadata(): SupportMinimalDeviceMetadata {
  return {
    appVersion: APP_VERSION,
    platform: detectPlatform(),
    submittedAt: new Date().toISOString(),
  }
}

/**
 * Full safe technical metadata for Bug report submissions.
 * Never includes tokens, session JSON, passwords, or env secrets.
 */
export async function collectSupportDeviceMetadata(
  route: string,
): Promise<SupportDeviceMetadata> {
  const online =
    typeof navigator === 'undefined' ? true : await getOnlineStatus()
  const networkState: SupportNetworkState = online ? 'online' : 'offline'

  return {
    appVersion: APP_VERSION,
    platform: detectPlatform(),
    route: route || '/',
    networkState,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : '',
    screenWidth:
      typeof window !== 'undefined' ? Math.round(window.screen?.width ?? 0) : 0,
    screenHeight:
      typeof window !== 'undefined' ? Math.round(window.screen?.height ?? 0) : 0,
    locale:
      typeof navigator !== 'undefined' ? navigator.language || 'unknown' : 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    submittedAt: new Date().toISOString(),
  }
}

/** Human-readable bullets for the Bug report Technical details disclosure. */
export function getSupportMetadataDisclosureLines(
  meta: SupportDeviceMetadata,
): string[] {
  return [
    `App version: ${meta.appVersion}`,
    `Platform: ${meta.platform}`,
    `Current screen: ${meta.route}`,
    `Network: ${meta.networkState}`,
    'Browser / WebView user agent',
    `Screen: ${meta.screenWidth}×${meta.screenHeight}`,
    `Locale: ${meta.locale}`,
    `Timezone: ${meta.timezone}`,
    'Submission time',
  ]
}
