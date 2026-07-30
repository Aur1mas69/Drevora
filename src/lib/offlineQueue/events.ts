const OFFLINE_QUEUE_CHANGED_EVENT = 'drevora-offline-queue-changed'

type OfflineQueueChangedDetail = {
  module: string
}

/**
 * Notify listeners that a module's local offline queue changed.
 * Used so UI badges can refresh without polling.
 */
export function emitOfflineQueueChanged(module: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<OfflineQueueChangedDetail>(OFFLINE_QUEUE_CHANGED_EVENT, {
      detail: { module },
    }),
  )
}

export function subscribeOfflineQueueChanged(
  listener: (module: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  function handle(event: Event) {
    const custom = event as CustomEvent<OfflineQueueChangedDetail>
    const moduleName = custom.detail?.module
    if (typeof moduleName === 'string' && moduleName) {
      listener(moduleName)
    }
  }

  window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handle)
  return () => window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handle)
}
