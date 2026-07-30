import {
  listOfflineItems,
  removeOfflineItem,
  updateOfflineItemStatus,
} from '@/lib/offlineQueue/queueService'
import { emitOfflineQueueChanged } from '@/lib/offlineQueue/events'
import type { OfflineQueueItem, OfflineQueueStatus } from '@/lib/offlineQueue/types'

export type OfflineSyncUploader = (
  item: OfflineQueueItem,
) => Promise<{ ok: true } | { ok: false; error: string }>

export type OfflineSyncModuleResult = {
  attempted: number
  synced: number
  failed: number
  skipped: number
}

const SYNCABLE_STATUSES: OfflineQueueStatus[] = ['pending', 'failed']

function sanitizeSyncError(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  if (!trimmed) return 'Sync failed.'
  // Avoid leaking tokens / long payloads into local queue storage or UI.
  return trimmed.slice(0, 180)
}

/**
 * Offline queue sync manager.
 * One in-flight sync per module; items move pending/failed → syncing → removed (synced) or failed.
 */
export class OfflineSyncManager {
  private uploaders = new Map<string, OfflineSyncUploader>()
  private inFlight = new Set<string>()
  private syncingModules = new Set<string>()

  registerUploader(module: string, uploader: OfflineSyncUploader): void {
    this.uploaders.set(module, uploader)
  }

  unregisterUploader(module: string): void {
    this.uploaders.delete(module)
  }

  hasUploader(module: string): boolean {
    return this.uploaders.has(module)
  }

  isModuleSyncing(module: string): boolean {
    return this.syncingModules.has(module)
  }

  /**
   * Reset items left in `syncing` after a crash/kill so they can retry.
   */
  async resetStaleSyncingItems(module: string): Promise<number> {
    const stale = await listOfflineItems(module, ['syncing'])
    for (const item of stale) {
      await updateOfflineItemStatus(module, item.id, 'pending', {
        lastError: 'Previous sync interrupted. Ready to retry.',
      })
    }
    return stale.length
  }

  async syncModule(module: string): Promise<OfflineSyncModuleResult> {
    if (this.inFlight.has(module)) {
      return { attempted: 0, synced: 0, failed: 0, skipped: 0 }
    }

    const uploader = this.uploaders.get(module)
    if (!uploader) {
      const pending = await listOfflineItems(module, SYNCABLE_STATUSES)
      return { attempted: 0, synced: 0, failed: 0, skipped: pending.length }
    }

    this.inFlight.add(module)
    this.syncingModules.add(module)
    emitOfflineQueueChanged(module)

    let attempted = 0
    let synced = 0
    let failed = 0
    let skipped = 0

    try {
      await this.resetStaleSyncingItems(module)

      const items = await listOfflineItems(module, SYNCABLE_STATUSES)
      // Stable order: oldest first.
      const ordered = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      for (const item of ordered) {
        // Re-read status to prevent duplicate submission of the same queued check.
        const latest = (await listOfflineItems(module)).find((row) => row.id === item.id)
        if (!latest) {
          skipped += 1
          continue
        }
        if (latest.status === 'syncing' || latest.status === 'synced') {
          skipped += 1
          continue
        }
        if (latest.status !== 'pending' && latest.status !== 'failed') {
          skipped += 1
          continue
        }

        attempted += 1
        const marked = await updateOfflineItemStatus(module, latest.id, 'syncing', {
          bumpAttempts: true,
          lastError: null,
        })
        if (!marked || marked.status !== 'syncing') {
          skipped += 1
          continue
        }

        try {
          const result = await uploader(latest)
          if (result.ok) {
            await updateOfflineItemStatus(module, latest.id, 'synced', { lastError: null })
            await removeOfflineItem(module, latest.id)
            synced += 1
          } else {
            await updateOfflineItemStatus(module, latest.id, 'failed', {
              lastError: sanitizeSyncError(result.error),
            })
            failed += 1
          }
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Sync failed.'
          await updateOfflineItemStatus(module, latest.id, 'failed', {
            lastError: sanitizeSyncError(message),
          })
          failed += 1
        }
      }
    } finally {
      this.inFlight.delete(module)
      this.syncingModules.delete(module)
      emitOfflineQueueChanged(module)
    }

    return { attempted, synced, failed, skipped }
  }

  async syncAll(modules: string[]): Promise<OfflineSyncModuleResult[]> {
    const results: OfflineSyncModuleResult[] = []
    for (const moduleName of modules) {
      results.push(await this.syncModule(moduleName))
    }
    return results
  }
}

/** Shared process-local sync manager instance. */
export const offlineSyncManager = new OfflineSyncManager()
