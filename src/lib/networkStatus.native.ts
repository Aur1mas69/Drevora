import { Network } from '@capacitor/network'
import type { PluginListenerHandle } from '@capacitor/core'

/**
 * Native Android network status via official @capacitor/network, cross-checked
 * against the WebView's own connectivity flag.
 *
 * `Network.getStatus()` can reject while the bridge is still starting, and the
 * old fail-open `true` then stuck for the whole session: when the device was
 * already offline at launch no `networkStatusChange` event ever followed to
 * correct it, so every caller believed it was online. `navigator.onLine` is
 * authoritative when it reports offline, so it is checked first and its events
 * are merged into the listener.
 */

export type NetworkStatusHandle = {
  remove: () => Promise<void>
}

function webViewReportsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export async function getOnlineStatus(): Promise<boolean> {
  if (webViewReportsOffline()) return false

  try {
    const status = await Network.getStatus()
    return status.connected === true
  } catch {
    // Fail open to avoid blocking online save if the plugin is briefly unavailable.
    return true
  }
}

export async function addOnlineStatusListener(
  listener: (online: boolean) => void,
): Promise<NetworkStatusHandle> {
  let handle: PluginListenerHandle | null = null

  try {
    handle = await Network.addListener('networkStatusChange', (status) => {
      listener(status.connected === true && !webViewReportsOffline())
    })
  } catch {
    handle = null
  }

  const onWindowOnline = () => {
    void getOnlineStatus().then(listener)
  }
  const onWindowOffline = () => listener(false)

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onWindowOnline)
    window.addEventListener('offline', onWindowOffline)
  }

  return {
    async remove() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onWindowOnline)
        window.removeEventListener('offline', onWindowOffline)
      }
      if (!handle) return
      try {
        await handle.remove()
      } catch {
        // ignore listener cleanup failures
      }
      handle = null
    },
  }
}
