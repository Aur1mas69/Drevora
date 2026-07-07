import { Card, CardContent } from '@/components/ui/card'
import { vehicleProfilePanelClass } from '@/components/vehicles/profile/vehicleProfileUi'
import { VehicleStatusBadge, statusEmojiMap } from '@/components/vehicles/VehicleStatusBadge'
import { buildTimelineEntries, formatShortDate } from '@/lib/vehicleAvailability'
import type { Vehicle, VehicleAvailability } from '@/services/vehiclesService'

type TimelineTabProps = {
  vehicle: Vehicle
  onSelectRecord: (record: VehicleAvailability) => void
}

export function TimelineTab({ vehicle, onSelectRecord }: TimelineTabProps) {
  const entries = buildTimelineEntries(vehicle)

  return (
    <Card className={`${vehicleProfilePanelClass} overflow-hidden py-0`}>
      <CardContent className="p-4 sm:p-5">
        <div>
          <p className="text-lg font-semibold tracking-[-0.03em] text-[#113C69]">
            Timeline
          </p>
          <p className="mt-1 text-sm font-medium text-[#5499BF]">
            Upcoming events first, then history.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[#C5DFFB] bg-[#F8FBFF]/80 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-[#113C69]">
                No timeline events yet
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const record = entry.recordId
                ? vehicle.availabilityRecords.find((item) => item.id === entry.recordId)
                : null

              return (
                <div
                  key={entry.id}
                  className={`rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-4 py-3.5 ${
                    record ? 'cursor-pointer transition-all duration-200 hover:-translate-y-px hover:border-[#C5DFFB] hover:bg-[#F8FBFF]' : ''
                  }`}
                  onClick={() => {
                    if (record) onSelectRecord(record)
                  }}
                  onKeyDown={(event) => {
                    if (record && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      onSelectRecord(record)
                    }
                  }}
                  role={record ? 'button' : undefined}
                  tabIndex={record ? 0 : undefined}
                >
                  <p className="text-sm font-semibold tabular-nums text-[#5499BF]">
                    {formatShortDate(entry.date)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-base">{statusEmojiMap[entry.status]}</span>
                    <p className="text-sm font-semibold text-[#113C69]">{entry.label}</p>
                    {entry.kind === 'event' ? (
                      <VehicleStatusBadge status={entry.status} />
                    ) : null}
                  </div>
                  {entry.reason ? (
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      Reason: {entry.reason}
                    </p>
                  ) : null}
                  {entry.notes ? (
                    <p className="mt-1 text-sm font-medium text-slate-500">{entry.notes}</p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
