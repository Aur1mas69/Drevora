import { WorkerVehicleOptionRow } from '@/components/worker/WorkerVehicleOptionRow'
import { isTrailerFleetAsset, type Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useId, useMemo } from 'react'
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
 * Lists active powered company vehicles only; marks the current default with a check.
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
  const poweredVehicles = useMemo(
    () => vehicles.filter((vehicle) => !isTrailerFleetAsset(vehicle)),
    [vehicles],
  )

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
        className="relative flex max-h-[min(78vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-[color:var(--worker-border)] bg-[color:var(--worker-bg)] shadow-xl sm:rounded-[24px]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)] px-4 py-3.5">
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
          aria-label="Active powered company vehicles"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          style={{
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {poweredVehicles.length === 0 ? (
            <p className="px-3 py-6 text-sm text-[color:var(--worker-text-secondary)]">
              No active powered vehicles available.
            </p>
          ) : (
            poweredVehicles.map((vehicle) => (
              <WorkerVehicleOptionRow
                key={vehicle.id}
                vehicle={vehicle}
                selected={vehicle.id === selectedVehicleId}
                disabled={isSaving}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
