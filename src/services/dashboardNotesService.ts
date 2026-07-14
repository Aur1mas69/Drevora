import type {
  CreateDashboardNoteInput,
  DashboardNote,
  DashboardNoteStatus,
  UpdateDashboardNoteInput,
} from '@/lib/dashboardNoteTypes'
import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

type DashboardNoteRow = {
  id: string
  company_id: string
  created_by: string | null
  note: string
  status: string
  priority: string | null
  due_date: string | null
  created_at: string
  updated_at: string
}

export class DashboardNotesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DashboardNotesServiceError'
  }
}

export class DashboardNotesTableMissingError extends DashboardNotesServiceError {
  constructor() {
    super(
      "The dashboard_notes table is not available. Run supabase/migrations/20260705220000_create_dashboard_notes_table.sql on your Supabase project.",
    )
    this.name = 'DashboardNotesTableMissingError'
  }
}

function isMissingDashboardNotesTableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('dashboard_notes') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find the table') ||
      normalized.includes('schema cache'))
  )
}

function rethrowDashboardNotesError(error: { message: string }): never {
  if (isMissingDashboardNotesTableError(error.message)) {
    throw new DashboardNotesTableMissingError()
  }

  throw new DashboardNotesServiceError(error.message)
}

function normalizeStatus(value: string): DashboardNoteStatus {
  return value === 'done' ? 'done' : 'open'
}

function mapRow(row: DashboardNoteRow): DashboardNote {
  return {
    id: row.id,
    companyId: row.company_id,
    createdBy: row.created_by,
    note: row.note,
    status: normalizeStatus(row.status),
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sortDashboardNotes(notes: DashboardNote[]): DashboardNote[] {
  return [...notes].sort((first, second) => {
    if (first.status !== second.status) {
      return first.status === 'open' ? -1 : 1
    }

    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  })
}

function requireMatchingCompanyId(companyId: string, verifiedId: string): void {
  if (companyId !== verifiedId) {
    throw new DashboardNotesServiceError(
      'The requested company does not match your verified company membership.',
    )
  }
}

export async function fetchDashboardNotes(companyId: string): Promise<DashboardNote[]> {
  const verifiedId = requireVerifiedCompanyId()
  requireMatchingCompanyId(companyId, verifiedId)

  const { data, error } = await requireSupabase()
    .from('dashboard_notes')
    .select(
      'id, company_id, created_by, note, status, priority, due_date, created_at, updated_at',
    )
    .eq('company_id', verifiedId)
    .order('updated_at', { ascending: false })

  logSupabaseQuery({
    service: 'dashboardNotesService.fetchDashboardNotes',
    table: 'dashboard_notes',
    data,
    error,
  })

  if (error) {
    rethrowDashboardNotesError(error)
  }

  return sortDashboardNotes((data ?? []).map((row) => mapRow(row as DashboardNoteRow)))
}

export async function createDashboardNote(
  input: CreateDashboardNoteInput,
): Promise<DashboardNote> {
  const verifiedId = requireVerifiedCompanyId()
  requireMatchingCompanyId(input.companyId, verifiedId)

  const note = input.note.trim()
  if (!note) {
    throw new DashboardNotesServiceError('Note text is required.')
  }

  const { data, error } = await requireSupabase()
    .from('dashboard_notes')
    .insert({
      company_id: verifiedId,
      created_by: input.createdBy ?? null,
      note,
      due_date: input.dueDate ?? null,
      status: 'open',
    })
    .select(
      'id, company_id, created_by, note, status, priority, due_date, created_at, updated_at',
    )
    .single()

  logSupabaseQuery({
    service: 'dashboardNotesService.createDashboardNote',
    table: 'dashboard_notes',
    data: data ? [data] : null,
    error,
  })

  if (error) {
    rethrowDashboardNotesError(error)
  }

  return mapRow(data as DashboardNoteRow)
}

export async function updateDashboardNote(
  id: string,
  companyId: string,
  input: UpdateDashboardNoteInput,
): Promise<DashboardNote> {
  const verifiedId = requireVerifiedCompanyId()
  requireMatchingCompanyId(companyId, verifiedId)

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.note !== undefined) {
    const note = input.note.trim()
    if (!note) {
      throw new DashboardNotesServiceError('Note text is required.')
    }
    patch.note = note
  }

  if (input.status !== undefined) {
    patch.status = input.status
  }

  if (input.dueDate !== undefined) {
    patch.due_date = input.dueDate
  }

  if (input.priority !== undefined) {
    patch.priority = input.priority
  }

  const { data, error } = await requireSupabase()
    .from('dashboard_notes')
    .update(patch)
    .eq('id', id)
    .eq('company_id', verifiedId)
    .select(
      'id, company_id, created_by, note, status, priority, due_date, created_at, updated_at',
    )
    .maybeSingle()

  logSupabaseQuery({
    service: 'dashboardNotesService.updateDashboardNote',
    table: 'dashboard_notes',
    data: data ? [data] : null,
    error,
  })

  if (error) {
    rethrowDashboardNotesError(error)
  }

  if (!data) {
    throw new DashboardNotesServiceError('Dashboard note was not found for your company.')
  }

  return mapRow(data as DashboardNoteRow)
}

export async function deleteDashboardNote(id: string, companyId: string): Promise<void> {
  const verifiedId = requireVerifiedCompanyId()
  requireMatchingCompanyId(companyId, verifiedId)

  const { data, error } = await requireSupabase()
    .from('dashboard_notes')
    .delete()
    .eq('id', id)
    .eq('company_id', verifiedId)
    .select('id')
    .maybeSingle()

  logSupabaseQuery({
    service: 'dashboardNotesService.deleteDashboardNote',
    table: 'dashboard_notes',
    data: data ? [data] : null,
    error,
  })

  if (error) {
    rethrowDashboardNotesError(error)
  }

  if (!data) {
    throw new DashboardNotesServiceError('Dashboard note was not found for your company.')
  }
}

export async function toggleDashboardNoteDone(
  note: DashboardNote,
): Promise<DashboardNote> {
  return updateDashboardNote(note.id, note.companyId, {
    status: note.status === 'done' ? 'open' : 'done',
  })
}

export const dashboardNotesService = {
  fetchDashboardNotes,
  createDashboardNote,
  updateDashboardNote,
  deleteDashboardNote,
  toggleDashboardNoteDone,
}
