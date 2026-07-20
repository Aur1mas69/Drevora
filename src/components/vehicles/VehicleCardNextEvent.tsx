import {
  vehicleCardNextEventHeadingClass,
  vehicleCardNextEventPanelClass,
  type VehicleCardAccent,
} from '@/components/vehicles/vehicleCardAccentStyles'
import {
  formatVehicleCardEventDate,
  formatVehicleCardEventTiming,
  getVehicleCardNextEvent,
  type VehicleCardEventUrgency,
} from '@/lib/vehicleCardNextEvent'
import type { Vehicle } from '@/services/vehiclesService'

type VehicleCardNextEventProps = {
  vehicle: Vehicle
  accent: VehicleCardAccent
  onOpenMore?: () => void
}

function urgencyClasses(urgency: VehicleCardEventUrgency): {
  dot: string
  label: string
  text: string
} {
  if (urgency === 'overdue') {
    return {
      dot: 'bg-rose-500 ring-2 ring-rose-200/80 dark:ring-rose-900/60',
      label: 'text-rose-800 dark:text-rose-200',
      text: 'text-rose-700 dark:text-rose-300',
    }
  }
  if (urgency === 'due_soon') {
    return {
      dot: 'bg-amber-500 ring-2 ring-amber-200/80 dark:ring-amber-900/60',
      label: 'text-amber-900 dark:text-amber-200',
      text: 'text-amber-800 dark:text-amber-300',
    }
  }
  return {
    dot: 'bg-[#218EE7] ring-2 ring-[#C5DFFB]/80 dark:ring-blue-900/60',
    label: 'text-[#0B68BE] dark:text-blue-200',
    text: 'text-[#3D7A9C] dark:text-slate-300',
  }
}

export function VehicleCardNextEvent({
  vehicle,
  accent,
  onOpenMore,
}: VehicleCardNextEventProps) {
  const { nearest, additionalCount } = getVehicleCardNextEvent(vehicle)
  const panelClass = vehicleCardNextEventPanelClass[accent]
  const headingClass = vehicleCardNextEventHeadingClass[accent]

  if (!nearest) {
    return (
      <div className={`min-w-0 rounded-lg border px-2 py-1.5 ${panelClass}`}>
        <p
          className={`text-[9px] font-bold uppercase tracking-[0.1em] ${headingClass}`}
        >
          Next event
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-[#5499BF] dark:text-slate-400">
          No upcoming events
        </p>
      </div>
    )
  }

  const tones = urgencyClasses(nearest.urgency)
  const timing = formatVehicleCardEventTiming(nearest)
  const dateLabel = formatVehicleCardEventDate(nearest.dueDate)
  const secondaryLine =
    nearest.urgency === 'overdue' ? timing : `${dateLabel} · ${timing}`

  return (
    <div className={`min-w-0 rounded-lg border px-2 py-1.5 ${panelClass}`}>
      <div className="flex items-start justify-between gap-1.5">
        <p
          className={`text-[9px] font-bold uppercase tracking-[0.1em] ${headingClass}`}
        >
          Next event
        </p>
        {additionalCount > 0 ? (
          onOpenMore ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenMore()
              }}
              className="shrink-0 rounded px-1 text-[10px] font-semibold text-[#0B68BE] transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 dark:text-blue-300 dark:hover:bg-slate-800/70"
              aria-label={`View ${additionalCount} more compliance event${additionalCount === 1 ? '' : 's'} on vehicle profile`}
            >
              +{additionalCount} more
            </button>
          ) : (
            <span className="shrink-0 text-[10px] font-semibold text-[#5499BF] dark:text-slate-400">
              +{additionalCount} more
            </span>
          )
        ) : null}
      </div>

      <div className="mt-1 flex min-w-0 items-start gap-1.5">
        <span
          className={`mt-1 size-2 shrink-0 rounded-full ${tones.dot}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className={`truncate text-[11px] font-bold ${tones.label}`}>
            {nearest.label}
          </p>
          <p className={`truncate text-[10px] font-semibold ${tones.text}`}>
            <span className="sr-only">
              {nearest.urgency === 'overdue'
                ? 'Overdue. '
                : nearest.urgency === 'due_soon'
                  ? 'Due soon. '
                  : 'Upcoming. '}
            </span>
            {secondaryLine}
          </p>
        </div>
      </div>
    </div>
  )
}
