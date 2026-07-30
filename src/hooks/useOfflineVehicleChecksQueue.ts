import { subscribeOfflineQueueChanged } from '@/lib/offlineQueue'
import {
  getOfflineVehicleCheckSyncProgress,
  subscribeOfflineVehicleCheckSyncProgress,
} from '@/lib/offlineMedia/syncProgress'
import {
  getOfflineVehicleChecksQueueStats,
  OFFLINE_VEHICLE_CHECKS_MODULE,
  syncOfflineVehicleChecks,
  type OfflineVehicleChecksQueueStats,
} from '@/services/offlineVehicleChecksService'
import { useEffect, useState } from 'react'

const EMPTY_STATS: OfflineVehicleChecksQueueStats = {
  total: 0,
  pending: 0,
  syncing: 0,
  uploading: 0,
  failed: 0,
  completed: 0,
  isSyncing: false,
  currentItemId: null,
  currentPhase: 'idle',
  progressPercent: null,
  progressLabel: null,
  lastSyncAt: null,
}

/**
 * Live offline Vehicle Checks queue stats for Worker UI.
 * Refreshes when the queue or sync progress changes.
 */
export function useOfflineVehicleChecksQueue(): OfflineVehicleChecksQueueStats & {
  retrySync: () => Promise<void>
} {
  const [stats, setStats] = useState<OfflineVehicleChecksQueueStats>(() => ({
    ...EMPTY_STATS,
    ...getOfflineVehicleCheckSyncProgress(),
    lastSyncAt: getOfflineVehicleCheckSyncProgress().lastSyncAt,
  }))

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const next = await getOfflineVehicleChecksQueueStats()
        if (!cancelled) setStats(next)
      } catch {
        if (!cancelled) setStats(EMPTY_STATS)
      }
    }

    void refresh()

    const unsubscribeQueue = subscribeOfflineQueueChanged((module) => {
      if (module === OFFLINE_VEHICLE_CHECKS_MODULE) {
        void refresh()
      }
    })

    const unsubscribeProgress = subscribeOfflineVehicleCheckSyncProgress(() => {
      void refresh()
    })

    return () => {
      cancelled = true
      unsubscribeQueue()
      unsubscribeProgress()
    }
  }, [])

  return {
    ...stats,
    retrySync: async () => {
      await syncOfflineVehicleChecks()
    },
  }
}

/** @deprecated Prefer useOfflineVehicleChecksQueue for full stats. */
export function useOfflineVehicleChecksPendingCount(): number {
  return useOfflineVehicleChecksQueue().total
}
