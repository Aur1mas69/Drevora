/**
 * Trusted DREVORA subscription plan definitions.
 * Limits and pricing come from this module only — never from URL or browser input.
 */

export const SUBSCRIPTION_PLAN_CODES = ['starter', 'growing', 'pro'] as const

export type SubscriptionPlanCode = (typeof SUBSCRIPTION_PLAN_CODES)[number]

/** Marketing / enquiry only — not auto-activated as a subscription. */
export const CUSTOM_PLAN_CODE = 'custom' as const

export type SubscriptionStatus = 'trial'

export type SubscriptionPlanDefinition = {
  code: SubscriptionPlanCode
  displayName: string
  vehicleLimit: number
  activeWorkerLimit: number
  priceDisplay: string
  priceMonthlyGbp: number
}

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanCode,
  SubscriptionPlanDefinition
> = {
  starter: {
    code: 'starter',
    displayName: 'Starter Fleet',
    vehicleLimit: 10,
    activeWorkerLimit: 20,
    priceDisplay: '£69.99 / month',
    priceMonthlyGbp: 69.99,
  },
  growing: {
    code: 'growing',
    displayName: 'Growing Fleet',
    vehicleLimit: 25,
    activeWorkerLimit: 50,
    priceDisplay: '£119.99 / month',
    priceMonthlyGbp: 119.99,
  },
  pro: {
    code: 'pro',
    displayName: 'Pro Fleet',
    vehicleLimit: 50,
    activeWorkerLimit: 100,
    priceDisplay: '£199.99 / month',
    priceMonthlyGbp: 199.99,
  },
}

export const LANDING_PRICING_URL = 'https://www.drevora.app/#pricing'

export function isSubscriptionPlanCode(
  value: unknown,
): value is SubscriptionPlanCode {
  return (
    typeof value === 'string' &&
    (SUBSCRIPTION_PLAN_CODES as readonly string[]).includes(value)
  )
}

/** Validate a URL/query/storage value. Rejects custom and unknown codes. */
export function parseSubscriptionPlanCode(
  value: unknown,
): SubscriptionPlanCode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isSubscriptionPlanCode(normalized) ? normalized : null
}

export function getSubscriptionPlan(
  code: SubscriptionPlanCode,
): SubscriptionPlanDefinition {
  return SUBSCRIPTION_PLANS[code]
}

export function formatPlanVehicleLimit(plan: SubscriptionPlanDefinition): string {
  return `Up to ${plan.vehicleLimit} vehicles`
}

export function formatPlanWorkerLimit(plan: SubscriptionPlanDefinition): string {
  return `Up to ${plan.activeWorkerLimit} active Workers`
}
