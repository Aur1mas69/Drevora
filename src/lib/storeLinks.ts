/**
 * External store links for Worker Rate DREVORA.
 * Leave null until a real Play Store URL is configured — never invent one.
 */
export const GOOGLE_PLAY_STORE_URL: string | null = null

export function getGooglePlayStoreUrl(): string | null {
  const value = GOOGLE_PLAY_STORE_URL?.trim()
  return value || null
}
