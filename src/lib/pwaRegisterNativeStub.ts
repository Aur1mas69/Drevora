/**
 * Native (Capacitor) builds do not register a service worker.
 * Vite aliases `virtual:pwa-register` to this stub when mode === 'native'
 * so the existing PwaRuntime import still resolves without Workbox output.
 */
export function registerSW(_options?: {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
  onRegisteredSW?: (
    swUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void
  onRegisterError?: (error: unknown) => void
}): (reloadPage?: boolean) => Promise<void> {
  return async () => {
    // no-op: native WebView does not use the PWA service worker
  }
}
