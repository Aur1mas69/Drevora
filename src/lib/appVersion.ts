/**
 * Single source for Worker app marketing version.
 * Keep in sync with package.json `version` and Android `versionName`.
 */
export const APP_VERSION = '0.9.0' as const
export const APP_DISPLAY_NAME = 'DREVORA' as const

/** e.g. "DREVORA v0.9.0 Beta" */
export function getAppVersionLabel(): string {
  return `${APP_DISPLAY_NAME} v${APP_VERSION} Beta`
}
