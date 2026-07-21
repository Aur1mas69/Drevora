import type { SubscriptionPlanCode, SubscriptionStatus } from '@/lib/subscriptionPlans'

export const SUBSCRIPTION_PLAN_EXPIRED = 'SUBSCRIPTION_PLAN_EXPIRED'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Minimal plan fields required by the central entitlement resolver. */
export type SubscriptionPlanFields = {
  planCode: SubscriptionPlanCode | 'custom' | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionValidUntil: string | null
}

/** Derived lifecycle for UI / create gates. Stored subscription_status is unchanged. */
export type SubscriptionLifecycleState =
  | 'no_plan'
  | 'no_expiry_set'
  | 'active'
  | 'expired'

export type SubscriptionEntitlement = {
  planCode: SubscriptionPlanCode | 'custom' | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionValidUntil: string | null
  /** Stored status may still be "trial"; this is the derived UI/create state. */
  lifecycleState: SubscriptionLifecycleState
  isExpired: boolean
  /** False when expired; null valid-until does not expire. */
  canCreateEntitledRecords: boolean
  /** Whole days remaining (>= 1 while active). 0 when expired. null when no expiry set. */
  daysRemaining: number | null
  validUntilDate: Date | null
}

export function parseSubscriptionValidUntil(
  value: string | null | undefined,
): Date | null {
  if (value == null || value === '') return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

/**
 * Precise timestamptz comparison. Expired when now >= validUntil (inclusive).
 * Null valid-until never expires (preserves existing companies).
 */
export function isSubscriptionExpiredAt(
  validUntilIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const validUntil = parseSubscriptionValidUntil(validUntilIso)
  if (validUntil == null) return false
  return now.getTime() >= validUntil.getTime()
}

export function getSubscriptionDaysRemaining(
  validUntilIso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const validUntil = parseSubscriptionValidUntil(validUntilIso)
  if (validUntil == null) return null
  const ms = validUntil.getTime() - now.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / MS_PER_DAY)
}

/**
 * Central subscription entitlement resolver.
 * Use this for Settings display and Vehicle/Worker create gates — do not duplicate.
 */
export function resolveSubscriptionEntitlement(
  plan: SubscriptionPlanFields | null,
  now: Date = new Date(),
): SubscriptionEntitlement {
  if (!plan?.planCode) {
    return {
      planCode: null,
      subscriptionStatus: plan?.subscriptionStatus ?? null,
      subscriptionValidUntil: plan?.subscriptionValidUntil ?? null,
      lifecycleState: 'no_plan',
      isExpired: false,
      canCreateEntitledRecords: false,
      daysRemaining: null,
      validUntilDate: parseSubscriptionValidUntil(plan?.subscriptionValidUntil),
    }
  }

  const subscriptionValidUntil = plan.subscriptionValidUntil ?? null
  const validUntilDate = parseSubscriptionValidUntil(subscriptionValidUntil)

  if (validUntilDate == null) {
    return {
      planCode: plan.planCode,
      subscriptionStatus: plan.subscriptionStatus,
      subscriptionValidUntil: null,
      lifecycleState: 'no_expiry_set',
      isExpired: false,
      canCreateEntitledRecords: true,
      daysRemaining: null,
      validUntilDate: null,
    }
  }

  const expired = now.getTime() >= validUntilDate.getTime()
  const daysRemaining = expired
    ? 0
    : Math.ceil((validUntilDate.getTime() - now.getTime()) / MS_PER_DAY)

  return {
    planCode: plan.planCode,
    subscriptionStatus: plan.subscriptionStatus,
    subscriptionValidUntil,
    lifecycleState: expired ? 'expired' : 'active',
    isExpired: expired,
    canCreateEntitledRecords: !expired,
    daysRemaining,
    validUntilDate,
  }
}

export function formatSubscriptionExpiredMessage(
  formattedExpiryDate: string,
): string {
  return `Your trial expired on ${formattedExpiryDate}. Existing records remain available. Contact DREVORA to renew your plan.`
}

export function isSubscriptionPlanExpiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toUpperCase()
  const code =
    'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.toUpperCase()
      : ''
  return (
    code === SUBSCRIPTION_PLAN_EXPIRED ||
    message.includes(SUBSCRIPTION_PLAN_EXPIRED)
  )
}
