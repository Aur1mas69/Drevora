import { Card, CardContent } from '@/components/ui/card'
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
    <Card className="rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <CardContent className="p-6">
        <div>
          <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
            Timeline
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Upcoming events first, then history.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {entries.length === 0 ? (
            <div className="rounded-2xl bg-[#F8FBFF] px-4 py-8 text-center ring-1 ring-blue-50">
              <p className="text-sm font-semibold text-slate-600">
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
                  className={`rounded-2xl bg-[#F8FBFF] px-4 py-4 ring-1 ring-blue-50 ${
                    record ? 'cursor-pointer transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-sm' : ''
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
                  <p className="text-sm font-semibold text-slate-500">
                    {formatShortDate(entry.date)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-base">{statusEmojiMap[entry.status]}</span>
                    <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
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
