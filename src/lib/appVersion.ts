/**
 * Single source for Worker app marketing version.
 * Keep in sync with package.json `version` and Android `versionName`.
 */
export const APP_VERSION = '0.9.0' as const
export const APP_DISPLAY_NAME = 'DREVORA' as const
export const APP_CHANNEL_LABEL = 'Beta' as const

/** e.g. "DREVORA v0.9.0 Beta" */
export function getAppVersionLabel(): string {
  return `${APP_DISPLAY_NAME} v${APP_VERSION} ${APP_CHANNEL_LABEL}`
}

/** Platform label for Help → App Version (Android / Web / PWA). */
export function getAppPlatformDisplayName(): 'Android' | 'Web' | 'PWA' {
  if (import.meta.env.MODE === 'native') return 'Android'
  if (typeof window !== 'undefined') {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    if (isStandalone) return 'PWA'
  }
  return 'Web'
}

/**
 * Android versionCode when Capcitor App plugin exposes it; otherwise null.
 * Never invent a build number.
 */
export async function getNativeBuildNumber(): Promise<string | null> {
  if (import.meta.env.MODE !== 'native') return null
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    const build = info.build?.trim()
    return build || null
  } catch {
    return null
  }
}
