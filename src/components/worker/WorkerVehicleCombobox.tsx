import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { vehicleMatchesWorkerVehicleQuery } from '@/lib/vehicleRegistrationSearch'
import type { Vehicle } from '@/services/vehiclesService'
import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type WorkerVehicleComboboxProps = {
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  onSelect: (vehicle: Vehicle | null) => void
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
  /** Show the full company list when focused with an empty query. */
  showAllWhenEmpty?: boolean
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

/**
 * Shared Worker searchable vehicle selector.
 * Selection is committed only from real active-company results — free-typed
 * registrations are never treated as a valid vehicle id.
 */
export function WorkerVehicleCombobox({
  vehicles,
  selectedVehicleId,
  onSelect,
  label = 'Search registration',
  placeholder = 'Search registration, e.g. PN23 JUF',
  required = false,
  disabled = false,
  id: idProp,
  showAllWhenEmpty = true,
  className,
  error = null,
}: WorkerVehicleComboboxProps) {
  const autoId = useId()
  const inputId = idProp ?? `worker-vehicle-combobox-${autoId}`
  const listId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  )

  /** null = show the selected registration; string = user is typing a filter. */
  const [draftQuery, setDraftQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const query = draftQuery ?? selectedVehicle?.registration ?? ''

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        // Discard uncommitted typed text so unknown registrations cannot linger.
        setDraftQuery(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const filteredVehicles = useMemo(() => {
    const matches = vehicles.filter((vehicle) =>
      vehicleMatchesWorkerVehicleQuery(vehicle, query),
    )
    return [...matches].sort((a, b) =>
      (a.registration || '').localeCompare(b.registration || ''),
    )
  }, [query, vehicles])

  const showResults =
    open && !disabled && (showAllWhenEmpty || query.trim().length > 0)

  function handleSelect(vehicle: Vehicle) {
    onSelect(vehicle)
    setDraftQuery(null)
    setOpen(false)
  }

  function handleClearSelectionWhileTyping(nextQuery: string) {
    setDraftQuery(nextQuery)
    setOpen(true)
    if (selectedVehicleId) {
      onSelect(null)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label className="block space-y-1.5" htmlFor={inputId}>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={showResults}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={Boolean(error)}
            disabled={disabled}
            required={required && !selectedVehicleId}
            value={query}
            autoComplete="off"
            placeholder={placeholder}
            onChange={(event) => handleClearSelectionWhileTyping(event.target.value)}
            onFocus={() => setOpen(true)}
            className="h-12 rounded-2xl border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-950"
          />
        </div>
      </label>

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : null}

      {showResults ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-[#C5DFFB] bg-white py-1 shadow-lg"
        >
          {filteredVehicles.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-slate-500">
              No active company vehicles match that registration.
            </p>
          ) : (
            filteredVehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicleId
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(vehicle)}
                  className={cn(
                    'flex min-h-12 w-full flex-col items-start px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#F5FAFF]',
                    selected ? 'bg-[#EEF6FF]' : '',
                  )}
                >
                  <span className="font-semibold text-[#113C69]">
                    {vehicle.registration || 'No registration'}
                  </span>
                  <span className="text-xs text-[#5499BF]">
                    {vehicleSecondaryLabel(vehicle)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
