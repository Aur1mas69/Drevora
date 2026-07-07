import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import type { VehicleCheck } from '@/lib/vehicleCheckTypes'
import { getResultBadgeClass, getStatusBadgeClass } from '@/lib/vehicleCheckUtils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

type VehicleCheckDrawerProps = {
  check: VehicleCheck | null
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
}

export function VehicleCheckDrawer({
  check,
  isOpen,
  onClose,
  onEdit,
}: VehicleCheckDrawerProps) {
  const { formatDate } = useCompanySettings()

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !check) return null

  const checklistItems = check.items.map((item) => ({
    category: item.category,
    itemName: item.itemName,
    result: item.result,
    comment: item.comment ?? '',
    templateItem: item.templateItem,
    description: item.description,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
  }))
  const passedItems = check.items.filter((item) => item.result === 'Pass')
  const failedItems = check.items.filter((item) => item.result === 'Fail')
  const defectItems = check.items.filter((item) => item.result === 'Fail' || item.result === 'Advisory')
  const photoItems = check.items.filter((item) => item.photoUrl)
  const submittedAt = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(check.createdAt))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close inspection drawer"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-[0_0_40px_rgba(15,23,42,0.18)]">
        <div className="border-b border-[rgba(75,120,220,0.10)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Vehicle Inspection
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
                {check.vehicleRegistration}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {check.fleetNumber ? `Fleet ${check.fleetNumber} · ` : ''}
                {check.workerName}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Summary
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Inspection date</dt>
                <dd className="font-medium tabular-nums text-[#2A376F]">
                  {formatDate(check.inspectionDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Mileage</dt>
                <dd className="font-medium tabular-nums text-slate-700">
                  {check.odometer != null ? check.odometer.toLocaleString() : '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Result</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getResultBadgeClass(check.overallResult)}`}
                  >
                    {check.overallResult}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(check.status)}`}
                  >
                    {check.status}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Submitted</dt>
                <dd className="text-right text-slate-700">{submittedAt}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Checklist result</dt>
                <dd className="text-right text-slate-700">
                  {passedItems.length} passed · {failedItems.length} failed
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Duration</dt>
                <dd className="text-right text-slate-700">Not recorded</dd>
              </div>
              <div>
                <dt className="text-slate-500">Overall notes</dt>
                <dd className="mt-1 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700">
                  {check.notes?.trim() || 'No notes'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Defects
            </h3>
            <div className="mt-3 space-y-2">
              {defectItems.length === 0 ? (
                <div className="rounded-[12px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  No defects
                </div>
              ) : (
                defectItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-950">{item.itemName}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getResultBadgeClass(item.result)}`}
                      >
                        {item.result}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-800/80">{item.category}</p>
                    {item.comment ? (
                      <p className="mt-2 text-sm text-amber-950/80">{item.comment}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          {photoItems.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Photos
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {photoItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.photoUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                  >
                    <img
                      src={item.photoUrl ?? undefined}
                      alt={`${item.itemName} defect`}
                      className="h-28 w-full object-cover"
                    />
                    <span className="block truncate px-2 py-1.5 text-xs font-medium text-slate-600">
                      {item.itemName}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Checklist
            </h3>
            <div className="mt-3">
              <VehicleCheckChecklistForm
                items={checklistItems}
                onChange={() => undefined}
                readOnly
              />
            </div>
          </section>
        </div>

        {onEdit ? (
          <div className="border-t border-[rgba(75,120,220,0.10)] px-5 py-4">
            <Button
              type="button"
              onClick={onEdit}
              className="h-10 w-full rounded-[12px] bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Edit inspection
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
