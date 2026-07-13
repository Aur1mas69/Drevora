import type { CompanySettings } from '@/lib/companySettingsTypes'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'

export const NO_ACTIVE_MEMBERSHIP_MESSAGE =
  'Your account is not linked to an active company. Contact DREVORA support.'

export const MULTIPLE_MEMBERSHIPS_MESSAGE =
  'Multiple company memberships found. Company selection is required.'

export type CompanyMembershipRow = {
  userId: string
  companyId: string
  membershipRole: string
  isActive: boolean
}

export type CompanyMembershipResolution =
  | {
      status: 'ready'
      userId: string
      companyId: string
      companyName: string
      membershipRole: string
      isActive: true
      companySettings: CompanySettings
    }
  | {
      status: 'unauthenticated'
      message: string
    }
  | {
      status: 'unlinked'
      userId: string
      message: string
    }
  | {
      status: 'multiple'
      userId: string
      message: string
      memberships: CompanyMembershipRow[]
    }
  | {
      status: 'error'
      userId?: string
      message: string
    }

type MembershipDbRow = {
  user_id: string
  company_id: string
  role: string
  is_active: boolean
}

type MembershipCache = {
  userId: string
  rows: CompanyMembershipRow[]
}

let membershipRowsCache: MembershipCache | null = null

export class CompanyMembershipServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompanyMembershipServiceError'
  }
}

export function clearCompanyMembershipCache(): void {
  membershipRowsCache = null
}

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return null
  }

  const { data, error } = await requireSupabase().auth.getUser()
  if (error || !data.user?.id) {
    return null
  }

  return data.user.id
}

/**
 * Load active company_members rows for the authenticated user.
 * Relies on RLS (user_id = auth.uid()) plus an explicit is_active filter.
 * Does not trust browser-supplied company IDs or portal sessionStorage.
 */
export async function fetchActiveCompanyMemberships(
  options: { force?: boolean } = {},
): Promise<{ userId: string; memberships: CompanyMembershipRow[] } | null> {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return null
  }

  if (!options.force && membershipRowsCache?.userId === userId) {
    return { userId, memberships: membershipRowsCache.rows }
  }

  const { data, error } = await requireSupabase()
    .from('company_members')
    .select('user_id, company_id, role, is_active')
    .eq('is_active', true)

  if (error) {
    throw new CompanyMembershipServiceError(error.message)
  }

  const memberships: CompanyMembershipRow[] = (data as MembershipDbRow[] | null ?? [])
    .filter((row) => row.user_id === userId && row.is_active && row.company_id)
    .map((row) => ({
      userId: row.user_id,
      companyId: row.company_id,
      membershipRole: row.role,
      isActive: true,
    }))

  membershipRowsCache = { userId, rows: memberships }
  return { userId, memberships }
}

/**
 * Resolve the authenticated user's current company through company_members.
 * Exactly one active membership → ready.
 * Zero → unlinked (no oldest-company fallback).
 * Multiple → configuration state (no first-row fallback; no switcher yet).
 */
export async function resolveCurrentCompanyMembership(
  options: { force?: boolean } = {},
): Promise<CompanyMembershipResolution> {
  try {
    const loaded = await fetchActiveCompanyMemberships(options)
    if (!loaded) {
      return {
        status: 'unauthenticated',
        message: 'Sign in to load your company membership.',
      }
    }

    const { userId, memberships } = loaded

    if (memberships.length === 0) {
      return {
        status: 'unlinked',
        userId,
        message: NO_ACTIVE_MEMBERSHIP_MESSAGE,
      }
    }

    if (memberships.length > 1) {
      return {
        status: 'multiple',
        userId,
        message: MULTIPLE_MEMBERSHIPS_MESSAGE,
        memberships,
      }
    }

    const membership = memberships[0]
    const { fetchCompanySettingsById } = await import('@/services/companySettingsService')
    const companySettings = await fetchCompanySettingsById(membership.companyId)

    if (!companySettings) {
      return {
        status: 'error',
        userId,
        message:
          'Your company membership is valid, but the linked company record could not be loaded.',
      }
    }

    return {
      status: 'ready',
      userId,
      companyId: membership.companyId,
      companyName: companySettings.name?.trim() || 'Company',
      membershipRole: membership.membershipRole,
      isActive: true,
      companySettings,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to resolve company membership.'
    return { status: 'error', message }
  }
}

/** Lightweight: return the single active company id, or null when not exactly one. */
export async function resolveCurrentCompanyId(): Promise<string | null> {
  const loaded = await fetchActiveCompanyMemberships()
  if (!loaded || loaded.memberships.length !== 1) {
    return null
  }
  return loaded.memberships[0].companyId
}

export const companyMembershipService = {
  fetchActiveCompanyMemberships,
  resolveCurrentCompanyMembership,
  resolveCurrentCompanyId,
  clearCompanyMembershipCache,
}