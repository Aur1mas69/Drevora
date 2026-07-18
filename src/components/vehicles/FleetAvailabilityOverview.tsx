import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { vehiclePanelClass } from '@/components/vehicles/vehicleUiStyles'
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
    <div className={`${vehiclePanelClass} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#EEF6FF] ring-1 ring-[#C5DFFB]">
              <CalendarDays className="size-4 text-[#218EE7]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#113C69]">
                Fleet Availability Overview
              </h2>
              <p className="mt-0.5 text-sm text-[#5499BF]">
                Upcoming fleet events for the next{' '}
                {range === 'Week' ? '7 days' : range === 'Month' ? '30 days' : 'year'}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['Week', 'Month', 'Year'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-[12px] px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
                range === item
                  ? 'bg-[#218EE7] text-white shadow-[0_4px_12px_rgba(33,142,231,0.22)]'
                  : 'bg-white/80 text-[#5499BF] ring-1 ring-[#D3E9FC] hover:bg-[#F5FAFF] hover:text-[#0B68BE] dark:bg-slate-800/70 dark:text-slate-400 dark:ring-white/10 dark:hover:bg-slate-800 dark:hover:text-blue-300'
              }`}
            >
              {item}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={onOpenFullCalendar}
            className="h-9 rounded-[12px] border-[#C5DFFB] bg-white/90 text-sm font-semibold text-[#0B68BE] shadow-sm hover:bg-[#F5FAFF] hover:text-[#218EE7] dark:border-white/10 dark:bg-slate-800/70 dark:text-blue-300 dark:hover:bg-slate-800 dark:hover:text-blue-200"
          >
            Open Full Fleet Calendar
            <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="mt-5 rounded-[16px] border border-dashed border-[#C5DFFB] bg-[#F8FBFF]/80 px-4 py-10 text-center dark:border-white/10 dark:bg-slate-900/50">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EEF6FF] ring-1 ring-[#D3E9FC] dark:bg-slate-800/70 dark:ring-white/10">
            <CalendarDays className="size-5 text-[#5499BF] dark:text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#113C69] dark:text-slate-100">
            No upcoming events in this period.
          </p>
          <p className="mt-1 text-xs text-[#5499BF] dark:text-slate-400">
            Scheduled maintenance, off-road periods and renewals will appear here.
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
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-3.5 py-2.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-[#C5DFFB] hover:bg-[#F8FBFF] hover:shadow-[0_6px_16px_rgba(33,142,231,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-800/50 dark:hover:shadow-black/20"
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900 ${getPlanningEventColor(event)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#113C69] dark:text-slate-100">
                    {event.vehicleRegistration}
                    <span className="font-medium text-[#5499BF] dark:text-slate-400"> · {event.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-[#5499BF] dark:text-slate-400">
                    {formatEventShortDate(event.startDate)}
                    {event.endDate ? ` → ${formatEventShortDate(event.endDate)}` : ''}
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
