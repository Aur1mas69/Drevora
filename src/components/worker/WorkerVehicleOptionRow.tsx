import { cn } from '@/lib/utils'
import type { Vehicle } from '@/services/vehiclesService'
import { Check } from 'lucide-react'

export function vehicleSecondaryLabel(vehicle: Vehicle): string {
  const makeModel = [vehicle.make?.trim(), vehicle.model?.trim()].filter(Boolean).join(' ')
  const fleet = vehicle.fleetNumber?.trim()
  const type = vehicle.vehicleType?.trim()
  const parts = [
    makeModel || null,
    fleet ? `Fleet ${fleet}` : null,
    type || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export type WorkerVehicleOptionRowProps = {
  vehicle: Vehicle
  selected: boolean
  onSelect: (vehicle: Vehicle) => void
  disabled?: boolean
  compact?: boolean
}

/**
 * Shared Worker vehicle option: registration primary, make/model · fleet · type secondary.
 */
export function WorkerVehicleOptionRow({
  vehicle,
  selected,
  onSelect,
  disabled = false,
  compact = false,
}: WorkerVehicleOptionRowProps) {
  const registration = vehicle.registration?.trim() || 'No registration'
  const secondary = vehicleSecondaryLabel(vehicle)

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      aria-label={`${selected ? 'Selected' : 'Select'} vehicle ${registration}${secondary ? `, ${secondary}` : ''}`}
      onClick={() => onSelect(vehicle)}
      className={cn(
        'flex w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors',
        compact ? 'min-h-12 py-2.5' : 'min-h-14 py-3',
        'hover:bg-[color:var(--worker-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--worker-primary)]',
        selected ? 'bg-[color:var(--worker-primary-soft)]' : '',
        disabled ? 'opacity-70' : '',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tracking-[0.04em] text-[color:var(--worker-text)] uppercase">
          {registration}
        </span>
        {secondary ? (
          <span className="mt-0.5 block text-xs leading-snug break-words text-[color:var(--worker-text-secondary)]">
            {secondary}
          </span>
        ) : null}
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
}
