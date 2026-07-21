import {
  clearPendingPlanCode,
  readPendingPlanCode,
} from '@/lib/pendingPlan'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import {
  getSubscriptionPlan,
  isSubscriptionPlanCode,
  parseSubscriptionPlanCode,
  type SubscriptionPlanCode,
  type SubscriptionPlanDefinition,
  type SubscriptionStatus,
} from '@/lib/subscriptionPlans'
import { clearCompanyMembershipCache } from '@/services/companyMembershipService'

export type CompanyPlanRecord = {
  planCode: SubscriptionPlanCode | 'custom' | null
  planSelectedAt: string | null
  trialStartedAt: string | null
  subscriptionStatus: SubscriptionStatus | null
  /** ISO timestamptz; null means no expiry stored (not expired). */
  subscriptionValidUntil: string | null
  definition: SubscriptionPlanDefinition | null
}

export class CompanyPlanServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompanyPlanServiceError'
  }
}

type CompanyPlanRow = {
  plan_code: string | null
  plan_selected_at: string | null
  trial_started_at: string | null
  subscription_status: string | null
  subscription_valid_until?: string | null
}

function mapCompanyPlanRow(row: CompanyPlanRow): CompanyPlanRecord {
  const planCode =
    row.plan_code === 'custom'
      ? 'custom'
      : parseSubscriptionPlanCode(row.plan_code)

  return {
    planCode,
    planSelectedAt: row.plan_selected_at,
    trialStartedAt: row.trial_started_at,
    subscriptionStatus:
      row.subscription_status === 'trial' ? 'trial' : null,
    subscriptionValidUntil: row.subscription_valid_until ?? null,
    definition:
      planCode && isSubscriptionPlanCode(planCode)
        ? getSubscriptionPlan(planCode)
        : null,
  }
}

function isMissingPlanColumnError(error: {
  message?: string
  code?: string
  details?: string
}): boolean {
  const message = (error.message ?? '').toLowerCase()
  const details = (error.details ?? '').toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('plan_code') ||
    message.includes('subscription_status') ||
    message.includes('trial_started_at') ||
    message.includes('plan_selected_at') ||
    message.includes('subscription_valid_until') ||
    message.includes('schema cache') ||
    (message.includes('column') &&
      (message.includes('does not exist') ||
        message.includes('not found') ||
        message.includes('could not find'))) ||
    details.includes('plan_code') ||
    details.includes('subscription_valid_until')
  )
}

function isMissingValidUntilColumnError(error: {
  message?: string
  code?: string
  details?: string
}): boolean {
  const message = (error.message ?? '').toLowerCase()
  const details = (error.details ?? '').toLowerCase()
  return (
    message.includes('subscription_valid_until') ||
    details.includes('subscription_valid_until')
  )
}

/**
 * Read plan fields for a company. Returns null when columns are not migrated yet
 * or the company row is missing. Never writes.
 */
export async function fetchCompanyPlan(
  companyId: string,
): Promise<CompanyPlanRecord | null> {
  if (!isSupabaseConfigured) {
    return null
  }

  const normalizedId = companyId.trim()
  if (!normalizedId) {
    return null
  }

  const client = requireSupabase()
  const fullSelect =
    'plan_code, plan_selected_at, trial_started_at, subscription_status, subscription_valid_until'
  const baseSelect =
    'plan_code, plan_selected_at, trial_started_at, subscription_status'

  let { data, error } = await client
    .from('companies')
    .select(fullSelect)
    .eq('id', normalizedId)
    .maybeSingle()

  if (error && isMissingValidUntilColumnError(error)) {
    ;({ data, error } = await client
      .from('companies')
      .select(baseSelect)
      .eq('id', normalizedId)
      .maybeSingle())
  }

  if (error) {
    if (isMissingPlanColumnError(error)) {
      return null
    }
    throw new CompanyPlanServiceError(error.message)
  }

  if (!data) {
    return null
  }

  return mapCompanyPlanRow(data as CompanyPlanRow)
}

/**
 * Create a company for an unlinked authenticated user using the pending plan
 * (or an explicitly validated plan code). Clears pending plan only after success.
 * Does not overwrite an existing membership / company plan.
 */
export async function createCompanyWithPendingTrialPlan(input: {
  companyName: string
  planCode?: SubscriptionPlanCode | null
}): Promise<{ companyId: string; planCode: SubscriptionPlanCode }> {
  if (!isSupabaseConfigured) {
    throw new CompanyPlanServiceError('Supabase is not configured')
  }

  const planCode =
    parseSubscriptionPlanCode(input.planCode) ?? readPendingPlanCode()

  if (!planCode) {
    throw new CompanyPlanServiceError(
      'Select a plan on the DREVORA pricing page before creating your company.',
    )
  }

  // Re-resolve from trusted definitions (never trust URL-supplied limits).
  getSubscriptionPlan(planCode)

  const companyName = input.companyName.trim()
  if (companyName.length < 2) {
    throw new CompanyPlanServiceError('Enter a company name.')
  }

  const { data, error } = await requireSupabase().rpc(
    'drevora_create_company_with_trial_plan',
    {
      p_company_name: companyName,
      p_plan_code: planCode,
    },
  )

  if (error) {
    if (isMissingPlanColumnError(error) || error.message.includes('function')) {
      throw new CompanyPlanServiceError(
        'Company plan setup is not available yet. Ask DREVORA support to apply the latest database migration.',
      )
    }
    throw new CompanyPlanServiceError(error.message)
  }

  const companyId = typeof data === 'string' ? data : null
  if (!companyId) {
    throw new CompanyPlanServiceError('Company was not created.')
  }

  clearPendingPlanCode()
  clearCompanyMembershipCache()

  return { companyId, planCode }
}
