/**
 * Web / PWA auth storage configuration.
 * Preserves the browser Supabase client default (localStorage).
 * Makes no Capacitor plugin calls and does not clear browser auth storage.
 */

export type SupabaseAuthStorageAdapter = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export type SupabaseAuthStorageConfig = {
  detectSessionInUrl: boolean
  storage?: SupabaseAuthStorageAdapter
}

/** No-op on web. Native builds clear legacy WebView auth keys only. */
export function prepareAuthStorage(): void {}

/** Browser builds keep Supabase's default localStorage session behaviour. */
export function getAuthStorageConfig(): SupabaseAuthStorageConfig {
  return {
    detectSessionInUrl: true,
  }
}
