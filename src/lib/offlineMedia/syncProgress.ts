export type OfflineVehicleCheckSyncPhase =
  | 'idle'
  | 'uploading_photos'
  | 'uploading_signature'
  | 'creating_check'
  | 'verifying'
  | 'cleanup'

export type OfflineVehicleCheckSyncProgress = {
  queueItemId: string | null
  phase: OfflineVehicleCheckSyncPhase
  /** 0–100 when known; null when indeterminate */
  percent: number | null
  label: string | null
  lastSyncAt: string | null
  recentlyCompletedCount: number
}

const EVENT = 'drevora-offline-vehicle-check-sync-progress'

let currentProgress: OfflineVehicleCheckSyncProgress = {
  queueItemId: null,
  phase: 'idle',
  percent: null,
  label: null,
  lastSyncAt: null,
  recentlyCompletedCount: 0,
}

export function getOfflineVehicleCheckSyncProgress(): OfflineVehicleCheckSyncProgress {
  return { ...currentProgress }
}

export function emitOfflineVehicleCheckSyncProgress(
  patch: Partial<OfflineVehicleCheckSyncProgress>,
): void {
  currentProgress = { ...currentProgress, ...patch }
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<OfflineVehicleCheckSyncProgress>(EVENT, {
      detail: { ...currentProgress },
    }),
  )
}

export function subscribeOfflineVehicleCheckSyncProgress(
  listener: (progress: OfflineVehicleCheckSyncProgress) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  function handle(event: Event) {
    const custom = event as CustomEvent<OfflineVehicleCheckSyncProgress>
    if (custom.detail) listener({ ...custom.detail })
  }

  window.addEventListener(EVENT, handle)
  return () => window.removeEventListener(EVENT, handle)
}
