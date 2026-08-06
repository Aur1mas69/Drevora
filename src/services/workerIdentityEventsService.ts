/**
 * Admin Worker Identity & Access History — list via SECURITY DEFINER RPC only.
 * Never queries auth.users or mutates worker_identity_events from the browser.
 */
import { requireSupabase } from '@/lib/supabase'
import {
  formatWorkerIdentityHistoryError,
  mapWorkerIdentityEventRow,
  sortWorkerIdentityEventsNewestFirst,
  type WorkerIdentityEvent,
} from '@/lib/workerIdentityEvents'

export class WorkerIdentityEventsServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'WorkerIdentityEventsServiceError'
    this.code = code
  }
}

function mapRpcError(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? ''
  const upper = message.toUpperCase()
  let code = 'server_failure'
  if (upper.includes('UNAUTHENTICATED')) code = 'UNAUTHENTICATED'
  else if (upper.includes('FORBIDDEN')) code = 'FORBIDDEN'
  else if (upper.includes('WORKER_NOT_FOUND')) code = 'WORKER_NOT_FOUND'
  throw new WorkerIdentityEventsServiceError(
    code,
    formatWorkerIdentityHistoryError(message),
  )
}

/**
 * List safe identity/access events for one Worker.
 * Passes only workerId (driver id). Never sends companyId.
 */
export async function listWorkerIdentityEvents(
  workerId: string,
): Promise<WorkerIdentityEvent[]> {
  const id = workerId.trim()
  if (!id) {
    throw new WorkerIdentityEventsServiceError(
      'WORKER_NOT_FOUND',
      formatWorkerIdentityHistoryError('WORKER_NOT_FOUND'),
    )
  }

  const { data, error } = await requireSupabase().rpc(
    'drevora_list_worker_identity_events',
    { p_driver_id: id },
  )

  if (error) {
    mapRpcError(error)
  }

  const rows = Array.isArray(data) ? data : []
  const mapped: WorkerIdentityEvent[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const event = mapWorkerIdentityEventRow(row as Record<string, unknown>)
    if (event) mapped.push(event)
  }

  return sortWorkerIdentityEventsNewestFirst(mapped)
}
