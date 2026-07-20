import {
  parseSubscriptionPlanCode,
  type SubscriptionPlanCode,
} from '@/lib/subscriptionPlans'

/**
 * Temporary handoff of a validated plan code through login / magic-link return.
 * Not subscription truth — clear after company-plan persistence.
 */
export const PENDING_PLAN_STORAGE_KEY = 'drevora.pending-plan'

export function readPendingPlanCode(): SubscriptionPlanCode | null {
  try {
    return parseSubscriptionPlanCode(
      window.sessionStorage.getItem(PENDING_PLAN_STORAGE_KEY),
    )
  } catch {
    return null
  }
}

export function writePendingPlanCode(code: SubscriptionPlanCode): void {
  try {
    window.sessionStorage.setItem(PENDING_PLAN_STORAGE_KEY, code)
  } catch {
    // sessionStorage may be unavailable; plan may still exist in the URL.
  }
}

export function clearPendingPlanCode(): void {
  try {
    window.sessionStorage.removeItem(PENDING_PLAN_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Capture a plan from the current URL search params into sessionStorage.
 * Invalid values are ignored (and any stale pending code is left unchanged
 * unless `clearInvalid` is true).
 */
export function capturePendingPlanFromSearch(
  search: string,
  options: { clearInvalid?: boolean } = {},
): SubscriptionPlanCode | null {
  const params = new URLSearchParams(
    search.startsWith('?') ? search : search ? `?${search}` : '',
  )
  const raw = params.get('plan')
  if (raw == null || raw.trim() === '') {
    return readPendingPlanCode()
  }

  const parsed = parseSubscriptionPlanCode(raw)
  if (parsed) {
    writePendingPlanCode(parsed)
    return parsed
  }

  if (options.clearInvalid) {
    clearPendingPlanCode()
  }
  return null
}
