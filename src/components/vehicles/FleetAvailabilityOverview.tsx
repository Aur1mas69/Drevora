import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  adminFilterChip,
  adminHeading,
  adminInnerSoft,
  adminPanel,
  adminTabInactive,
  adminTextMuted,
  adminTextStrong,
} from '@/lib/adminUiStyles'
import { todayString } from '@/lib/vehicleAvailability'
import {
  buildFleetPlanningEvents,
  formatEventShortDate,
  getPlanningEventColor,
  type PlanningEvent,
} from '@/lib/vehiclePlanning'
import type { Vehicle } from '@/services/vehiclesService'
import { ArrowUpRight, CalendarDays } from 'lucide-react'

type OverviewRange = 'Week' | 'Month' | 'Year'

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getRangeEnd(today: string, range: OverviewRange): string {
  if (range === 'Week') return addDays(today, 7)
  if (range === 'Month') return addDays(today, 30)
  return addDays(today, 365)
}

type FleetAvailabilityOverviewProps = {
  vehicles: Vehicle[]
  onOpenEvent: (vehicle: Vehicle, event: PlanningEvent) => void
  onOpenFullCalendar: () => void
}

export function FleetAvailabilityOverview({
  vehicles,
  onOpenEvent,
  onOpenFullCalendar,
}: FleetAvailabilityOverviewProps) {
  const [range, setRange] = useState<OverviewRange>('Month')

  const upcomingEvents = useMemo(() => {
    const today = todayString()
    const rangeEnd = getRangeEnd(today, range)

    return buildFleetPlanningEvents(vehicles)
      .filter(
        (event) => event.startDate >= today && event.startDate <= rangeEnd,
      )
      .slice(0, 12)
  }, [range, vehicles])

  return (
    <div className={`${adminPanel} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-[#2563EB] dark:text-blue-300" />
            <h2 className={`text-lg font-semibold tracking-[-0.02em] ${adminHeading}`}>
              Fleet Availability Overview
            </h2>
          </div>
          <p className={`mt-1 text-sm ${adminTextMuted}`}>
            Upcoming fleet events for the next{' '}
            {range === 'Week' ? '7 days' : range === 'Month' ? '30 days' : 'year'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['Week', 'Month', 'Year'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                range === item
                  ? adminFilterChip
                  : `${adminTabInactive} hover:bg-[#F4F8FF] dark:hover:bg-slate-800/50`
              }`}
            >
              {item}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={onOpenFullCalendar}
            className="h-9 rounded-[10px] border-[rgba(75,120,220,0.12)] bg-white text-sm font-semibold text-[#2563EB] hover:bg-[#EEF4FF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
          >
            Open Full Fleet Calendar
            <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className={`mt-5 rounded-[14px] border border-dashed border-[rgba(75,120,220,0.15)] px-4 py-8 text-center ${adminInnerSoft} dark:border-white/10`}>
          <p className={`text-sm font-medium ${adminTextStrong}`}>
            No upcoming events in this period.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {upcomingEvents.map((event) => {
            const vehicle = vehicles.find((item) => item.id === event.vehicleId)
            if (!vehicle) return null

            return (
              <button
                key={`${event.id}-${event.startDate}`}
                type="button"
                onClick={() => onOpenEvent(vehicle, event)}
                className={`flex w-full items-center gap-3 rounded-[12px] border border-[rgba(70,110,220,0.08)] px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-px hover:shadow-sm ${adminInnerSoft} dark:border-white/10 dark:hover:bg-slate-800/70`}
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ${getPlanningEventColor(event)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${adminHeading}`}>
                    {event.vehicleRegistration}
                    <span className={`font-medium ${adminTextMuted}`}>
                      {' '}
                      · {event.label}
                    </span>
                  </p>
                  <p className={`text-xs ${adminTextMuted}`}>
                    {formatEventShortDate(event.startDate)}
                    {event.endDate
                      ? ` → ${formatEventShortDate(event.endDate)}`
                      : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
