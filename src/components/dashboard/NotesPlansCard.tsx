import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { DashboardNote } from '@/lib/dashboardNoteTypes'
import {
  createDashboardNote,
  DashboardNotesServiceError,
  DashboardNotesTableMissingError,
  deleteDashboardNote,
  fetchDashboardNotes,
  toggleDashboardNoteDone,
  updateDashboardNote,
} from '@/services/dashboardNotesService'
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

function getNotesErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DashboardNotesTableMissingError) {
    if (import.meta.env.DEV) {
      return `${error.message} Then reload the dashboard.`
    }
    return 'Notes are temporarily unavailable.'
  }

  if (error instanceof DashboardNotesServiceError) {
    return error.message
  }

  return fallback
}

const notesPlansCardClass =
  'rounded-2xl border border-[#FDE68A]/80 bg-gradient-to-br from-[#FFF8E7]/98 to-[#FFF7D6]/95 shadow-sm shadow-[#FBBF24]/15 transition-all duration-[180ms] ease-out hover:-translate-y-[3px] hover:border-[#FBBF24]/75 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_18px_40px_rgba(245,158,11,0.16)] active:-translate-y-px active:scale-[0.99] active:shadow-[0_8px_20px_rgba(245,158,11,0.12)]'

function DeleteNoteDialog({
  note,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  note: DashboardNote
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[20px] border border-[#FDE68A]/80 bg-[#FFFBF0] p-5 shadow-[0_30px_80px_rgba(146,64,14,0.14)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dashboard-note-title"
      >
        <h2
          id="delete-dashboard-note-title"
          className="text-xl font-semibold leading-snug tracking-[-0.03em] text-[#113C69]"
        >
          Delete note?
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#92400E]/80">
          This reminder will be permanently removed.
        </p>
        <p className="mt-4 rounded-[14px] border border-[#FDE68A]/70 border-l-[3px] border-l-[#F59E0B] bg-[#FFFDF4] px-4 py-3 text-sm font-medium leading-snug text-[#113C69]">
          {note.note}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isDeleting} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? 'Deleting…' : 'Delete note'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NoteItem({
  note,
  formatDate,
  isBusy,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  note: DashboardNote
  formatDate: (value: string) => string
  isBusy: boolean
  onToggleDone: (note: DashboardNote) => void
  onEdit: (note: DashboardNote) => void
  onDelete: (note: DashboardNote) => void
}) {
  const isDone = note.status === 'done'

  return (
    <li
      className={[
        'group/note relative rounded-xl border border-l-[3px] px-3.5 py-3 shadow-sm transition-all duration-200',
        isDone
          ? 'border-[#E7E5E4]/80 border-l-[#A8A29E] bg-[#FAFAF9]/90 opacity-75'
          : 'border-[#FDE68A]/60 border-l-[#F59E0B] bg-[#FFFDF4] shadow-[#FBBF24]/10 hover:-translate-y-0.5 hover:border-[#FBBF24]/80 hover:bg-[#FFFBE8] hover:shadow-[0_8px_20px_rgba(245,158,11,0.12)] active:translate-y-0 active:scale-[0.995]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={isDone ? 'Mark note as open' : 'Mark note as done'}
          disabled={isBusy}
          onClick={() => onToggleDone(note)}
          className={[
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
            isDone
              ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
              : 'border-[#FCD34D]/80 bg-white text-transparent hover:border-[#F59E0B] group-hover/note:text-[#D97706]',
            isBusy ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={[
              'text-sm font-medium leading-snug text-[#113C69]',
              isDone ? 'line-through decoration-[#94A3B8]/70' : '',
            ].join(' ')}
          >
            {note.note}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]',
                isDone
                  ? 'bg-stone-100 text-stone-500 ring-1 ring-stone-200/80'
                  : 'bg-[#FEF3C7] text-[#B45309] ring-1 ring-[#FDE68A]/70',
              ].join(' ')}
            >
              {isDone ? 'Done' : 'Open'}
            </span>
            {note.dueDate ? (
              <span className="text-[11px] font-medium text-[#B45309]/80">
                Due {formatDate(note.dueDate)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/note:opacity-100">
          <button
            type="button"
            aria-label="Edit note"
            disabled={isBusy}
            onClick={() => onEdit(note)}
            className="flex size-7 items-center justify-center rounded-lg text-[#B45309]/80 transition-colors hover:bg-[#FEF3C7] hover:text-[#92400E] disabled:opacity-50"
          >
            <Pencil className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Delete note"
            disabled={isBusy}
            onClick={() => onDelete(note)}
            className="flex size-7 items-center justify-center rounded-lg text-[#B45309]/80 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  )
}

export function NotesPlansCard() {
  const { settings, formatDate } = useCompanySettings()
  const { session } = useAuth()
  const companyId = settings?.id

  const [notes, setNotes] = useState<DashboardNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null)
  const [isSavingNew, setIsSavingNew] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [editingNote, setEditingNote] = useState<DashboardNote | null>(null)
  const [editText, setEditText] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DashboardNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!companyId) {
      setNotes([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const rows = await fetchDashboardNotes(companyId)
      setNotes(rows)
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to load notes.'))
      setNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  async function handleCreateNote() {
    if (!companyId) return

    const text = newNoteText.trim()
    if (!text) return

    setIsSavingNew(true)
    setLoadError(null)

    try {
      const created = await createDashboardNote({
        companyId,
        createdBy: session?.user.id ?? null,
        note: text,
      })
      setNotes((current) =>
        [...current, created].sort((first, second) => {
          if (first.status !== second.status) {
            return first.status === 'open' ? -1 : 1
          }
          return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
        }),
      )
      setNewNoteText('')
      setIsAdding(false)
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to save note.'))
    } finally {
      setIsSavingNew(false)
    }
  }

  async function handleSaveEdit() {
    if (!editingNote || !companyId) return

    const text = editText.trim()
    if (!text) return

    setIsSavingEdit(true)
    setLoadError(null)

    try {
      const updated = await updateDashboardNote(editingNote.id, companyId, { note: text })
      setNotes((current) =>
        current
          .map((row) => (row.id === updated.id ? updated : row))
          .sort((first, second) => {
            if (first.status !== second.status) {
              return first.status === 'open' ? -1 : 1
            }
            return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
          }),
      )
      setEditingNote(null)
      setEditText('')
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to update note.'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleToggleDone(note: DashboardNote) {
    if (!companyId) return

    setBusyNoteId(note.id)
    setLoadError(null)

    try {
      const updated = await toggleDashboardNoteDone(note)
      setNotes((current) =>
        current
          .map((row) => (row.id === updated.id ? updated : row))
          .sort((first, second) => {
            if (first.status !== second.status) {
              return first.status === 'open' ? -1 : 1
            }
            return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
          }),
      )
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to update note status.'))
    } finally {
      setBusyNoteId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || !companyId) return

    setIsDeleting(true)
    setLoadError(null)

    try {
      await deleteDashboardNote(deleteTarget.id, companyId)
      setNotes((current) => current.filter((row) => row.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to delete note.'))
    } finally {
      setIsDeleting(false)
    }
  }

  function startEdit(note: DashboardNote) {
    setEditingNote(note)
    setEditText(note.note)
    setIsAdding(false)
  }

  return (
    <>
      <section className={`${notesPlansCardClass} p-5`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] ring-1 ring-[#FDE68A]/80">
                <StickyNote className="size-4 text-[#D97706]" strokeWidth={2.1} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#113C69]">
                  Notes / Plans
                </h3>
                <p className="mt-0.5 text-xs text-[#92400E]/75">
                  Quick reminders for your operation
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAdding((value) => !value)
              setEditingNote(null)
              setEditText('')
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#FCD34D]/80 bg-[#FFFBEB] px-2.5 py-1.5 text-xs font-semibold text-[#B45309] shadow-sm shadow-[#FBBF24]/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FBBF24] hover:bg-[#FEF3C7] hover:shadow-[0_6px_16px_rgba(245,158,11,0.14)] active:translate-y-0 active:scale-[0.98]"
          >
            <Plus className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            Add note
          </button>
        </div>

        {isAdding ? (
          <div className="mb-4 rounded-xl border border-[#FDE68A]/70 border-l-[3px] border-l-[#F59E0B] bg-[#FFFDF4] p-3 shadow-sm">
            <textarea
              value={newNoteText}
              onChange={(event) => setNewNoteText(event.target.value)}
              rows={3}
              placeholder="Write a quick reminder…"
              className="w-full resize-none rounded-lg border border-[#FDE68A]/60 bg-white/95 px-3 py-2 text-sm text-[#113C69] outline-none placeholder:text-[#B45309]/45 focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FDE68A]/50"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSavingNew}
                onClick={() => {
                  setIsAdding(false)
                  setNewNoteText('')
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#B45309]/80 hover:bg-[#FEF3C7]/80"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingNew || !newNoteText.trim()}
                onClick={() => void handleCreateNote()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#FBBF24]/25 transition-colors hover:bg-[#D97706] disabled:opacity-50"
              >
                {isSavingNew ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Save note'
                )}
              </button>
            </div>
          </div>
        ) : null}

        {loadError ? (
          <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {loadError}
          </p>
        ) : null}

        <div className="max-md:max-h-none max-md:overflow-visible md:max-h-[320px] md:overflow-y-auto md:pr-1">
          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl border border-[#FDE68A]/50 bg-[#FEF3C7]/40"
                />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#FCD34D]/70 bg-[#FFFDF4]/90 px-4 py-8 text-center">
              <p className="text-sm font-medium text-[#92400E]/75">
                No notes yet. Add your first plan.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {notes.map((note) =>
                editingNote?.id === note.id ? (
                  <li
                    key={note.id}
                    className="rounded-xl border border-[#FDE68A]/70 border-l-[3px] border-l-[#F59E0B] bg-[#FFFDF4] p-3 shadow-sm"
                  >
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[#FDE68A]/60 bg-white/95 px-3 py-2 text-sm text-[#113C69] outline-none focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FDE68A]/50"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => {
                          setEditingNote(null)
                          setEditText('')
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#B45309]/80 hover:bg-[#FEF3C7]/80"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingEdit || !editText.trim()}
                        onClick={() => void handleSaveEdit()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#FBBF24]/25 transition-colors hover:bg-[#D97706] disabled:opacity-50"
                      >
                        {isSavingEdit ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            Saving…
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                  </li>
                ) : (
                  <NoteItem
                    key={note.id}
                    note={note}
                    formatDate={formatDate}
                    isBusy={busyNoteId === note.id}
                    onToggleDone={(row) => void handleToggleDone(row)}
                    onEdit={startEdit}
                    onDelete={setDeleteTarget}
                  />
                ),
              )}
            </ul>
          )}
        </div>
      </section>

      {deleteTarget ? (
        <DeleteNoteDialog
          note={deleteTarget}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) setDeleteTarget(null)
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </>
  )
}
