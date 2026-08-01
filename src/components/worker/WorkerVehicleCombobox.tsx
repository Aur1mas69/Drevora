import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { vehicleMatchesWorkerVehicleQuery } from '@/lib/vehicleRegistrationSearch'
import type { Vehicle } from '@/services/vehiclesService'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type WorkerVehicleComboboxProps = {
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  /**
   * Called only when the Worker picks a real company vehicle from the results.
   * Never called for free-typed text, and never used to clear selection.
   */
  onSelect: (vehicle: Vehicle) => void
  /**
   * Optional explicit clear. Typing never clears selection — only this callback
   * (or a parent Remove / Change control) may clear selectedVehicleId.
   */
  onClear?: () => void
  label?: string
  placeholder?: string
  /** Accessible name for the search input (defaults to a search-by-registration label). */
  inputAriaLabel?: string
  required?: boolean
  disabled?: boolean
  id?: string
  /** Show the full company list when focused with an empty query. */
  showAllWhenEmpty?: boolean
  /** When false, hide the built-in selected-vehicle summary (parent shows its own). */
  showSelectedSummary?: boolean
  className?: string
  error?: string | null
}

function vehicleSecondaryLabel(vehicle: Vehicle): string {
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ')
  const parts = [
    makeModel || null,
    vehicle.fleetNumber ? `Fleet ${vehicle.fleetNumber}` : null,
    vehicle.vehicleType?.trim() || null,
  ].filter(Boolean)
  return parts.join(' · ') || 'Vehicle'
}

type ListboxPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

/**
 * Shared Worker searchable vehicle selector.
 *
 * searchQuery and selectedVehicleId are independent:
 * - typing only updates the search filter;
 * - selection changes only when a result is chosen;
 * - clearing selection requires onClear / a parent Remove action — never typing.
 */
