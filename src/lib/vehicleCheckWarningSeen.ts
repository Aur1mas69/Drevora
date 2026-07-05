import { getCompanyTodayIsoDate } from '@/lib/companyDate'

export type VehicleCheckWarningSeenRecord = {
  date: string
  issueCount: number
  latestIssueAt: string | null
}

const STORAGE_KEY_PREFIX = 'drevora_vehicle_check_warning_seen'

function buildStorageKey(
  companyId: string | null | undefined,
  userId: string | null | undefined,
  todayDate: string,
): string | null {
  if (!companyId || !userId) return null
  return `${STORAGE_KEY_PREFIX}_${companyId}_${userId}_${todayDate}`
}

function readSeenRecord(key: string | null): VehicleCheckWarningSeenRecord | null {
  if (!key || typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<VehicleCheckWarningSeenRecord>
    if (
      typeof parsed.date !== 'string' ||
      typeof parsed.issueCount !== 'number'
    ) {
      return null
    }

    return {
      date: parsed.date,
      issueCount: parsed.issueCount,
      latestIssueAt:
        typeof parsed.latestIssueAt === 'string' ? parsed.latestIssueAt : null,
    }
  } catch {
    return null
  }
}

export function shouldShowVehicleCheckWarningBadge(input: {
  companyId: string | null | undefined
  userId: string | null | undefined
  todayDate?: string
  issueCount: number
  latestIssueAt: string | null
}): boolean {
  if (input.issueCount <= 0) return false

  const todayDate = input.todayDate ?? getCompanyTodayIsoDate()
  const key = buildStorageKey(input.companyId, input.userId, todayDate)
  const seen = readSeenRecord(key)

  if (!seen) return true
  if (seen.date !== todayDate) return true
  if (seen.issueCount !== input.issueCount) return true
  if (seen.latestIssueAt !== input.latestIssueAt) return true

  return false
}

export function markVehicleCheckWarningSeen(input: {
  companyId: string | null | undefined
  userId: string | null | undefined
  todayDate?: string
  issueCount: number
  latestIssueAt: string | null
}): void {
  if (input.issueCount <= 0) return

  const todayDate = input.todayDate ?? getCompanyTodayIsoDate()
  const key = buildStorageKey(input.companyId, input.userId, todayDate)
  if (!key || typeof window === 'undefined') return

  const record: VehicleCheckWarningSeenRecord = {
    date: todayDate,
    issueCount: input.issueCount,
    latestIssueAt: input.latestIssueAt,
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(record))
  } catch {
    // Ignore quota / privacy mode failures for MVP acknowledgement.
  }
}
