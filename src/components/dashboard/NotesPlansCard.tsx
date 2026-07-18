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
  CircleAlert,
  Eye,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PREVIEW_OPEN_LIMIT = 2

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

function sortNotes(rows: DashboardNote[]): DashboardNote[] {
  return [...rows].sort((first, second) => {
    if (first.status !== second.status) {
      return first.status === 'open' ? -1 : 1
    }
    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  })
}

const notesPlansCardClass =
  'relative overflow-visible rounded-[18px] border border-[#FDA4AF]/70 bg-[linear-gradient(145deg,rgba(255,251,251,0.98)_0%,rgba(255,241,242,0.96)_45%,rgba(255,228,230,0.92)_100%)] p-3.5 shadow-[0_8px_22px_rgba(244,63,94,0.10)] transition-all duration-[200ms] ease-out hover:-translate-y-[2px] hover:border-[#FB7185]/80 hover:shadow-[0_12px_28px_rgba(244,63,94,0.14)] active:-translate-y-px active:scale-[0.99] dark:border-rose-900/45 dark:bg-[linear-gradient(145deg,rgba(30,41,59,0.97)_0%,rgba(22,32,52,0.98)_52%,rgba(55,25,35,0.42)_100%)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.35)] dark:hover:border-rose-700/50 dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.42)] sm:p-4'

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[20px] border border-[#FECDD3] bg-[#FFFBFB] p-5 shadow-[0_30px_80px_rgba(190,18,60,0.14)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dashboard-note-title"
      >
        <h2
          id="delete-dashboard-note-title"
          className="text-xl font-semibold leading-snug tracking-[-0.03em] text-[#163A63] dark:text-slate-100"
        >
          Delete note?
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#9F1239]/75 dark:text-slate-400">
          This reminder will be permanently removed.
        </p>
        <p className="mt-4 rounded-[14px] border border-[#FECDD3] border-l-[3px] border-l-[#F43F5E] bg-[#FFF1F2] px-4 py-3 text-sm font-medium leading-snug text-[#163A63] dark:border-white/10 dark:border-l-rose-500 dark:bg-slate-800/60 dark:text-slate-100">
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

function CompactNotePreview({
  note,
  isBusy,
  onOpen,
  onToggleDone,
  onDelete,
}: {
  note: DashboardNote
  isBusy: boolean
  onOpen: (note: DashboardNote) => void
  onToggleDone: (note: DashboardNote) => void
  onDelete: (note: DashboardNote) => void
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(note)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(note)
          }
        }}
        className="group/note relative flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-[#FECDD3]/80 border-l-[3px] border-l-[#F43F5E] bg-[#FFF1F2]/90 px-2.5 py-2 text-left shadow-[0_2px_8px_rgba(244,63,94,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FB7185]/70 hover:bg-[#FFE4E6]/90 hover:shadow-[0_8px_18px_rgba(244,63,94,0.10)] dark:border-white/10 dark:border-l-rose-500 dark:bg-slate-800/60 dark:hover:bg-slate-800/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.25)]"
      >
        <button
          type="button"
          aria-label="Mark note as done"
          disabled={isBusy}
          onClick={(event) => {
            event.stopPropagation()
            onToggleDone(note)
          }}
          className={[
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-[#FDA4AF]/80 bg-white text-transparent transition-colors hover:border-[#F43F5E] group-hover/note:text-[#E11D48] dark:border-white/10 dark:bg-slate-900/70 dark:group-hover/note:text-rose-400',
            isBusy ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
        </button>

        <p className="min-w-0 flex-1 line-clamp-2 text-[13px] font-medium leading-snug text-[#163A63] dark:text-slate-100">
          {note.note}
        </p>

        <button
          type="button"
          aria-label="Delete note"
          disabled={isBusy}
          onClick={(event) => {
            event.stopPropagation()
            onDelete(note)
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#9F1239]/70 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-rose-400/70 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
        >
          <Trash2 className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

function NotesPlansModal({
  notes,
  openCount,
  focusedNoteId,
  formatDateTime,
  busyNoteId,
  editingNote,
  editText,
  isSavingEdit,
  isAdding,
  newNoteText,
  isSavingNew,
  onClose,
  onToggleDone,
  onDelete,
  onStartEdit,
  onEditTextChange,
  onCancelEdit,
  onSaveEdit,
  onFocusNote,
  onToggleAdding,
  onNewNoteTextChange,
  onCreateNote,
  onCancelAdding,
}: {
  notes: DashboardNote[]
  openCount: number
  focusedNoteId: string | null
  formatDateTime: (value: string) => string
  busyNoteId: string | null
  editingNote: DashboardNote | null
  editText: string
  isSavingEdit: boolean
  isAdding: boolean
  newNoteText: string
  isSavingNew: boolean
  onClose: () => void
  onToggleDone: (note: DashboardNote) => void
  onDelete: (note: DashboardNote) => void
  onStartEdit: (note: DashboardNote) => void
  onEditTextChange: (value: string) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onFocusNote: (noteId: string) => void
  onToggleAdding: () => void
  onNewNoteTextChange: (value: string) => void
  onCreateNote: () => void
  onCancelAdding: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!focusedNoteId) return
    const node = rowRefs.current[focusedNoteId]
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedNoteId, notes])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-8">
      <div
        className="flex h-[min(92dvh,100%)] w-full max-w-[960px] flex-col overflow-hidden rounded-t-[20px] border border-[#C6DFF4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_30px_80px_rgba(30,64,175,0.18)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:h-auto sm:max-h-[min(85dvh,52rem)] sm:rounded-[20px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-plans-modal-title"
      >
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#D2E5F5] px-4 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <h2
              id="notes-plans-modal-title"
              className="text-lg font-semibold tracking-[-0.02em] text-[#163A63] dark:text-slate-100 sm:text-xl"
            >
              Notes / Plans
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#5D7C9D] dark:text-slate-400 sm:text-[13px]">
              {openCount} open note{openCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleAdding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#C6DFF4] bg-[#F0F7FF] px-2.5 py-1.5 text-xs font-semibold text-[#2563EB] transition-colors hover:bg-[#E0EFFF] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300 dark:hover:bg-slate-800"
            >
              <Plus className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
              Add note
            </button>
            <button
              type="button"
              aria-label="Close notes"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-[#D2E5F5] bg-white text-[#5D7C9D] transition-colors hover:bg-[#F0F7FF] hover:text-[#163A63] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isAdding ? (
          <div className="shrink-0 border-b border-[#D2E5F5] bg-[#F8FBFF] px-4 py-3 dark:border-white/10 dark:bg-slate-800/40 sm:px-6">
            <textarea
              value={newNoteText}
              onChange={(event) => onNewNoteTextChange(event.target.value)}
              rows={3}
              placeholder="Write a quick reminder…"
              className="w-full resize-none rounded-xl border border-[#C6DFF4] bg-white px-3 py-2 text-sm text-[#163A63] outline-none placeholder:text-[#5D7C9D]/55 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#BFDBFE]/60 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/25"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSavingNew}
                onClick={onCancelAdding}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#5D7C9D] hover:bg-[#E8F3FE] dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingNew || !newNoteText.trim()}
                onClick={onCreateNote}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8] disabled:opacity-50"
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

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C6DFF4] bg-[#F8FBFF]/80 px-4 py-12 text-center dark:border-white/10 dark:bg-slate-800/40">
              <p className="text-sm font-medium text-[#5D7C9D] dark:text-slate-400">No notes yet. Add your first plan.</p>
            </div>
          ) : (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-hidden rounded-[16px] border border-[#D2E5F5] dark:border-white/10 md:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="bg-[#F0F7FF] dark:bg-slate-800/60">
                    <tr className="border-b border-[#D2E5F5] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5D7C9D] dark:border-white/10 dark:text-slate-400">
                      <th className="w-[100px] px-3 py-3">Status</th>
                      <th className="px-3 py-3">Note / Plan</th>
                      <th className="w-[140px] px-3 py-3">Created</th>
                      <th className="w-[140px] px-3 py-3">Updated</th>
                      <th className="w-[168px] px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((note) => {
                      const isDone = note.status === 'done'
                      const isFocused = focusedNoteId === note.id
                      const isEditing = editingNote?.id === note.id

                      return (
                        <tr
                          key={note.id}
                          ref={(node) => {
                            rowRefs.current[note.id] = node
                          }}
                          className={[
                            'align-top border-b border-[#E8F3FE] last:border-b-0 transition-colors dark:border-white/10',
                            isFocused
                              ? 'bg-[#FFF1F2] ring-2 ring-inset ring-[#FB7185]/70 dark:bg-rose-950/30 dark:ring-rose-500/40'
                              : isDone
                                ? 'bg-[#FAFCFF]/80 dark:bg-slate-800/50'
                                : 'bg-white dark:bg-slate-900/70',
                          ].join(' ')}
                        >
                          <td className="px-3 py-3">
                            <span
                              className={[
                                'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]',
                                isDone
                                  ? 'bg-stone-100 text-stone-500 ring-1 ring-stone-200/80 dark:bg-slate-700/70 dark:text-slate-300 dark:ring-white/10'
                                  : 'bg-[#FFE4E6] text-[#BE123C] ring-1 ring-[#FECDD3]/80 dark:bg-rose-950/55 dark:text-rose-300 dark:ring-rose-800/50',
                              ].join(' ')}
                            >
                              {isDone ? 'Done' : 'Open'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <div>
                                <textarea
                                  value={editText}
                                  onChange={(event) => onEditTextChange(event.target.value)}
                                  rows={3}
                                  className="w-full resize-y rounded-lg border border-[#C6DFF4] bg-white px-2.5 py-2 text-sm text-[#163A63] outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#BFDBFE]/60 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/25"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={isSavingEdit}
                                    onClick={onCancelEdit}
                                    className="rounded-lg px-2 py-1 text-xs font-semibold text-[#5D7C9D] hover:bg-[#E8F3FE] dark:text-slate-400 dark:hover:bg-slate-800"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSavingEdit || !editText.trim()}
                                    onClick={onSaveEdit}
                                    className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                                  >
                                    {isSavingEdit ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p
                                className={[
                                  'whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-[#163A63] dark:text-slate-100',
                                  isDone ? 'line-through decoration-[#94A3B8]/60' : '',
                                ].join(' ')}
                              >
                                {note.note}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
                            {formatDateTime(note.createdAt)}
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
                            {formatDateTime(note.updatedAt)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <button
                                type="button"
                                aria-label="View note"
                                onClick={() => onFocusNote(note.id)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] transition-colors hover:bg-[#E8F3FE] hover:text-[#163A63] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Eye className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={isDone ? 'Reopen note' : 'Mark complete'}
                                disabled={busyNoteId === note.id}
                                onClick={() => onToggleDone(note)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
                              >
                                <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label="Edit note"
                                disabled={busyNoteId === note.id}
                                onClick={() => onStartEdit(note)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] transition-colors hover:bg-[#E8F3FE] hover:text-[#163A63] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Pencil className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete note"
                                disabled={busyNoteId === note.id}
                                onClick={() => onDelete(note)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                              >
                                <Trash2 className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked list */}
              <ul className="space-y-2.5 md:hidden">
                {notes.map((note) => {
                  const isDone = note.status === 'done'
                  const isFocused = focusedNoteId === note.id
                  const isEditing = editingNote?.id === note.id

                  return (
                    <li
                      key={note.id}
                      ref={(node) => {
                        rowRefs.current[note.id] = node
                      }}
                      className={[
                        'rounded-xl border border-[#D2E5F5] bg-white p-3 shadow-sm transition-colors dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none',
                        isFocused ? 'border-[#FB7185] bg-[#FFF1F2] ring-2 ring-[#FB7185]/40 dark:border-rose-500/50 dark:bg-rose-950/30 dark:ring-rose-500/30' : '',
                      ].join(' ')}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={[
                            'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]',
                            isDone
                              ? 'bg-stone-100 text-stone-500 ring-1 ring-stone-200/80 dark:bg-slate-700/70 dark:text-slate-300 dark:ring-white/10'
                              : 'bg-[#FFE4E6] text-[#BE123C] ring-1 ring-[#FECDD3]/80 dark:bg-rose-950/55 dark:text-rose-300 dark:ring-rose-800/50',
                          ].join(' ')}
                        >
                          {isDone ? 'Done' : 'Open'}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="View note"
                            onClick={() => onFocusNote(note.id)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] hover:bg-[#E8F3FE] dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Eye className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={isDone ? 'Reopen note' : 'Mark complete'}
                            disabled={busyNoteId === note.id}
                            onClick={() => onToggleDone(note)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
                          >
                            <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Edit note"
                            disabled={busyNoteId === note.id}
                            onClick={() => onStartEdit(note)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] hover:bg-[#E8F3FE] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Pencil className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete note"
                            disabled={busyNoteId === note.id}
                            onClick={() => onDelete(note)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-[#5D7C9D] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                          >
                            <Trash2 className="size-3.5" strokeWidth={2.1} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div>
                          <textarea
                            value={editText}
                            onChange={(event) => onEditTextChange(event.target.value)}
                            rows={3}
                            className="w-full resize-y rounded-lg border border-[#C6DFF4] bg-white px-2.5 py-2 text-sm text-[#163A63] outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#BFDBFE]/60 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/25"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={isSavingEdit}
                              onClick={onCancelEdit}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-[#5D7C9D] hover:bg-[#E8F3FE] dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSavingEdit || !editText.trim()}
                              onClick={onSaveEdit}
                              className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                            >
                              {isSavingEdit ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={[
                            'whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-[#163A63] dark:text-slate-100',
                            isDone ? 'line-through decoration-[#94A3B8]/60' : '',
                          ].join(' ')}
                        >
                          {note.note}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-[#5D7C9D] dark:text-slate-400">
                        <span>Created {formatDateTime(note.createdAt)}</span>
                        <span>Updated {formatDateTime(note.updatedAt)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotesPlansCard() {
  const { settings, formatDateTime, companyReady, companyLoading } = useCompanySettings()
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
  const [showAll, setShowAll] = useState(false)
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null)
  const [isAddingInModal, setIsAddingInModal] = useState(false)

  const openNotes = useMemo(
    () => notes.filter((note) => note.status === 'open'),
    [notes],
  )
  const openCount = openNotes.length
  const previewNotes = openNotes.slice(0, PREVIEW_OPEN_LIMIT)

  const loadNotes = useCallback(async () => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setNotes([])
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const rows = await fetchDashboardNotes(companyId)
      setNotes(sortNotes(rows))
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to load notes.'))
      setNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [companyReady, companyId, companyLoading])

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
      setNotes((current) => sortNotes([...current, created]))
      setNewNoteText('')
      setIsAdding(false)
      setIsAddingInModal(false)
      setFocusedNoteId(created.id)
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
        sortNotes(current.map((row) => (row.id === updated.id ? updated : row))),
      )
      setEditingNote(null)
      setEditText('')
      setFocusedNoteId(updated.id)
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
        sortNotes(current.map((row) => (row.id === updated.id ? updated : row))),
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
      if (focusedNoteId === deleteTarget.id) setFocusedNoteId(null)
      setDeleteTarget(null)
    } catch (error) {
      setLoadError(getNotesErrorMessage(error, 'Unable to delete note.'))
    } finally {
      setIsDeleting(false)
    }
  }

  function openModal(noteId?: string) {
    setShowAll(true)
    setFocusedNoteId(noteId ?? null)
    setIsAdding(false)
  }

  function closeModal() {
    setShowAll(false)
    setFocusedNoteId(null)
    setEditingNote(null)
    setEditText('')
    setIsAddingInModal(false)
    setNewNoteText('')
  }

  function startEdit(note: DashboardNote) {
    setEditingNote(note)
    setEditText(note.note)
    setIsAdding(false)
    setIsAddingInModal(false)
  }

  return (
    <>
      <section className={notesPlansCardClass}>
        {openCount > 0 ? (
          <span
            className="notes-alert-badge pointer-events-none absolute top-0 right-5 z-20 inline-flex min-w-[26px] -translate-y-1/2 items-center justify-center gap-0.5 rounded-full bg-[#E11D48] px-1.5 py-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(244,63,94,0.18)]"
            aria-label={`${openCount} open notes`}
          >
            <CircleAlert className="size-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
            <span className="tabular-nums">{openCount > 9 ? '9+' : openCount}</span>
          </span>
        ) : null}

        <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#FFE4E6] ring-1 ring-[#FECDD3]/90 dark:bg-rose-950/55 dark:ring-rose-800/50">
                <StickyNote className="size-3.5 text-[#E11D48] dark:text-rose-400" strokeWidth={2.1} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-[13px] font-semibold tracking-[-0.02em] text-[#163A63] dark:text-slate-100 sm:text-sm">
                    Notes / Plans
                  </h3>
                  {openCount > 0 ? (
                    <span className="text-[11px] font-semibold tabular-nums text-[#BE123C] dark:text-rose-400">
                      {openCount} open
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#5D7C9D] dark:text-slate-400">No open notes</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => openModal()}
                className="text-[11px] font-semibold text-[#E11D48] transition-colors hover:text-[#BE123C] hover:underline dark:text-rose-400 dark:hover:text-rose-300"
              >
                View all
              </button>
              <button
                type="button"
                aria-label="Add note"
                onClick={() => {
                  setIsAdding((value) => !value)
                  setEditingNote(null)
                  setEditText('')
                }}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[#FDA4AF]/80 bg-[#FFF1F2] text-[#BE123C] shadow-sm shadow-rose-500/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FB7185] hover:bg-[#FFE4E6] active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-slate-800/60 dark:text-rose-400 dark:hover:bg-slate-800"
              >
                <Plus className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </div>

          {isAdding ? (
            <div className="mb-2.5 rounded-xl border border-[#FECDD3] border-l-[3px] border-l-[#F43F5E] bg-[#FFF1F2] p-2.5 shadow-sm dark:border-white/10 dark:border-l-rose-500 dark:bg-slate-800/60">
              <textarea
                value={newNoteText}
                onChange={(event) => setNewNoteText(event.target.value)}
                rows={2}
                placeholder="Write a quick reminder…"
                className="w-full resize-none rounded-lg border border-[#FECDD3] bg-white/95 px-2.5 py-1.5 text-[13px] text-[#163A63] outline-none placeholder:text-[#9F1239]/40 focus:border-[#FB7185] focus:ring-2 focus:ring-[#FECDD3]/50 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500/50 dark:focus:ring-rose-500/25"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingNew}
                  onClick={() => {
                    setIsAdding(false)
                    setNewNoteText('')
                  }}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#9F1239]/80 hover:bg-[#FFE4E6] dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingNew || !newNoteText.trim()}
                  onClick={() => void handleCreateNote()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E11D48] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm shadow-rose-500/20 transition-colors hover:bg-[#BE123C] disabled:opacity-50"
                >
                  {isSavingNew ? (
                    <>
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
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
            <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {loadError}
            </p>
          ) : null}

          <div>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-11 animate-pulse rounded-xl border border-[#FECDD3]/60 bg-[#FFE4E6]/50 dark:border-white/10 dark:bg-slate-800/50"
                  />
                ))}
              </div>
            ) : openCount === 0 ? (
              <div className="rounded-xl border border-dashed border-[#FDA4AF]/60 bg-[#FFF1F2]/70 px-3 py-4 text-center dark:border-white/10 dark:bg-slate-800/40">
                <p className="text-[12px] font-medium text-[#5D7C9D] dark:text-slate-400">No open notes</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {previewNotes.map((note) => (
                  <CompactNotePreview
                    key={note.id}
                    note={note}
                    isBusy={busyNoteId === note.id}
                    onOpen={(row) => openModal(row.id)}
                    onToggleDone={(row) => void handleToggleDone(row)}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </ul>
            )}
          </div>
      </section>

      {showAll ? (
        <NotesPlansModal
          notes={notes}
          openCount={openCount}
          focusedNoteId={focusedNoteId}
          formatDateTime={formatDateTime}
          busyNoteId={busyNoteId}
          editingNote={editingNote}
          editText={editText}
          isSavingEdit={isSavingEdit}
          isAdding={isAddingInModal}
          newNoteText={newNoteText}
          isSavingNew={isSavingNew}
          onClose={closeModal}
          onToggleDone={(row) => void handleToggleDone(row)}
          onDelete={setDeleteTarget}
          onStartEdit={startEdit}
          onEditTextChange={setEditText}
          onCancelEdit={() => {
            setEditingNote(null)
            setEditText('')
          }}
          onSaveEdit={() => void handleSaveEdit()}
          onFocusNote={setFocusedNoteId}
          onToggleAdding={() => {
            setIsAddingInModal((value) => !value)
            setEditingNote(null)
            setEditText('')
          }}
          onNewNoteTextChange={setNewNoteText}
          onCreateNote={() => void handleCreateNote()}
          onCancelAdding={() => {
            setIsAddingInModal(false)
            setNewNoteText('')
          }}
        />
      ) : null}

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
