import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  sortWorkerPrivateNotes,
  validateWorkerPrivateNoteContent,
  validateWorkerPrivateNoteTitle,
  type WorkerPrivateNote,
} from '@/lib/workerPrivateNotes'

type WorkerPrivateNoteRow = {
  id: string
  company_id: string
  driver_id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

const noteSelect =
  'id, company_id, driver_id, title, content, is_pinned, created_at, updated_at'

export class WorkerPrivateNotesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerPrivateNotesServiceError'
  }
}

function mapRow(row: WorkerPrivateNoteRow): WorkerPrivateNote {
  return {
    id: row.id,
    companyId: row.company_id,
    driverId: row.driver_id,
    title: row.title,
    content: row.content,
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function missingTableMessage(message: string | undefined): boolean {
  return /Could not find the table|relation .*worker_private_notes/i.test(
    message ?? '',
  )
}

function throwMappedError(error: { message?: string }, fallback: string): never {
  if (missingTableMessage(error.message)) {
    throw new WorkerPrivateNotesServiceError(
      'Notes are not available yet. Ask DREVORA support to apply the latest database migration.',
    )
  }
  throw new WorkerPrivateNotesServiceError(error.message?.trim() || fallback)
}

/**
 * List the signed-in Worker’s private notes.
 * RLS enforces own driver_id; company_id comes from verified membership only.
 */
export async function fetchOwnWorkerPrivateNotes(
  driverId: string,
): Promise<WorkerPrivateNote[]> {
  const companyId = requireVerifiedCompanyId()
  const trimmedDriverId = driverId.trim()
  if (!trimmedDriverId) {
    throw new WorkerPrivateNotesServiceError('Worker profile is required.')
  }

  const { data, error } = await requireSupabase()
    .from('worker_private_notes')
    .select(noteSelect)
    .eq('company_id', companyId)
    .eq('driver_id', trimmedDriverId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  logSupabaseQuery({
    service: 'workerPrivateNotesService.fetchOwnWorkerPrivateNotes',
    table: 'worker_private_notes',
    data,
    error,
  })

  if (error) {
    throwMappedError(error, 'Unable to load notes.')
  }

  const mapped = ((data ?? []) as WorkerPrivateNoteRow[]).map(mapRow)
  // Client sort mirrors DB intent (pinned first, then updated_at desc).
  return sortWorkerPrivateNotes(mapped)
}

export async function createWorkerPrivateNote(input: {
  driverId: string
  title: string
  content: string
  isPinned?: boolean
}): Promise<WorkerPrivateNote> {
  const companyId = requireVerifiedCompanyId()
  const driverId = input.driverId.trim()
  if (!driverId) {
    throw new WorkerPrivateNotesServiceError('Worker profile is required.')
  }

  const titleError = validateWorkerPrivateNoteTitle(input.title)
  if (titleError) throw new WorkerPrivateNotesServiceError(titleError)
  const contentError = validateWorkerPrivateNoteContent(input.content)
  if (contentError) throw new WorkerPrivateNotesServiceError(contentError)

  const payload = {
    company_id: companyId,
    driver_id: driverId,
    title: input.title.trim(),
    content: input.content.trim(),
    is_pinned: Boolean(input.isPinned),
  }

  const { data, error } = await requireSupabase()
    .from('worker_private_notes')
    .insert(payload)
    .select(noteSelect)
    .single()

  logSupabaseQuery({
    service: 'workerPrivateNotesService.createWorkerPrivateNote',
    table: 'worker_private_notes',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throwMappedError(error, 'Unable to save note.')
  }

  return mapRow(data as WorkerPrivateNoteRow)
}

export async function updateWorkerPrivateNote(input: {
  id: string
  title: string
  content: string
}): Promise<WorkerPrivateNote> {
  requireVerifiedCompanyId()
  const id = input.id.trim()
  if (!id) {
    throw new WorkerPrivateNotesServiceError('Note id is required.')
  }

  const titleError = validateWorkerPrivateNoteTitle(input.title)
  if (titleError) throw new WorkerPrivateNotesServiceError(titleError)
  const contentError = validateWorkerPrivateNoteContent(input.content)
  if (contentError) throw new WorkerPrivateNotesServiceError(contentError)

  const { data, error } = await requireSupabase()
    .from('worker_private_notes')
    .update({
      title: input.title.trim(),
      content: input.content.trim(),
    })
    .eq('id', id)
    .select(noteSelect)
    .single()

  logSupabaseQuery({
    service: 'workerPrivateNotesService.updateWorkerPrivateNote',
    table: 'worker_private_notes',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throwMappedError(error, 'Unable to update note.')
  }

  return mapRow(data as WorkerPrivateNoteRow)
}

export async function setWorkerPrivateNotePinned(
  id: string,
  isPinned: boolean,
): Promise<WorkerPrivateNote> {
  requireVerifiedCompanyId()
  const noteId = id.trim()
  if (!noteId) {
    throw new WorkerPrivateNotesServiceError('Note id is required.')
  }

  const { data, error } = await requireSupabase()
    .from('worker_private_notes')
    .update({ is_pinned: Boolean(isPinned) })
    .eq('id', noteId)
    .select(noteSelect)
    .single()

  logSupabaseQuery({
    service: 'workerPrivateNotesService.setWorkerPrivateNotePinned',
    table: 'worker_private_notes',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throwMappedError(error, 'Unable to update pin.')
  }

  return mapRow(data as WorkerPrivateNoteRow)
}

export async function deleteWorkerPrivateNote(id: string): Promise<void> {
  requireVerifiedCompanyId()
  const noteId = id.trim()
  if (!noteId) {
    throw new WorkerPrivateNotesServiceError('Note id is required.')
  }

  const { data, error } = await requireSupabase()
    .from('worker_private_notes')
    .delete()
    .eq('id', noteId)
    .select('id')

  logSupabaseQuery({
    service: 'workerPrivateNotesService.deleteWorkerPrivateNote',
    table: 'worker_private_notes',
    data,
    error,
  })

  if (error) {
    throwMappedError(error, 'Unable to delete note.')
  }

  if (!data || data.length === 0) {
    throw new WorkerPrivateNotesServiceError(
      'Note was not found or could not be deleted.',
    )
  }
}

export const workerPrivateNotesService = {
  fetchOwnWorkerPrivateNotes,
  createWorkerPrivateNote,
  updateWorkerPrivateNote,
  setWorkerPrivateNotePinned,
  deleteWorkerPrivateNote,
}
