import { cn } from '@/lib/utils'
import type { Vehicle } from '@/services/vehiclesService'
import { Check, X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

export type WorkerHomeDefaultVehicleSheetProps = {
  open: boolean
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  isSaving: boolean
  onSelect: (vehicle: Vehicle) => void
  onClose: () => void
}

/**
 * Mobile bottom sheet for picking the Worker’s default vehicle on Home.
 * Lists active company vehicles only; marks the current default with a check.
 */
export function WorkerHomeDefaultVehicleSheet({
  open,
  vehicles,
  selectedVehicleId,
  isSaving,
  onSelect,
  onClose,
}: WorkerHomeDefaultVehicleSheetProps) {
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
        aria-label="Close select default vehicle"
        disabled={isSaving}
        onClick={() => {
          if (!isSaving) onClose()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(78vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] shadow-xl sm:rounded-[24px]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--worker-border)] px-4 py-3.5">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold tracking-[-0.02em] text-[color:var(--worker-text)]"
          >
            Select default vehicle
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
          aria-label="Active company vehicles"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
        >
          {vehicles.length === 0 ? (
            <p className="px-3 py-6 text-sm text-[color:var(--worker-text-secondary)]">
              No active company vehicles available.
            </p>
          ) : (
            vehicles.map((vehicle) => {
              const registration =
                vehicle.registration?.trim() || 'No registration'
              const selected = vehicle.id === selectedVehicleId
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={isSaving}
                  aria-label={`${selected ? 'Current default ' : 'Select '}${registration}`}
                  onClick={() => onSelect(vehicle)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
                    'hover:bg-[color:var(--worker-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--worker-primary)]',
                    selected ? 'bg-[color:var(--worker-primary-soft)]' : '',
                    isSaving ? 'opacity-70' : '',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[0.04em] text-[color:var(--worker-text)] uppercase">
                    {registration}
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
            })
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
