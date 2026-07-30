import { listOfflineItems } from '@/lib/offlineQueue/queueService'
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

/**
 * Skeleton sync manager for offline queues.
 *
 * Registers optional per-module uploaders for future use, but does not perform
 * uploads yet. Calling syncModule / syncAll only inspects the local queue.
 */
export class OfflineSyncManager {
  private uploaders = new Map<string, OfflineSyncUploader>()

  registerUploader(module: string, uploader: OfflineSyncUploader): void {
    this.uploaders.set(module, uploader)
  }

  unregisterUploader(module: string): void {
    this.uploaders.delete(module)
  }

  hasUploader(module: string): boolean {
    return this.uploaders.has(module)
  }

  /**
   * Skeleton entry point. Counts pending local items and returns without uploading.
   */
  async syncModule(module: string): Promise<OfflineSyncModuleResult> {
    const pending = await listOfflineItems(module, [
      'pending',
      'failed',
    ] as OfflineQueueStatus[])
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      skipped: pending.length,
    }
  }

  /** Reserved multi-module flush — no upload behaviour yet. */
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
