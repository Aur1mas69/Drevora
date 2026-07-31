import type { CompanySettings } from '@/lib/companySettingsTypes'
import { isWorkerMembershipRole } from '@/lib/membershipRoles'

export type NativeOfflineMembershipSnapshot = {
  userId: string
  companyId: string
  companyName: string
  membershipRole: string
  companySettings: CompanySettings
  savedAt: string
}

const STORAGE_KEY = 'drevora:native-offline-membership-v1'

function isSnapshot(value: unknown): value is NativeOfflineMembershipSnapshot {
  if (!value || typeof value !== 'object') return false
  const row = value as NativeOfflineMembershipSnapshot
  return (
    typeof row.userId === 'string' &&
    typeof row.companyId === 'string' &&
    typeof row.companyName === 'string' &&
    typeof row.membershipRole === 'string' &&
    row.companySettings != null &&
    typeof row.companySettings === 'object' &&
    typeof row.savedAt === 'string'
  )
}

/**
 * Web/PWA: persist last verified Worker membership for offline cold start.
 * Office/Admin roles are not snapshotted — Admin offline behaviour stays unchanged.
 */
export async function saveNativeOfflineMembershipSnapshot(
  snapshot: NativeOfflineMembershipSnapshot,
): Promise<void> {
  if (!isWorkerMembershipRole(snapshot.membershipRole)) {
    return
  }
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Best-effort only — never block online membership resolve.
  }
}

export async function readNativeOfflineMembershipSnapshot(
  userId: string,
): Promise<NativeOfflineMembershipSnapshot | null> {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSnapshot(parsed)) return null
    if (parsed.userId !== userId) return null
    if (!isWorkerMembershipRole(parsed.membershipRole)) return null
    return parsed
  } catch {
    return null
  }
}

export async function clearNativeOfflineMembershipSnapshot(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
