import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { vehicleMatchesWorkerVehicleQuery } from '@/lib/vehicleRegistrationSearch'
import type { Vehicle } from '@/services/vehiclesService'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export function vehicleSecondaryLabel(vehicle: Vehicle): string {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ')
  const parts = [
    makeModel || null,
    vehicle.fleetNumber ? `Fleet ${vehicle.fleetNumber}` : null,
    vehicle.vehicleType?.trim() || null,
  ].filter(Boolean)
  return parts.join(' · ') || 'Vehicle'
}

export type WorkerVehicleMobilePickerProps = {
  open: boolean
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  onSelect: (vehicle: Vehicle) => void
  onClose: () => void
  /** Show the full company list when the search query is empty. */
  showAllWhenEmpty?: boolean
  /** Optional id for the dialog root (aria-controls target). */
  id?: string
}

/**
 * Full-screen Worker vehicle picker for mobile viewports.
 * Renders in a portal; locks underlying page scroll while open.
 */
export function WorkerVehicleMobilePicker({
  open,
  vehicles,
  selectedVehicleId,
  onSelect,
  onClose,
  showAllWhenEmpty = true,
  id,
}: WorkerVehicleMobilePickerProps) {
  const titleId = useId()
  const listId = useId()
  const searchInputId = useId()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewportBox, setViewportBox] = useState(() => ({
    top: 0,
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(searchInputId)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, searchInputId])

  // Keep the overlay aligned to the visible viewport (keyboard-safe on iOS/Android).
  useEffect(() => {
    if (!open) return

    function updateViewportBox() {
      const vv = window.visualViewport
      setViewportBox({
        top: vv?.offsetTop ?? 0,
        left: vv?.offsetLeft ?? 0,
        width: vv?.width ?? window.innerWidth,
        height: vv?.height ?? window.innerHeight,
      })
    }

    updateViewportBox()
    const vv = window.visualViewport
    vv?.addEventListener('resize', updateViewportBox)
    vv?.addEventListener('scroll', updateViewportBox)
    window.addEventListener('resize', updateViewportBox)
    return () => {
      vv?.removeEventListener('resize', updateViewportBox)
      vv?.removeEventListener('scroll', updateViewportBox)
      window.removeEventListener('resize', updateViewportBox)
    }
  }, [open])

  // iOS-compatible body scroll lock: pin body and restore exact scroll on close.
  useEffect(() => {
    if (!open) return

    const scrollY = window.scrollY
    const body = document.body
    const html = document.documentElement
    const previous = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'

    return () => {
      body.style.position = previous.bodyPosition
      body.style.top = previous.bodyTop
      body.style.left = previous.bodyLeft
      body.style.right = previous.bodyRight
      body.style.width = previous.bodyWidth
      body.style.overflow = previous.bodyOverflow
      html.style.overflow = previous.htmlOverflow
      window.scrollTo(0, scrollY)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim()
    if (!query && !showAllWhenEmpty) return []
    const matches = vehicles.filter((vehicle) =>
      vehicleMatchesWorkerVehicleQuery(vehicle, searchQuery),
    )
    return [...matches].sort((a, b) =>
      (a.registration || '').localeCompare(b.registration || ''),
    )
  }, [searchQuery, showAllWhenEmpty, vehicles])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="worker-theme-surface flex flex-col bg-[color:var(--worker-bg)]"
      style={{
        position: 'fixed',
        top: viewportBox.top,
        left: viewportBox.left,
        width: viewportBox.width,
        height: viewportBox.height,
        maxHeight: '100dvh',
        zIndex: 400,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)] px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close vehicle picker"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[color:var(--worker-text)] transition-colors hover:bg-[color:var(--worker-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)]"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <h2
          id={titleId}
          className="min-w-0 flex-1 truncate text-base font-semibold text-[color:var(--worker-text)]"
        >
          Select vehicle
        </h2>
      </header>

      <div className="shrink-0 border-b border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)] px-3 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[color:var(--worker-text-muted)]"
            aria-hidden="true"
          />
          <Input
            id={searchInputId}
            type="text"
            value={searchQuery}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search registration"
            aria-label="Search registration"
            aria-controls={listId}
            aria-autocomplete="list"
            onChange={(event) => setSearchQuery(event.target.value.toUpperCase())}
            className="h-12 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] pr-11 pl-10 text-base font-semibold tracking-[0.04em] text-[color:var(--worker-text)] uppercase focus-visible:border-[color:var(--worker-primary)] focus-visible:ring-[color:var(--worker-primary)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-[color:var(--worker-text-secondary)] transition-colors hover:bg-[color:var(--worker-row-hover)] hover:text-[color:var(--worker-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)]"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="Company vehicles"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1"
        style={{
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {filteredVehicles.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[color:var(--worker-text-secondary)]">
            No active company vehicles match that registration.
          </p>
        ) : (
          filteredVehicles.map((vehicle) => {
            const selected = vehicle.id === selectedVehicleId
            const registration = vehicle.registration || 'No registration'
            const secondary = vehicleSecondaryLabel(vehicle)
            return (
              <button
                key={vehicle.id}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Select vehicle ${registration}${secondary ? `, ${secondary}` : ''}`}
                onClick={() => onSelect(vehicle)}
                className={cn(
                  'flex min-h-14 w-full flex-col items-start rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-[color:var(--worker-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--worker-primary)]',
                  selected ? 'bg-[color:var(--worker-primary-soft)]' : '',
                )}
              >
                <span className="font-semibold tracking-[0.04em] text-[color:var(--worker-text)] uppercase">
                  {registration}
                </span>
                <span className="text-xs text-[color:var(--worker-text-secondary)]">{secondary}</span>
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}
