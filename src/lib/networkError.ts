/**
 * Shared detection of transient connectivity failures (Web/PWA + Native).
 * Used so Worker UI never surfaces raw browser/Capacitor fetch TypeErrors.
 */

const RETRYABLE_NETWORK_PATTERN =
  /failed to fetch|network\s*error|network request failed|load failed|fetch failed|econnrefused|econnreset|etimedout|enotfound|offline|internet|unreachable|aborterror|timed?\s*out|vehicles_fetch_timeout|the internet connection appears to be offline|ns_error_net/i

export function isRetryableNetworkError(error: unknown): boolean {
  if (error == null) return false

  if (typeof error === 'string') {
    return RETRYABLE_NETWORK_PATTERN.test(error)
  }

  if (!(error instanceof Error)) return false

  const haystack = `${error.name} ${error.message}`
  if (RETRYABLE_NETWORK_PATTERN.test(haystack)) return true

  // Chromium / WebView offline fetch: TypeError: Failed to fetch
  if (error.name === 'TypeError' && /fetch|network/i.test(error.message)) {
    return true
  }

  return false
}
