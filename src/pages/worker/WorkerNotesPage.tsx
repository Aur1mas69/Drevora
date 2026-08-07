import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { formatTimesheetSubmittedAt } from '@/lib/timesheetUtils'
import { cn } from '@/lib/utils'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import {
  previewWorkerPrivateNoteContent,
  sortWorkerPrivateNotes,
  validateWorkerPrivateNoteContent,
  validateWorkerPrivateNoteTitle,
  type WorkerPrivateNote,
} from '@/lib/workerPrivateNotes'
import {
  createWorkerPrivateNote,
  deleteWorkerPrivateNote,
  fetchOwnWorkerPrivateNotes,
  setWorkerPrivateNotePinned,
  updateWorkerPrivateNote,
  WorkerPrivateNotesServiceError,
} from '@/services/workerPrivateNotesService'
import { NotebookPen, Pin, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

type EditorMode = 'create' | 'edit'

function NoteEditorSheet({
  open,
  mode,
  initialTitle,
  initialContent,
  isSaving,
  onClose,
  onSave,
}: {
  open: boolean
  mode: EditorMode
  initialTitle: string
  initialContent: string
  isSaving: boolean
  onClose: () => void
  onSave: (title: string, content: string) => void
}) {
  const titleId = useId()
  const contentId = useId()
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle)
    setContent(initialContent)
    setFormError(null)
  }, [initialContent, initialTitle, open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSaving, onClose, open])

  useEffect(() => {
    if (!open) return
    const scrollY = window.scrollY
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousPosition = body.style.position
    const previousTop = body.style.top
    const previousWidth = body.style.width
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    return () => {
      body.style.overflow = previousOverflow
      body.style.position = previousPosition
      body.style.top = previousTop
      body.style.width = previousWidth
      window.scrollTo(0, scrollY)
    }
  }, [open])

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const titleError = validateWorkerPrivateNoteTitle(title)
    if (titleError) {
      setFormError(titleError)
      return
    }
    const contentError = validateWorkerPrivateNoteContent(content)
    if (contentError) {
      setFormError(contentError)
      return
    }
    setFormError(null)
    onSave(title.trim(), content.trim())
  }

  return createPortal(
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        aria-label="Cancel"
        disabled={isSaving}
        onClick={() => {
          if (!isSaving) onClose()
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(86vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] shadow-xl sm:rounded-[24px]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--worker-border)] px-4 py-3.5">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold tracking-[-0.02em] text-[color:var(--worker-text)]"
          >
            {mode === 'create' ? 'Add note' : 'Edit note'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[color:var(--worker-text-secondary)] hover:bg-[color:var(--worker-row-hover)] disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor={`${contentId}-title`}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]"
            >
              Title
            </label>
            <Input
              id={`${contentId}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              autoComplete="off"
              placeholder="e.g. Site gate code"
              className="h-12 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] text-[color:var(--worker-text)]"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`${contentId}-body`}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]"
            >
              Note
            </label>
            <textarea
              id={`${contentId}-body`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={4000}
              rows={7}
              placeholder="Gate codes, site instructions, depot details…"
              disabled={isSaving}
              className="w-full resize-none rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-3 py-3 text-sm leading-relaxed text-[color:var(--worker-text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)]"
            />
          </div>
          {formError ? (
            <p className="text-sm font-medium text-rose-600" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-auto flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
              className="h-12 rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="worker-btn-primary h-12 rounded-2xl font-semibold"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}

function DeleteNoteDialog({
  open,
  noteTitle,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  open: boolean
  noteTitle: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return createPortal(
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-label="Cancel delete"
        disabled={isDeleting}
        onClick={() => {
          if (!isDeleting) onCancel()
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-note-delete-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
      >
        <div className="border-b border-[color:var(--worker-border)] px-5 py-4">
          <h2
            id="worker-note-delete-title"
            className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--worker-text)]"
          >
            Delete note?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
            “{noteTitle}” will be permanently removed from your Notes.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={onCancel}
            className="h-12 rounded-2xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="h-12 rounded-2xl bg-rose-600 font-semibold text-white hover:bg-rose-700"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default function WorkerNotesPage() {
  const isDark = useIsWorkerDarkMode()
  const { worker, isLoading: workerLoading, error: workerError } =
    useCurrentWorker()
  const [notes, setNotes] = useState<WorkerPrivateNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [editingNote, setEditingNote] = useState<WorkerPrivateNote | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkerPrivateNote | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const reloadNotes = useCallback(async () => {
    if (!worker?.id) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const rows = await fetchOwnWorkerPrivateNotes(worker.id)
      setNotes(sortWorkerPrivateNotes(rows))
    } catch (error) {
      setNotes([])
      setLoadError(
        error instanceof WorkerPrivateNotesServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unable to load notes.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [worker?.id])

  useEffect(() => {
    if (workerLoading) return
    if (!worker?.id) {
      setIsLoading(false)
      return
    }
    void reloadNotes()
  }, [reloadNotes, worker?.id, workerLoading])

  function openCreate() {
    setEditorMode('create')
    setEditingNote(null)
    setEditorOpen(true)
  }

  function openEdit(note: WorkerPrivateNote) {
    setEditorMode('edit')
    setEditingNote(note)
    setEditorOpen(true)
  }

  async function handleSave(title: string, content: string) {
    if (!worker?.id) return
    setIsSaving(true)
    try {
      if (editorMode === 'create') {
        const created = await createWorkerPrivateNote({
          driverId: worker.id,
          title,
          content,
        })
        setNotes((current) => sortWorkerPrivateNotes([created, ...current]))
        showToast('Note saved')
      } else if (editingNote) {
        const updated = await updateWorkerPrivateNote({
          id: editingNote.id,
          title,
          content,
        })
        setNotes((current) =>
          sortWorkerPrivateNotes(
            current.map((note) => (note.id === updated.id ? updated : note)),
          ),
        )
        showToast('Note updated')
      }
      setEditorOpen(false)
      setEditingNote(null)
    } catch (error) {
      showToast(
        error instanceof WorkerPrivateNotesServiceError
          ? error.message
          : 'Unable to save note.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTogglePin(note: WorkerPrivateNote) {
    try {
      const updated = await setWorkerPrivateNotePinned(note.id, !note.isPinned)
      setNotes((current) =>
        sortWorkerPrivateNotes(
          current.map((row) => (row.id === updated.id ? updated : row)),
        ),
      )
      showToast(updated.isPinned ? 'Note pinned' : 'Note unpinned')
    } catch (error) {
      showToast(
        error instanceof WorkerPrivateNotesServiceError
          ? error.message
          : 'Unable to update pin.',
      )
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteWorkerPrivateNote(deleteTarget.id)
      setNotes((current) =>
        current.filter((note) => note.id !== deleteTarget.id),
      )
      setDeleteTarget(null)
      showToast('Note deleted')
    } catch (error) {
      showToast(
        error instanceof WorkerPrivateNotesServiceError
          ? error.message
          : 'Unable to delete note.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (!workerLoading && (workerError || !worker)) {
    return (
      <div className="worker-card rounded-[1.75rem] p-5">
        <h1 className="text-lg font-semibold text-[color:var(--worker-text)]">
          My Notes
        </h1>
        <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
          {workerError ??
            'We could not find a worker profile linked to your account.'}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          My Notes
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--worker-text-secondary)]">
          Use Notes for work information such as gate codes and site
          instructions. Do not store account passwords or payment information.
        </p>
      </header>

      <Button
        type="button"
        onClick={openCreate}
        className="worker-btn-primary h-12 w-full gap-2 rounded-2xl font-semibold"
      >
        <Plus className="size-5" aria-hidden />
        Add note
      </Button>

      {workerLoading || isLoading ? (
        <div
          className="min-h-[12rem] rounded-[1.5rem] bg-[color:var(--worker-card)]"
          role="status"
          aria-label="Loading notes"
        />
      ) : loadError ? (
        <div className="worker-card rounded-[1.5rem] px-4 py-5">
          <p className="text-sm font-semibold text-[color:var(--worker-text)]">
            Unable to load notes
          </p>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 rounded-2xl"
            onClick={() => void reloadNotes()}
          >
            Try again
          </Button>
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-10 text-center">
          <NotebookPen
            className="mx-auto size-8 text-[color:var(--worker-text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="mt-3 text-base font-semibold text-[color:var(--worker-text)]">
            No notes yet
          </p>
          <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
            Save gate codes, site instructions and other useful work information
            here.
          </p>
        </div>
      ) : (
        <ul className="worker-list-stack space-y-2">
          {notes.map((note, index) => (
            <li key={note.id} className={workerListCardClass(index, isDark)}>
              <button
                type="button"
                onClick={() => openEdit(note)}
                className="w-full min-w-0 text-left"
              >
                <div className="flex items-start gap-2">
                  <p
                    className={cn(
                      'worker-accent-title min-w-0 flex-1 text-[15px] font-semibold',
                      !isDark && 'text-[color:var(--worker-text)]',
                    )}
                  >
                    {note.title}
                  </p>
                  {note.isPinned ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E8F3FE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0B68BE]"
                      aria-label="Pinned"
                    >
                      <Pin className="size-3" aria-hidden />
                      Pinned
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    'worker-accent-secondary mt-1.5 text-sm leading-snug',
                    !isDark && 'text-[color:var(--worker-text-secondary)]',
                  )}
                >
                  {previewWorkerPrivateNoteContent(note.content)}
                </p>
                <p
                  className={cn(
                    'worker-accent-muted mt-2 text-xs',
                    !isDark && 'text-[color:var(--worker-text-muted)]',
                  )}
                >
                  Updated{' '}
                  {formatTimesheetSubmittedAt(note.updatedAt) ?? note.updatedAt}
                </p>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleTogglePin(note)}
                  className={cn(
                    'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold',
                    !isDark &&
                      'border-[#89CFF0] bg-[#E8F3FE] text-[#0B68BE]',
                  )}
                >
                  <Pin className="size-3.5" aria-hidden />
                  {note.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(note)}
                  className={cn(
                    'inline-flex h-10 items-center rounded-xl border px-3 text-xs font-semibold',
                    !isDark &&
                      'border-[color:var(--worker-border)] bg-[color:var(--worker-card)] text-[color:var(--worker-text)]',
                  )}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(note)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NoteEditorSheet
        open={editorOpen}
        mode={editorMode}
        initialTitle={editingNote?.title ?? ''}
        initialContent={editingNote?.content ?? ''}
        isSaving={isSaving}
        onClose={() => {
          if (!isSaving) {
            setEditorOpen(false)
            setEditingNote(null)
          }
        }}
        onSave={(title, content) => {
          void handleSave(title, content)
        }}
      />

      <DeleteNoteDialog
        open={Boolean(deleteTarget)}
        noteTitle={deleteTarget?.title ?? ''}
        isDeleting={isDeleting}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null)
        }}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
      />

      {toastMessage ? (
        <div className="worker-toast-success fixed bottom-24 left-1/2 z-[70] w-[min(92vw,24rem)] -translate-x-1/2 rounded-xl bg-[color:var(--worker-text)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--worker-bg)] shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}