export function WorkerVehicleCombobox({
  vehicles,
  selectedVehicleId,
  onSelect,
  onClear,
  label = 'Search registration',
  placeholder = 'Enter registration number',
  inputAriaLabel = 'Search company vehicles by registration number',
  required = false,
  disabled = false,
  id: idProp,
  showAllWhenEmpty = true,
  showSelectedSummary = true,
  className,
  error = null,
}: WorkerVehicleComboboxProps) {
  const autoId = useId()
  const inputId = idProp ?? `worker-vehicle-combobox-${autoId}`
  const listId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)

  /** Search filter only — never mirrors the selected/default registration. */
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [listboxPosition, setListboxPosition] = useState<ListboxPosition | null>(null)

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  )

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      const listbox = document.getElementById(listId)
      if (listbox?.contains(target)) return
      setOpen(false)
      // Discard uncommitted typed text only — keep selectedVehicleId as-is.
      setSearchQuery('')
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [listId])

  const filteredVehicles = useMemo(() => {
    const matches = vehicles.filter((vehicle) =>
      vehicleMatchesWorkerVehicleQuery(vehicle, searchQuery),
    )
    return [...matches].sort((a, b) =>
      (a.registration || '').localeCompare(b.registration || ''),
    )
  }, [searchQuery, vehicles])

  const showResults =
    open && !disabled && (showAllWhenEmpty || searchQuery.trim().length > 0)

  useLayoutEffect(() => {
    if (!showResults) {
      setListboxPosition(null)
      return
    }

    function updatePosition() {
      const anchor = inputWrapRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      // Use visualViewport so the list stays visible above the mobile keyboard.
      const vv = window.visualViewport
      const viewportTop = vv?.offsetTop ?? 0
      const viewportHeight = vv?.height ?? window.innerHeight
      const viewportLeft = vv?.offsetLeft ?? 0
      const viewportWidth = vv?.width ?? window.innerWidth
      const gutter = 8
      const spaceBelow = viewportTop + viewportHeight - rect.bottom - gutter
      const spaceAbove = rect.top - viewportTop - gutter
      const preferBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove
      const available = preferBelow ? spaceBelow : spaceAbove
      const maxHeight = Math.min(240, Math.max(96, available))
      const width = Math.min(rect.width, viewportWidth - gutter * 2)
      const left = Math.min(
        Math.max(viewportLeft + gutter, rect.left),
        viewportLeft + viewportWidth - width - gutter,
      )
      setListboxPosition({
        top: preferBelow
          ? rect.bottom + 4
          : Math.max(viewportTop + gutter, rect.top - maxHeight - 4),
        left,
        width,
        maxHeight,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const vv = window.visualViewport
    vv?.addEventListener('resize', updatePosition)
    vv?.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      vv?.removeEventListener('resize', updatePosition)
      vv?.removeEventListener('scroll', updatePosition)
    }
  }, [showResults, searchQuery, filteredVehicles.length])

  function handleSelect(vehicle: Vehicle) {
    onSelect(vehicle)
    setSearchQuery('')
    setOpen(false)
  }

  function handleSearchChange(raw: string) {
    // Uppercase for display; matching ignores spaces via normalizeRegistrationForSearch.
    // Do NOT clear or replace selectedVehicleId here.
    setSearchQuery(raw.toUpperCase())
    setOpen(true)
  }

  function handleClearSelection() {
    if (!onClear) return
    onClear()
    setSearchQuery('')
    setOpen(false)
    window.setTimeout(() => {
      document.getElementById(inputId)?.focus()
    }, 0)
  }

  const listbox =
    showResults && listboxPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={listId}
            role="listbox"
            style={{
              position: 'fixed',
              top: listboxPosition.top,
              left: listboxPosition.left,
              width: listboxPosition.width,
              maxHeight: listboxPosition.maxHeight,
            }}
            className="worker-theme-surface z-[200] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)] py-1 shadow-lg"
          >
            {filteredVehicles.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-[color:var(--worker-text-secondary)]">
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
                    onPointerDown={(event) => {
                      // Commit before blur / outside-dismiss handlers run.
                      event.preventDefault()
                      handleSelect(vehicle)
                    }}
                    className={cn(
                      'flex min-h-12 w-full flex-col items-start px-3 py-2.5 text-left text-sm transition-colors hover:bg-[color:var(--worker-row-hover)]',
                      selected ? 'bg-[color:var(--worker-primary-soft)]' : '',
                    )}
                  >
                    <span className="font-semibold text-[color:var(--worker-text)]">{registration}</span>
                    <span className="text-xs text-[color:var(--worker-text-secondary)]">{secondary}</span>
                  </button>
                )
              })
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={cn('relative space-y-2', className)}>
      {showSelectedSummary && selectedVehicle ? (
        <div className="rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-primary-soft)] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]">
                Selected vehicle
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--worker-text)]">
                {selectedVehicle.registration || 'No registration'}
              </p>
              <p className="truncate text-xs text-[color:var(--worker-text-secondary)]">
                {vehicleSecondaryLabel(selectedVehicle)}
              </p>
            </div>
            {onClear ? (
              <button
                type="button"
                onClick={handleClearSelection}
                aria-label={`Remove selected vehicle ${selectedVehicle.registration || ''}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] text-[color:var(--worker-text-secondary)] transition-colors hover:bg-[color:var(--worker-row-hover)] hover:text-[color:var(--worker-text)]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <label className="block space-y-1.5" htmlFor={inputId}>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
        <div ref={inputWrapRef} className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[color:var(--worker-text-muted)]"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            type="text"
            role="combobox"
            aria-label={inputAriaLabel}
            aria-expanded={showResults}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={Boolean(error)}
            disabled={disabled}
            required={required && !selectedVehicleId}
            value={searchQuery}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => setOpen(true)}
            className="h-12 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] pr-3 pl-10 text-base font-semibold tracking-[0.04em] text-[color:var(--worker-text)] uppercase sm:text-sm focus-visible:border-[color:var(--worker-primary)] focus-visible:ring-[color:var(--worker-primary)]"
          />
        </div>
      </label>

      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : null}

      {listbox}
    </div>
  )
}
