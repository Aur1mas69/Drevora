/**
 * Web/PWA network status — uses browser online/offline events.
 * Native builds resolve `@/lib/networkStatus` to `networkStatus.native.ts`.
 */

export type NetworkStatusHandle = {
  remove: () => Promise<void>
}

export async function getOnlineStatus(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export async function addOnlineStatusListener(
  listener: (online: boolean) => void,
): Promise<NetworkStatusHandle> {
  if (typeof window === 'undefined') {
    return {
      async remove() {
        // no-op
      },
    }
  }

  const onOnline = () => listener(true)
  const onOffline = () => listener(false)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  return {
    async remove() {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    },
  }
}
