import { Input } from '@/components/ui/input'
import { WorkerVehicleMobilePicker } from '@/components/worker/WorkerVehicleMobilePicker'
import {
  WorkerVehicleOptionRow,
  vehicleSecondaryLabel,
} from '@/components/worker/WorkerVehicleOptionRow'
import { cn } from '@/lib/utils'
import { vehicleMatchesWorkerVehicleQuery } from '@/lib/vehicleRegistrationSearch'
import type { Vehicle } from '@/services/vehiclesService'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

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

type ListboxPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

/** Mobile full-screen picker below this width; desktop dropdown at and above. */
const MOBILE_PICKER_MAX_WIDTH_PX = 767

function useIsMobileVehiclePickerViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${MOBILE_PICKER_MAX_WIDTH_PX}px)`).matches
  })

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_PICKER_MAX_WIDTH_PX}px)`)
    function sync() {
      setIsMobile(media.matches)
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return isMobile
}

/**
 * Shared Worker searchable vehicle selector.
 *
 * searchQuery and selectedVehicleId are independent:
 * - typing only updates the search filter;
 * - selection changes only when a result is chosen;
 * - clearing selection requires onClear / a parent Remove action — never typing.
 *
 * Mobile (<768px): full-screen portal picker.
 * Desktop/tablet (≥768px): anchored dropdown.
 */
