import {
  enqueueOfflineItem,
  getOfflineItem,
  listOfflineItems,
  offlineSyncManager,
  removeOfflineItem,
  updateOfflineItem,
  type OfflineQueueItem,
  type OfflineSyncModuleResult,
} from '@/lib/offlineQueue'
import {
  buildOfflineCheckMediaDir,
  buildOfflinePhotoPath,
  buildOfflineSignaturePath,
  deleteOfflineMediaDirectory,
  listOfflineMediaDirectories,
  OFFLINE_VEHICLE_CHECK_MEDIA_ROOT,
  OfflineMediaStorageError,
  readOfflineMediaAsFile,
  writeOfflineMediaFromFile,
} from '@/lib/offlineMedia/offlineMediaStorage'
import {
  emitOfflineVehicleCheckSyncProgress,
  getOfflineVehicleCheckSyncProgress,
  type OfflineVehicleCheckSyncPhase,
} from '@/lib/offlineMedia/syncProgress'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import type { VehicleCheckLocationCapture } from '@/lib/vehicleCheckLocation'
import type {
  VehicleCheckItemInput,
  VehicleCheckOdometerUnit,
  VehicleCheckItemResult,
} from '@/lib/vehicleCheckTypes'
import {
  createVehicleCheck,
  fetchVehicleCheckById,
  finalizeInProgressVehicleCheck,
  VehicleChecksServiceError,
} from '@/services/vehicleChecksService'

/** Module key for the reusable offline queue. */
export const OFFLINE_VEHICLE_CHECKS_MODULE = 'vehicle-checks'

const LAST_SYNC_STORAGE_KEY = 'drevora:offline-vehicle-checks:last-sync-at'
const RECENT_COMPLETED_STORAGE_KEY = 'drevora:offline-vehicle-checks:recent-completed'

export type OfflineMediaUploadState = 'pending' | 'uploaded' | 'failed'

/**
 * JSON-serializable Vehicle Check payload for offline queue storage.
 * Media binaries live on the filesystem; this payload only stores paths + upload state.
 */
export type OfflineVehicleCheckItemPayload = {
  category: string
  itemName: string
  result: VehicleCheckItemResult
  comment?: string | null
  isAnswered?: boolean
  localPhotoPath?: string | null
  photoMimeType?: string | null
  uploadedPhotoUrl?: string | null
  photoUploadState?: OfflineMediaUploadState
}

export type OfflineVehicleCheckPayload = {
  companyId: string
  vehicleId: string
  workerId: string
  inspectionDate: string
  odometer: number
  odometerUnit?: VehicleCheckOdometerUnit
  notes?: string | null
  inspectionStartedAt: string
  items: OfflineVehicleCheckItemPayload[]
  startedLocation?: VehicleCheckLocationCapture | null
  completedLocation?: VehicleCheckLocationCapture | null
  /** Local filesystem path (Directory.Data relative). */
  localSignaturePath?: string | null
  signatureMimeType?: string | null
  uploadedSignatureUrl?: string | null
  signatureUploadState?: OfflineMediaUploadState
  mediaUploadState?: OfflineMediaUploadState | 'uploading'
  checkCreateState?: 'pending' | 'creating' | 'created' | 'failed'
  createdVehicleCheckId?: string | null
  savedAt?: string
  completedAtLocal?: string
  lastSyncAttemptAt?: string | null
  syncPhase?: OfflineVehicleCheckSyncPhase
  retryCount?: number
}

export type OfflineVehicleCheckQueueItem = OfflineQueueItem<OfflineVehicleCheckPayload>

export type SaveOfflineVehicleCheckInput = {
  id?: string
  companyId: string
  vehicleId: string
  workerId: string
  inspectionDate: string
  odometer: number
  odometerUnit?: VehicleCheckOdometerUnit
  notes?: string | null
  inspectionStartedAt: string
  items: VehicleCheckItemInput[]
  signatureFile: File
  startedLocation?: VehicleCheckLocationCapture | null
  completedLocation?: VehicleCheckLocationCapture | null
}

export type OfflineVehicleChecksQueueStats = {
  total: number
  pending: number
  syncing: number
  uploading: number
  failed: number
  completed: number
  isSyncing: boolean
  currentItemId: string | null
  currentPhase: OfflineVehicleCheckSyncPhase
  progressPercent: number | null
  progressLabel: string | null
  lastSyncAt: string | null
}

