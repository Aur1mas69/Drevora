import { registerPlugin } from '@capacitor/core'

/**
 * Native Capacitor auth storage: AES-GCM via SecureAuthStorage Android plugin.
 * No plaintext localStorage fallback.
 */

type SecureAuthStoragePlugin = {
  getItem: (options: { key: string }) => Promise<{ value: string | null }>
  setItem: (options: { key: string; value: string }) => Promise<void>
  removeItem: (options: { key: string }) => Promise<void>
  clear: () => Promise<void>
}

const SecureAuthStorage = registerPlugin<SecureAuthStoragePlugin>('SecureAuthStorage')

export type SupabaseAuthStorageAdapter = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export type SupabaseAuthStorageConfig = {
  detectSessionInUrl: boolean
  storage?: SupabaseAuthStorageAdapter
}

function deriveProjectAuthStorageKey(): string | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  if (!supabaseUrl) {
    return null
  }

  try {
    const hostname = new URL(supabaseUrl).hostname
    const projectRef = hostname.split('.')[0]
    if (!projectRef) {
      return null
    }
    return `sb-${projectRef}-auth-token`
  } catch {
    return null
  }
}

/**
 * One-time legacy cleanup: remove plaintext Supabase Auth keys from WebView
 * localStorage for the current project only. Does not migrate the old session.
 */
function clearLegacyWebViewAuthStorage(): void {
  const storageKey = deriveProjectAuthStorageKey()
  if (!storageKey) {
    return
  }

  try {
    const keysToRemove: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key) {
        continue
      }
      if (
        key === storageKey ||
        key.startsWith(`${storageKey}-`) ||
        key.startsWith(`${storageKey}.`)
      ) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    // WebView storage may be unavailable; never crash client init.
  }
}

const secureAuthStorageAdapter: SupabaseAuthStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await SecureAuthStorage.getItem({ key })
    return result.value ?? null
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureAuthStorage.setItem({ key, value })
  },

  async removeItem(key: string): Promise<void> {
    await SecureAuthStorage.removeItem({ key })
  },
}

/** Clears legacy WebView Supabase Auth keys before the client is created. */
export function prepareAuthStorage(): void {
  clearLegacyWebViewAuthStorage()
}

/** Native builds use Keystore-backed secure storage and skip URL session detection. */
export function getAuthStorageConfig(): SupabaseAuthStorageConfig {
  return {
    detectSessionInUrl: false,
    storage: secureAuthStorageAdapter,
  }
}