export function WorkerVehicleCombobox({
  vehicles,
  selectedVehicleId,
  onSelect,
  onClear,
  label,
  placeholder,
  inputAriaLabel,
  required = false,
  disabled = false,
  id: idProp,
  showAllWhenEmpty = true,
  showSelectedSummary = true,
  className,
  error = null,
}: WorkerVehicleComboboxProps) {
  const { t } = useTranslation('worker')
  const resolvedLabel = label ?? t('vehicles.searchLabel')
  const resolvedPlaceholder = placeholder ?? t('vehicles.searchPlaceholder')
  const resolvedAria = inputAriaLabel ?? t('vehicles.searchAria')
  const isMobile = useIsMobileVehiclePickerViewport()
  const autoId = useId()
  const inputId = idProp ?? `worker-vehicle-combobox-${autoId}`
  const listId = `${inputId}-listbox`
  const mobilePickerId = `${inputId}-mobile-picker`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)

  /** Search filter only — never mirrors the selected/default registration. Desktop only. */
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [listboxPosition, setListboxPosition] = useState<ListboxPosition | null>(null)

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  )

  // Desktop outside-dismiss only — never active while mobile picker mode is on.
  useEffect(() => {
    if (isMobile || !open) return

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
  }, [isMobile, open, listId])

  // Close desktop dropdown if the viewport crosses into mobile mode.
  useEffect(() => {
    if (!isMobile) return
    setOpen(false)
    setSearchQuery('')
    setListboxPosition(null)
  }, [isMobile])

  const filteredVehicles = useMemo(() => {
    const matches = vehicles.filter((vehicle) =>
      vehicleMatchesWorkerVehicleQuery(vehicle, searchQuery),
    )
    return [...matches].sort((a, b) =>
      (a.registration || '').localeCompare(b.registration || ''),
    )
  }, [searchQuery, vehicles])

  const showDesktopResults =
    !isMobile && open && !disabled && (showAllWhenEmpty || searchQuery.trim().length > 0)

  // Desktop anchored listbox positioning only — skipped entirely on mobile.
  useLayoutEffect(() => {
    if (!showDesktopResults) {
      setListboxPosition(null)
      return
    }

    function updatePosition() {
      const anchor = inputWrapRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
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

    function handleDocumentScroll(event: Event) {
      const listbox = document.getElementById(listId)
      const target = event.target
      if (
        listbox &&
        target instanceof Node &&
        (target === listbox || listbox.contains(target))
      ) {
        return
      }
      updatePosition()
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', handleDocumentScroll, true)
    const vv = window.visualViewport
    vv?.addEventListener('resize', updatePosition)
    vv?.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', handleDocumentScroll, true)
      vv?.removeEventListener('resize', updatePosition)
      vv?.removeEventListener('scroll', updatePosition)
    }
  }, [showDesktopResults, searchQuery, filteredVehicles.length, listId])

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

  function handleOpenMobilePicker() {
    if (disabled) return
    setOpen(true)
  }

  function handleCloseMobilePicker() {
    setOpen(false)
    setSearchQuery('')
  }

  const desktopListbox =
    showDesktopResults && listboxPosition && typeof document !== 'undefined'
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
              overflowY: 'auto',
              touchAction: 'pan-y',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
            className="worker-theme-surface z-[200] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)] py-1 shadow-lg"
          >
            {filteredVehicles.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-[color:var(--worker-text-secondary)]">
                {t('vehicles.noMatch')}
              </p>
            ) : (
              filteredVehicles.map((vehicle) => (
                <WorkerVehicleOptionRow
                  key={vehicle.id}
                  vehicle={vehicle}
                  selected={vehicle.id === selectedVehicleId}
                  compact
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>,
          document.body,
        )
      : null

  const triggerClassName =
    'flex h-12 w-full items-center rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] pr-3 pl-10 text-left text-base font-semibold tracking-[0.04em] uppercase transition-colors focus-visible:border-[color:var(--worker-primary)] focus-visible:ring-3 focus-visible:ring-[color:var(--worker-primary)]/50 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'

  return (
    <div ref={rootRef} className={cn('relative space-y-2', className)}>
      {showSelectedSummary && selectedVehicle ? (
        <div className="rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-primary-soft)] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]">
                {t('vehicles.selectedVehicle')}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--worker-text)]">
                {selectedVehicle.registration || t('vehicles.noRegistration')}
              </p>
              {(() => {
                const fleet = selectedVehicle.fleetNumber?.trim()
                const secondary = vehicleSecondaryLabel(
                  selectedVehicle,
                  fleet ? t('vehicles.fleetLabel', { number: fleet }) : null,
                )
                return secondary ? (
                <p className="truncate text-xs text-[color:var(--worker-text-secondary)]">
                  {secondary}
                </p>
                ) : null
              })()}
            </div>
            {onClear ? (
              <button
                type="button"
                onClick={handleClearSelection}
                aria-label={t('vehicles.removeSelectedAria', {
                  registration: selectedVehicle.registration || t('vehicles.noRegistration'),
                })}
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
          {resolvedLabel}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
        <div ref={inputWrapRef} className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[color:var(--worker-text-muted)]"
            aria-hidden="true"
          />
          {isMobile ? (
            <button
              id={inputId}
              type="button"
              role="combobox"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={mobilePickerId}
              aria-label={resolvedAria}
              aria-invalid={Boolean(error)}
              aria-required={required && !selectedVehicleId}
              disabled={disabled}
              onClick={handleOpenMobilePicker}
              className={cn(
                triggerClassName,
                'text-[color:var(--worker-text-muted)]',
              )}
            >
              <span className="truncate">{resolvedPlaceholder}</span>
            </button>
          ) : (
            <Input
              id={inputId}
              type="text"
              role="combobox"
              aria-label={resolvedAria}
              aria-expanded={showDesktopResults}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-invalid={Boolean(error)}
              disabled={disabled}
              required={required && !selectedVehicleId}
              value={searchQuery}
              autoComplete="off"
              spellCheck={false}
              placeholder={resolvedPlaceholder}
              onChange={(event) => handleSearchChange(event.target.value)}
              onFocus={() => setOpen(true)}
              className="h-12 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] pr-3 pl-10 text-base font-semibold tracking-[0.04em] text-[color:var(--worker-text)] uppercase sm:text-sm focus-visible:border-[color:var(--worker-primary)] focus-visible:ring-[color:var(--worker-primary)]"
            />
          )}
        </div>
      </label>

      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : null}

      {desktopListbox}

      {isMobile ? (
        <WorkerVehicleMobilePicker
          id={mobilePickerId}
          open={open && !disabled}
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          showAllWhenEmpty={showAllWhenEmpty}
          onClose={handleCloseMobilePicker}
          onSelect={(vehicle) => {
            handleSelect(vehicle)
          }}
        />
      ) : null}
    </div>
  )
}
