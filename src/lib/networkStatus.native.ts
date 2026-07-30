import { Network } from '@capacitor/network'
import type { PluginListenerHandle } from '@capacitor/core'

/**
 * Native Android network status via official @capacitor/network.
 */

export type NetworkStatusHandle = {
  remove: () => Promise<void>
}

export async function getOnlineStatus(): Promise<boolean> {
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
      listener(status.connected === true)
    })
  } catch {
    handle = null
  }

  return {
    async remove() {
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
