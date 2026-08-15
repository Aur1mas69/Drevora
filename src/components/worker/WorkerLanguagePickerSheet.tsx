import { WorkerLanguageFlag } from '@/components/worker/WorkerLanguageFlag'
import {
  WORKER_LANGUAGE_LABELS,
  WORKER_LANGUAGES,
  type WorkerLanguage,
} from '@/i18n/languages'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

export type WorkerLanguagePickerSheetProps = {
  open: boolean
  language: WorkerLanguage
  title: string
  isSaving?: boolean
  onSelect: (language: WorkerLanguage) => void
  onClose: () => void
}

/**
 * Compact Worker bottom sheet for choosing UI language.
 * Follows WorkerHomeDefaultVehicleSheet: portal, backdrop, Escape, body lock.
 */
export function WorkerLanguagePickerSheet({
  open,
  language,
  title,
  isSaving = false,
  onSelect,
  onClose,
}: WorkerLanguagePickerSheetProps) {
  const titleId = useId()
  const listId = useId()

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

  return createPortal(
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        aria-label="Close language picker"
        disabled={isSaving}
        onClick={() => {
          if (!isSaving) onClose()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(78vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-[color:var(--worker-border)] bg-[color:var(--worker-bg)] shadow-xl sm:rounded-[24px]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)] px-4 py-3.5">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold tracking-[-0.02em] text-[color:var(--worker-text)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[color:var(--worker-text-secondary)] transition-colors hover:bg-[color:var(--worker-row-hover)] hover:text-[color:var(--worker-text)] disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div
          id={listId}
          role="listbox"
          aria-label={title}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {WORKER_LANGUAGES.map((code) => {
            const selected = language === code
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={isSaving}
                onClick={() => onSelect(code)}
                className={cn(
                  'flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors',
                  'hover:bg-[color:var(--worker-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--worker-primary)]',
                  selected ? 'bg-[color:var(--worker-primary-soft)]' : '',
                  isSaving ? 'opacity-70' : '',
                )}
              >
                <WorkerLanguageFlag language={code} />
                <span className="min-w-0 flex-1 text-[color:var(--worker-text)]">
                  {WORKER_LANGUAGE_LABELS[code]}
                </span>
                {selected ? (
                  <Check
                    className="size-5 shrink-0 text-[color:var(--worker-primary)]"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                ) : (
                  <span className="size-5 shrink-0" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </section>
    </div>,
    document.body,
  )
}