let autoSyncStarted = false
let autoSyncHandle: { remove: () => Promise<void> } | null = null
let uploaderRegistered = false

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `offline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function itemKey(category: string, itemName: string): string {
  return `${category}__${itemName}`
}

function safeUploaderError(error: unknown): string {
  if (error instanceof VehicleChecksServiceError) return error.message
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 180)
  }
  return 'Failed to sync offline Vehicle Check.'
}

function readLocalMeta(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalMeta(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore quota / private mode
  }
}

function readRecentCompletedCount(): number {
  const raw = readLocalMeta(RECENT_COMPLETED_STORAGE_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function bumpRecentCompletedCount(): number {
  const next = readRecentCompletedCount() + 1
  writeLocalMeta(RECENT_COMPLETED_STORAGE_KEY, String(next))
  return next
}

async function persistPayload(
  id: string,
  payload: OfflineVehicleCheckPayload,
  options?: { status?: OfflineVehicleCheckQueueItem['status']; lastError?: string | null },
): Promise<void> {
  await updateOfflineItem<OfflineVehicleCheckPayload>(OFFLINE_VEHICLE_CHECKS_MODULE, id, {
    payload,
    status: options?.status,
    lastError: options?.lastError,
  })
}

async function persistLocalMedia(
  queueItemId: string,
  items: VehicleCheckItemInput[],
  signatureFile: File,
): Promise<{
  items: OfflineVehicleCheckItemPayload[]
  localSignaturePath: string
  signatureMimeType: string
}> {
  try {
    const serializedItems: OfflineVehicleCheckItemPayload[] = []

    for (const item of items) {
      const base: OfflineVehicleCheckItemPayload = {
        category: item.category,
        itemName: item.itemName,
        result: item.result,
        comment: item.comment ?? null,
        isAnswered: item.isAnswered !== false,
        localPhotoPath: null,
        photoMimeType: null,
        uploadedPhotoUrl: null,
        photoUploadState: 'pending',
      }

      if (item.photoFile) {
        const mimeType = item.photoFile.type || 'image/jpeg'
        const relativePath = buildOfflinePhotoPath(
          queueItemId,
          itemKey(item.category, item.itemName),
          mimeType,
        )
        await writeOfflineMediaFromFile({ relativePath, file: item.photoFile })
        base.localPhotoPath = relativePath
        base.photoMimeType = mimeType
      }

      serializedItems.push(base)
    }

    const signatureMime = signatureFile.type || 'image/jpeg'
    const localSignaturePath = buildOfflineSignaturePath(queueItemId, signatureMime)
    await writeOfflineMediaFromFile({ relativePath: localSignaturePath, file: signatureFile })

    return {
      items: serializedItems,
      localSignaturePath,
      signatureMimeType: signatureMime,
    }
  } catch (error) {
    // Best-effort cleanup of partial media for this queue id only.
    try {
      await deleteOfflineMediaDirectory(buildOfflineCheckMediaDir(queueItemId))
    } catch {
      // ignore
    }
    if (error instanceof OfflineMediaStorageError) throw error
    throw new OfflineMediaStorageError(
      error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 180)
        : 'Could not save offline photos or signature on this device.',
      'unknown',
    )
  }
}

async function hydrateCreateInput(
  payload: OfflineVehicleCheckPayload,
): Promise<{
  items: VehicleCheckItemInput[]
  signatureFile: File
}> {
  if (!payload.localSignaturePath) {
    throw new Error('Offline Vehicle Check is missing a local signature file.')
  }

  const signatureFile = await readOfflineMediaAsFile({
    relativePath: payload.localSignaturePath,
    mimeType: payload.signatureMimeType,
    fileName: 'worker-signature.jpg',
  })

  const items: VehicleCheckItemInput[] = []
  for (const item of payload.items) {
    let photoFile: File | null = null
    if (item.localPhotoPath && item.photoUploadState !== 'uploaded') {
      photoFile = await readOfflineMediaAsFile({
        relativePath: item.localPhotoPath,
        mimeType: item.photoMimeType,
        fileName: `${itemKey(item.category, item.itemName)}.jpg`,
      })
    }

    items.push({
      category: item.category,
      itemName: item.itemName,
      result: item.result,
      comment: item.comment ?? null,
      isAnswered: item.isAnswered !== false,
      photoFile,
      photoUrl: item.uploadedPhotoUrl ?? null,
      photoPreviewUrl: null,
    })
  }

  return { items, signatureFile }
}

function setProgress(input: {
  queueItemId: string | null
  phase: OfflineVehicleCheckSyncPhase
  percent?: number | null
  label?: string | null
}): void {
  emitOfflineVehicleCheckSyncProgress({
    queueItemId: input.queueItemId,
    phase: input.phase,
    percent: input.percent ?? null,
    label: input.label ?? null,
    lastSyncAt: readLocalMeta(LAST_SYNC_STORAGE_KEY),
    recentlyCompletedCount: readRecentCompletedCount(),
  })
}

async function cleanupQueueItemMedia(queueItemId: string): Promise<void> {
  await deleteOfflineMediaDirectory(buildOfflineCheckMediaDir(queueItemId))
}

/**
 * Remove media folders that are not referenced by any pending queue item.
 * Never deletes media for pending/syncing/failed checks.
 */
export async function cleanupOrphanedOfflineVehicleCheckMedia(): Promise<number> {
  const queued = await listOfflineItems<OfflineVehicleCheckPayload>(OFFLINE_VEHICLE_CHECKS_MODULE)
  const keep = new Set(queued.map((item) => item.id))
  const dirs = await listOfflineMediaDirectories(OFFLINE_VEHICLE_CHECK_MEDIA_ROOT)
  let removed = 0
  for (const name of dirs) {
    if (keep.has(name)) continue
    await deleteOfflineMediaDirectory(`${OFFLINE_VEHICLE_CHECK_MEDIA_ROOT}/${name}`)
    removed += 1
  }
  return removed
}

async function syncOneQueuedCheck(
  item: OfflineVehicleCheckQueueItem,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let payload: OfflineVehicleCheckPayload = { ...item.payload, items: [...item.payload.items] }
  const retryCount = (payload.retryCount ?? item.attempts ?? 0) + 1
  payload = {
    ...payload,
    retryCount,
    lastSyncAttemptAt: nowIso(),
    syncPhase: 'creating_check',
    mediaUploadState: 'uploading',
  }
  await persistPayload(item.id, payload)

  try {
    // Already completed remotely — cleanup only (crash after success before local remove).
    if (payload.createdVehicleCheckId) {
      setProgress({
        queueItemId: item.id,
        phase: 'verifying',
        percent: 90,
        label: 'Verifying uploaded Vehicle Check…',
      })
      const existing = await fetchVehicleCheckById(payload.createdVehicleCheckId)
      if (existing?.status === 'Completed') {
        setProgress({
          queueItemId: item.id,
          phase: 'cleanup',
          percent: 95,
          label: 'Removing local offline files…',
        })
        await cleanupQueueItemMedia(item.id)
        const completedAt = nowIso()
        writeLocalMeta(LAST_SYNC_STORAGE_KEY, completedAt)
        bumpRecentCompletedCount()
        emitOfflineVehicleCheckSyncProgress({
          lastSyncAt: completedAt,
          recentlyCompletedCount: readRecentCompletedCount(),
        })
        return { ok: true }
      }
    }

    setProgress({
      queueItemId: item.id,
      phase: 'uploading_photos',
      percent: 15,
      label: 'Preparing photos and signature…',
    })
    const hydrated = await hydrateCreateInput(payload)

    const photoCount = hydrated.items.filter((entry) => entry.photoFile).length
    setProgress({
      queueItemId: item.id,
      phase: photoCount > 0 ? 'uploading_photos' : 'uploading_signature',
      percent: 35,
      label:
        photoCount > 0
          ? `Uploading ${photoCount} photo${photoCount === 1 ? '' : 's'}…`
          : 'Uploading signature…',
    })

    const createInput = {
      vehicleId: payload.vehicleId,
      workerId: payload.workerId,
      inspectionDate: payload.inspectionDate,
      odometer: payload.odometer,
      odometerUnit: payload.odometerUnit,
      notes: payload.notes,
      signatureFile: hydrated.signatureFile,
      inspectionStartedAt: payload.inspectionStartedAt,
      items: hydrated.items,
      startedLocation: payload.startedLocation ?? null,
      completedLocation: payload.completedLocation ?? null,
    }

    let created
    if (payload.createdVehicleCheckId) {
      setProgress({
        queueItemId: item.id,
        phase: 'creating_check',
        percent: 55,
        label: 'Resuming Vehicle Check upload…',
      })
      created = await finalizeInProgressVehicleCheck(payload.createdVehicleCheckId, createInput)
    } else {
      setProgress({
        queueItemId: item.id,
        phase: 'creating_check',
        percent: 55,
        label: 'Creating completed Vehicle Check…',
      })
      created = await createVehicleCheck({
        ...createInput,
        onInserted: async (checkId) => {
          payload = {
            ...payload,
            createdVehicleCheckId: checkId,
            checkCreateState: 'creating',
            syncPhase: 'creating_check',
          }
          await persistPayload(item.id, payload)
        },
      })
    }

    setProgress({
      queueItemId: item.id,
      phase: 'verifying',
      percent: 85,
      label: 'Verifying sync…',
    })

    if (created.status !== 'Completed') {
      throw new Error('Vehicle Check sync did not complete.')
    }

    // Persist uploaded URLs from the completed record before local cleanup.
    const photoByKey = new Map(
      created.items.map((entry) => [`${entry.category}__${entry.itemName}`, entry.photoUrl]),
    )
    payload = {
      ...payload,
      createdVehicleCheckId: created.id,
      checkCreateState: 'created',
      mediaUploadState: 'uploaded',
      signatureUploadState: 'uploaded',
      uploadedSignatureUrl: created.signatureUrl,
      syncPhase: 'cleanup',
      items: payload.items.map((entry) => ({
        ...entry,
        uploadedPhotoUrl:
          photoByKey.get(`${entry.category}__${entry.itemName}`) ?? entry.uploadedPhotoUrl ?? null,
        photoUploadState: entry.localPhotoPath ? 'uploaded' : entry.photoUploadState,
      })),
    }
    await persistPayload(item.id, payload)

    setProgress({
      queueItemId: item.id,
      phase: 'cleanup',
      percent: 95,
      label: 'Removing local offline files…',
    })
    await cleanupQueueItemMedia(item.id)
    await cleanupOrphanedOfflineVehicleCheckMedia()

    const completedAt = nowIso()
    writeLocalMeta(LAST_SYNC_STORAGE_KEY, completedAt)
    bumpRecentCompletedCount()
    emitOfflineVehicleCheckSyncProgress({
      lastSyncAt: completedAt,
      recentlyCompletedCount: readRecentCompletedCount(),
      phase: 'idle',
      percent: 100,
      label: 'Sync complete',
      queueItemId: null,
    })

    return { ok: true }
  } catch (error) {
    const message = safeUploaderError(error)
    payload = {
      ...payload,
      mediaUploadState: 'failed',
      checkCreateState: payload.createdVehicleCheckId ? 'creating' : 'failed',
      syncPhase: 'idle',
      retryCount,
      lastSyncAttemptAt: nowIso(),
    }
    await persistPayload(item.id, payload, { lastError: message })
    setProgress({
      queueItemId: item.id,
      phase: 'idle',
      percent: null,
      label: 'Sync failed — will retry',
    })
    return { ok: false, error: message }
  }
}

/**
 * Persist a completed Vehicle Check locally for later sync (including photos + signature).
 * Does not call Supabase.
 */
export async function saveOfflineCheck(
  input: SaveOfflineVehicleCheckInput,
): Promise<OfflineVehicleCheckQueueItem> {
  ensureOfflineVehicleChecksSyncRegistered()

  if (!input.signatureFile) {
    throw new Error('Worker signature is required to save offline.')
  }

  const id = input.id?.trim() || createId()
  const savedAt = nowIso()
  const media = await persistLocalMedia(id, input.items, input.signatureFile)

  const payload: OfflineVehicleCheckPayload = {
    companyId: input.companyId,
    vehicleId: input.vehicleId,
    workerId: input.workerId,
    inspectionDate: input.inspectionDate,
    odometer: input.odometer,
    odometerUnit: input.odometerUnit,
    notes: input.notes ?? null,
    inspectionStartedAt: input.inspectionStartedAt,
    items: media.items,
    startedLocation: input.startedLocation ?? null,
    completedLocation: input.completedLocation ?? null,
    localSignaturePath: media.localSignaturePath,
    signatureMimeType: media.signatureMimeType,
    uploadedSignatureUrl: null,
    signatureUploadState: 'pending',
    mediaUploadState: 'pending',
    checkCreateState: 'pending',
    createdVehicleCheckId: null,
    savedAt,
    completedAtLocal: savedAt,
    lastSyncAttemptAt: null,
    syncPhase: 'idle',
    retryCount: 0,
  }

  return enqueueOfflineItem<OfflineVehicleCheckPayload>({
    module: OFFLINE_VEHICLE_CHECKS_MODULE,
    id,
    payload,
  })
}

export async function getPendingChecks(): Promise<OfflineVehicleCheckQueueItem[]> {
  return listOfflineItems<OfflineVehicleCheckPayload>(OFFLINE_VEHICLE_CHECKS_MODULE, [
    'pending',
    'syncing',
    'failed',
  ])
}

export async function getOfflineVehicleChecksQueueStats(): Promise<OfflineVehicleChecksQueueStats> {
  const items = await getPendingChecks()
  const progress = getOfflineVehicleCheckSyncProgress()
  let pending = 0
  let syncing = 0
  let uploading = 0
  let failed = 0

  for (const item of items) {
    if (item.status === 'pending') pending += 1
    else if (item.status === 'syncing') {
      syncing += 1
      if (
        item.payload.mediaUploadState === 'uploading' ||
        item.payload.syncPhase === 'uploading_photos' ||
        item.payload.syncPhase === 'uploading_signature'
      ) {
        uploading += 1
      }
    } else if (item.status === 'failed') failed += 1
  }

  return {
    total: items.length,
    pending,
    syncing,
    uploading: Math.max(uploading, progress.phase !== 'idle' && progress.queueItemId ? 1 : 0),
    failed,
    completed: readRecentCompletedCount(),
    isSyncing: offlineSyncManager.isModuleSyncing(OFFLINE_VEHICLE_CHECKS_MODULE),
    currentItemId: progress.queueItemId,
    currentPhase: progress.phase,
    progressPercent: progress.percent,
    progressLabel: progress.label,
    lastSyncAt: readLocalMeta(LAST_SYNC_STORAGE_KEY) ?? progress.lastSyncAt,
  }
}

export async function removePendingCheck(id: string): Promise<boolean> {
  await cleanupQueueItemMedia(id)
  return removeOfflineItem(OFFLINE_VEHICLE_CHECKS_MODULE, id)
}

export function ensureOfflineVehicleChecksSyncRegistered(): void {
  if (uploaderRegistered) return
  offlineSyncManager.registerUploader(OFFLINE_VEHICLE_CHECKS_MODULE, async (item) => {
    const latest = await getOfflineItem<OfflineVehicleCheckPayload>(
      OFFLINE_VEHICLE_CHECKS_MODULE,
      item.id,
    )
    if (!latest) {
      return { ok: false, error: 'Queued Vehicle Check no longer exists.' }
    }
    const payload = latest.payload
    if (!payload || typeof payload !== 'object') {
      return { ok: false, error: 'Invalid offline Vehicle Check payload.' }
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { ok: false, error: 'Offline Vehicle Check checklist is empty.' }
    }
    if (!payload.localSignaturePath) {
      return {
        ok: false,
        error: 'This offline check has no signature. Re-complete it while offline with a signature.',
      }
    }

    return syncOneQueuedCheck(latest)
  })
  uploaderRegistered = true
}

export async function syncOfflineVehicleChecks(): Promise<OfflineSyncModuleResult> {
  ensureOfflineVehicleChecksSyncRegistered()
  const online = await getOnlineStatus()
  if (!online) {
    return { attempted: 0, synced: 0, failed: 0, skipped: 0 }
  }

  void cleanupOrphanedOfflineVehicleCheckMedia()
  const result = await offlineSyncManager.syncModule(OFFLINE_VEHICLE_CHECKS_MODULE)
  setProgress({
    queueItemId: null,
    phase: 'idle',
    percent: null,
    label: result.synced > 0 ? 'Sync complete' : null,
  })
  return result
}

export async function startOfflineVehicleChecksAutoSync(): Promise<void> {
  ensureOfflineVehicleChecksSyncRegistered()
  void cleanupOrphanedOfflineVehicleCheckMedia()

  if (!autoSyncStarted) {
    autoSyncStarted = true
    try {
      autoSyncHandle = await addOnlineStatusListener((online) => {
        if (online) {
          void syncOfflineVehicleChecks()
        }
      })
    } catch {
      autoSyncHandle = null
    }
  }

  const online = await getOnlineStatus()
  if (online) {
    void syncOfflineVehicleChecks()
  }
}

export async function stopOfflineVehicleChecksAutoSync(): Promise<void> {
  if (!autoSyncHandle) return
  try {
    await autoSyncHandle.remove()
  } catch {
    // ignore
  }
  autoSyncHandle = null
  autoSyncStarted = false
}
