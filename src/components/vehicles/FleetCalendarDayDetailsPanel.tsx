import { getFirstNotesLine } from '@/lib/vehicleAvailability'
import {
  type PlanningEvent,
  formatEventShortDate,
  getPlanningEventColor,
} from '@/lib/vehiclePlanning'
import type { Vehicle } from '@/services/vehiclesService'

type FleetCalendarDayDetailsPanelProps = {
  dateKey: string
  date: Date
  events: PlanningEvent[]
  vehicleMap: Map<string, Vehicle>
  onDismiss: () => void
  onOpenEvent: (event: PlanningEvent) => void
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

export function FleetCalendarDayDetailsPanel({
  dateKey,
  date,
  events,
  vehicleMap,
  onDismiss,
  onOpenEvent,
}: FleetCalendarDayDetailsPanelProps) {
  const hasEvents = events.length > 0

  return (
    <div className="mt-4 rounded-[16px] border border-[#C5DFFB] bg-gradient-to-br from-white via-[#FAFCFF] to-[#EFF7FF] p-4 shadow-[0_12px_32px_rgba(17,60,105,0.14)] ring-1 ring-[#D3E9FC]/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#5499BF]">
            Selected day details
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#113C69]">
            {new Intl.DateTimeFormat('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(date)}
          </h3>
          <p className="mt-1 text-sm text-[#5499BF]">
            {hasEvents
              ? `${events.length} vehicle event${events.length === 1 ? '' : 's'}`
              : 'No vehicle events on this day.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-[10px] px-2 py-1 text-xs font-semibold text-[#5499BF] hover:bg-[#EFF7FF] hover:text-[#0B68BE]"
        >
          Clear
        </button>
      </div>

      {hasEvents ? (
        <ul className="mt-4 space-y-2">
          {events.map((event) => {
            const vehicle = vehicleMap.get(event.vehicleId)
            const vehicleName = vehicle ? getVehicleName(vehicle) : null
            const dotClass = getPlanningEventColor(event)

            return (
              <li key={`${event.id}-${dateKey}`}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="flex w-full items-start gap-3 rounded-[12px] border border-[#D3E9FC] bg-white/90 px-3 py-2.5 text-left transition-[border-color,box-shadow,filter] hover:border-[#89CFF0] hover:shadow-[0_4px_12px_rgba(33,142,231,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89CFF0]"
                >
                  <span
                    className={`mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-white ${dotClass}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#113C69]">
                      {event.vehicleRegistration}
                      {vehicleName ? (
                        <span className="font-medium text-[#5499BF]"> · {vehicleName}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-[#0B68BE]">
                      {event.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#5499BF]">
                      {event.endDate &&
                      event.endDate !== event.startDate
                        ? `${formatEventShortDate(event.startDate)} – ${formatEventShortDate(event.endDate)}`
                        : formatEventShortDate(event.startDate)}
                      {event.reason ? ` · ${event.reason}` : ''}
                    </span>
                    {event.notes ? (
                      <span className="mt-1 block text-xs text-[#5499BF]/90">
                        {getFirstNotesLine(event.notes)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
