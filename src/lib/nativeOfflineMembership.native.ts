import { Preferences } from '@capacitor/preferences'
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

/** Persist last verified Worker membership for offline cold start. */
export async function saveNativeOfflineMembershipSnapshot(
  snapshot: NativeOfflineMembershipSnapshot,
): Promise<void> {
  if (!isWorkerMembershipRole(snapshot.membershipRole)) {
    return
  }

  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(snapshot),
    })
  } catch {
    // Best-effort only — never block online membership resolve.
  }
}

export async function readNativeOfflineMembershipSnapshot(
  userId: string,
): Promise<NativeOfflineMembershipSnapshot | null> {
  try {
    const result = await Preferences.get({ key: STORAGE_KEY })
    if (!result.value) return null
    const parsed: unknown = JSON.parse(result.value)
    if (!isSnapshot(parsed)) return null
    if (parsed.userId !== userId) return null
    if (!isWorkerMembershipRole(parsed.membershipRole)) return null
    return parsed
  } catch {
    return null
  }
}

export async function clearNativeOfflineMembershipSnapshot(): Promise<void> {
  try {
    await Preferences.remove({ key: STORAGE_KEY })
  } catch {
    // ignore
  }
}
